// 사진을 읽는 서버 공통 처리
//
// 표지 인식(작업 9)과 구절 인식(작업 17)이 함께 쓴다.
// 사진을 꺼내고 걸러내는 일이 여기 있고,
// OpenAI를 부르는 일 자체는 lib/openaiApi.js가 맡는다(글자만 보내는 추천과 함께 쓰므로).
// 무엇을 물어볼지(프롬프트·답의 모양)만 각 Route가 정한다.
//
// ★ 이 파일은 서버에서만 쓴다. ★
// OpenAI 열쇠를 다루므로 화면 코드에서 부르면 안 된다. (CLAUDE.md 2절 절대 규칙 2)
//
// 받은 사진은 메모리에서 OpenAI로 넘기는 데만 쓰고 어디에도 저장하지 않는다.
// (절대 규칙 1 / Plan SC: S6)
//
// Design Ref: §6 서버 API 공통 규칙
// Design Ref: §8 오류 처리

import { askOpenAI, fail, OPENAI_MODEL } from '@/lib/openaiApi';

// 실패 응답 만드는 방법은 다른 Route도 그대로 쓴다.
export { fail };

/**
 * 사진을 읽을 때 쓸 모델.
 * 바꾸고 싶으면 .env에 OPENAI_VISION_MODEL을 적으면 된다.
 *
 * ★ 큰 모델로 바꿔봤다가 되돌렸다. ★
 * 구절 인식이 틀린다는 말을 듣고 `gpt-4.1`로 올려 재봤더니 **오히려 더 틀렸다.**
 * 한글 본문 한 쪽을 세 번씩 읽혀 글자 단위로 견준 결과:
 *
 *   gpt-4.1-mini  99.8 ~ 100%
 *   gpt-4.1       93.5 ~ 98.9%   ← 과학→화학, 별까지의→별가시의 같은 잘못
 *
 * 큰 모델이 늘 나은 것은 아니다. 글자를 그대로 옮기는 일에서는 mini가 나았다.
 */
export const VISION_MODEL = process.env.OPENAI_VISION_MODEL || OPENAI_MODEL;

/**
 * 사진을 얼마나 자세히 보게 할지.
 *
 * 적지 않으면 OpenAI가 알아서 고른다(`auto`). 대개는 `high`와 같은 결과였지만,
 * 사진이 클수록 `auto`가 더 나빠졌다(2600px에서 91.5% vs high 94.3%).
 * 글자를 옮기는 일이므로 알아서 고르게 두지 않고 늘 `high`로 못박는다.
 */
const IMAGE_DETAIL = 'high';

/**
 * 받아줄 사진 크기의 위쪽 한계.
 * 브라우저가 표지는 1.5MB, 구절은 2MB 아래로 줄여 보내므로(lib/image.js) 넉넉한 값이다.
 * 줄이기를 건너뛴 요청이 서버를 오래 붙잡지 못하게 막는 울타리다.
 */
const MAX_BYTES = 4 * 1024 * 1024;

/** 받아줄 사진 형식. */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * OpenAI가 이 시간 안에 답하지 않으면 끊는다. 화면 쪽 제한(25초)보다 짧게 잡는다.
 *
 * 자세히 보기(`high`)로 바꾸면서 늘렸다. 실측은 4~5초였지만, 휴대폰 통신이 느릴 때를
 * 생각하면 12초는 빠듯하다. Route의 `maxDuration`(30초)보다는 짧아야 한다 —
 * Vercel이 먼저 끊으면 우리가 다듬은 안내를 보여줄 수 없다.
 */
const OPENAI_TIMEOUT_MS = 22000;

/**
 * JPEG 바이트에서 가로·세로를 읽는다. 못 읽으면 null.
 * 파일 앞쪽의 표시(SOF)에 크기가 적혀 있다.
 */
function readJpegSize(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    // SOF0·SOF1·SOF2에 크기가 들어 있다
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
      };
    }
    if (marker === 0xda) break; // 그림 자료가 시작되면 그만
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2) break;
    i += 2 + length;
  }
  return null;
}

/**
 * 담긴 내용이 거의 없는 사진인지.
 *
 * 왜 필요한가:
 * 온통 흰 바탕처럼 아무것도 없는 사진을 주면 AI가 없는 글자를 지어낸다.
 * (표지 인식에서 "THE GREAT GATSBY"를 만들어내는 것을 확인했다)
 * 그런 사진은 물어볼 것도 없으므로 부르기 전에 돌려보낸다.
 * 비용도 아끼고 지어낼 기회도 주지 않는다.
 *
 * 어떻게 아는가:
 * JPEG은 단조로운 그림일수록 훨씬 작아진다. 픽셀 수에 견준 파일 크기가
 * 터무니없이 작으면 사실상 단색이다.
 *
 * 기준을 아주 낮게 잡아 진짜 사진을 잘못 막지 않게 한다.
 * (글자가 있는 아주 단순한 흰 표지도 픽셀당 0.05바이트를 넘었다)
 */
const MIN_BYTES_PER_PIXEL = 0.01;

export function looksBlank(bytes, type) {
  // JPEG만 본다. 다른 형식은 크기와 내용의 관계가 달라 같은 잣대를 쓸 수 없다.
  if (type !== 'image/jpeg') return false;

  const size = readJpegSize(bytes);
  if (!size || !size.width || !size.height) return false;

  return bytes.length / (size.width * size.height) < MIN_BYTES_PER_PIXEL;
}

/**
 * 요청에서 사진을 꺼내 검사한다.
 *
 * @returns 잘 꺼냈으면 { dataUrl }, 아니면 { errorResponse }
 */
export async function readImageFromRequest(request) {
  let file;
  try {
    const form = await request.formData();
    file = form.get('image');
  } catch {
    return { errorResponse: fail(400, 'BAD_IMAGE', '사진을 받지 못했습니다.') };
  }

  if (!file || typeof file.arrayBuffer !== 'function') {
    return { errorResponse: fail(400, 'BAD_IMAGE', '사진이 없습니다.') };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      errorResponse: fail(400, 'BAD_IMAGE', '지원하지 않는 사진 형식입니다.'),
    };
  }
  if (file.size > MAX_BYTES) {
    return { errorResponse: fail(400, 'BAD_IMAGE', '사진이 너무 큽니다.') };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // 아무것도 담기지 않은 사진은 물어보지 않고 돌려보낸다.
  if (looksBlank(bytes, file.type)) {
    return { blank: true };
  }

  // 메모리에서 글자로 바꿔 OpenAI에 넘긴다. 디스크에 쓰지 않는다.
  return { dataUrl: `data:${file.type};base64,${bytes.toString('base64')}` };
}

/**
 * 사진을 OpenAI에 보내 정해진 모양의 답을 받는다.
 *
 * @param apiKey         .env의 OPENAI_API_KEY
 * @param dataUrl        보낼 사진
 * @param prompt         무엇을 해달라고 할지
 * @param responseFormat 돌려받을 모양 (json_schema)
 * @param failCode       실패할 때 쓸 이름
 * @returns 잘 받았으면 { data }, 아니면 { errorResponse }
 */
export async function askVision({
  apiKey,
  dataUrl,
  prompt,
  responseFormat,
  failCode = 'RECOGNIZE_FAILED',
  failMessage = '사진을 읽지 못했습니다.',
}) {
  return askOpenAI({
    apiKey,
    model: VISION_MODEL,
    responseFormat,
    timeoutMs: OPENAI_TIMEOUT_MS,
    failCode,
    failMessage,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl, detail: IMAGE_DETAIL } },
        ],
      },
    ],
  });
}
