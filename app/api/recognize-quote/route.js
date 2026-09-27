// 구절 인식
//
// 브라우저가 줄여서 보낸 책 페이지 사진을 받아, 거기 적힌 글자를 그대로 옮겨 돌려준다.
//
// 표지 인식과 다른 점:
//   표지는 "제목·저자"라는 짧고 정해진 값을 골라내는 일이지만,
//   구절은 보이는 본문을 글자 그대로 옮기는 일이다.
//   그래서 다듬거나 고치지 말라고 거듭 이른다. (Plan SC: S3 글자 정확도 95%)
//
// ★ OpenAI 열쇠는 이 파일 같은 서버 코드에서만 쓴다. ★ (CLAUDE.md 2절 절대 규칙 2)
//
// 읽은 결과는 그대로 저장되지 않는다. 편집창을 채워줄 뿐이고,
// 확인하고 저장하는 일은 사람이 한다. (절대 규칙 3 — 연결은 작업 18)
//
// Design Ref: §6 서버 API — /api/recognize-quote
// Design Ref: §4.3 흐름 2 — 구절 수집

import { fail, readImageFromRequest, askVision } from '@/lib/visionApi';

/** 사진을 다루므로 Node 환경에서 돌린다. */
export const runtime = 'nodejs';

const FAIL_MESSAGE = '사진에서 글자를 읽지 못했습니다.';

/**
 * 돌려받을 모양.
 *
 * hasText를 따로 묻는 까닭:
 * 글자만 물으면 글자가 없는 사진에도 그럴듯한 문장을 지어낸다.
 * 표지 인식에서 없는 책 이름을 만들어내는 것을 실제로 확인했다.
 * 구절은 그 위험이 더 크다 — 사용자가 읽지도 않은 문장을 저장하게 되기 때문이다.
 * "글자가 보이나"를 먼저 답하게 하면 지어내는 일이 줄고,
 * 아니라고 하면 우리가 실패로 처리할 수 있다.
 *
 * runningHead를 따로 묻는 까닭:
 * "장 제목은 넣지 말라"고 이르기만 해서는 머리말이 본문에 섞여 들어왔다.
 * ("제3장 코스모스"가 구절 앞에 붙는 것을 실제로 확인했다 — 정확도가 94%로 떨어졌다)
 * 본문이 아닌 글자를 적을 자리를 따로 주면, 모델이 그쪽에 적고 본문에서 뺀다.
 *
 * (CLAUDE.md 7절 "정해진 JSON 스키마로만 받는다")
 */
const RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'book_quote',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        isBookPage: {
          type: 'boolean',
          description:
            '이 사진이 글자가 인쇄된 책·문서의 페이지이면 true. 풍경·사물·사람 사진이면 false',
        },
        hasText: {
          type: 'boolean',
          description:
            '사진에 읽을 수 있는 본문 글자가 실제로 보이면 true. 아니면 false',
        },
        runningHead: {
          type: 'string',
          description:
            '본문이 아닌 글자. 머리말·장 제목·쪽 번호·각주 번호. 없으면 빈 글자',
        },
        text: {
          type: 'string',
          description:
            '본문만 그대로 옮긴 글자. runningHead에 적은 것은 넣지 않는다. 본문이 없으면 빈 글자',
        },
        pageNumber: {
          type: 'string',
          description:
            '페이지 구석에 인쇄된 쪽 번호를 숫자만 적는다. 보이지 않으면 빈 글자. 짐작하지 않는다',
        },
      },
      required: ['isBookPage', 'hasText', 'runningHead', 'text', 'pageNumber'],
      additionalProperties: false,
    },
  },
};

const PROMPT = [
  '사진에 인쇄된 글자를 옮겨 적는 일입니다. 아래 순서대로 답해 주세요.',
  '',
  '★ 이것은 사진을 설명하는 일이 아닙니다. ★',
  '사진에 무엇이 찍혔는지 묘사하지 마세요. 인쇄된 글자를 그대로 옮기기만 합니다.',
  '',
  '1) isBookPage — 글자가 인쇄된 책이나 문서의 페이지이면 true입니다.',
  '   풍경·사물·사람·음식 사진이거나 바탕만 있으면 false입니다.',
  '   false이면 나머지를 모두 빈 값으로 두고 hasText도 false로 둡니다.',
  '2) runningHead — 본문이 아닌 글자를 여기에 적습니다.',
  '   페이지 맨 위의 머리말, 장 제목, 맨 아래의 쪽 번호, 각주 번호가 여기 해당합니다.',
  '   그런 것이 없으면 빈 글자로 둡니다.',
  '3) text — 본문만 그대로 옮깁니다.',
  '   runningHead에 적은 글자는 여기에 넣지 않습니다.',
  '4) pageNumber — 페이지 위나 아래 구석에 인쇄된 쪽 번호를 숫자만 적습니다.',
  '   본문 안의 숫자(연도·수량·각주 번호)는 쪽 번호가 아닙니다.',
  '   쪽 번호가 보이지 않으면 빈 글자로 둡니다. 짐작하지 않습니다.',
  '5) hasText — text에 옮길 본문 글자가 실제로 보였으면 true입니다.',
  '',
  '가장 중요한 규칙: 사진에 실제로 인쇄되어 보이는 글자만 씁니다. 절대 지어내지 않습니다.',
  '없는 문장을 채우느니 빈 글자로 두는 편이 낫습니다.',
  '사진에 글자가 하나도 없으면 무엇이 찍혔든 isBookPage와 hasText는 false입니다.',
  '',
  '- 맞춤법을 고치거나 문장을 다듬지 않습니다. 보이는 그대로 옮깁니다.',
  '- 요약하거나 설명을 덧붙이지 않습니다.',
  '- 줄바꿈은 문단이 바뀔 때만 넣습니다. 책의 줄 끝에서 억지로 끊지 않습니다.',
  '- 흐릿해서 확실하지 않은 글자는 짐작하지 말고 그 자리를 비웁니다.',
].join('\n');

/** 띄어쓰기를 무시하고 견주기 위해 납작하게 만든다. */
const flatten = (s) => String(s ?? '').replace(/\s+/g, '');

/** 쪽 번호가 넘을 수 없는 선. 이보다 큰 수는 잘못 읽은 것으로 본다. */
const MAX_PAGE = 9999;

/**
 * 모델이 적어보낸 쪽 번호를 숫자로 바꿈다. (작업 38)
 *
 * **믿기 어려우면 null을 돌려준다.** 틀린 번호를 채워주는 것보다
 * 비워두는 편이 낫다 — 사용자가 빈 칸은 알아차리지만, 그럴듯한 틀린 숫자는 그냥 저장된다.
 * (CLAUDE.md 2절 절대 규칙 3 — 자동 인식 값도 사용자 확인 뒤에 저장된다)
 */
function readPageNumber(value) {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  if (digits === '') return null;

  const page = Number(digits);
  if (!Number.isInteger(page) || page <= 0 || page > MAX_PAGE) return null;
  return page;
}

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // 열쇠 값은 어디에도 적지 않는다. 없다는 사실만 알린다. (CLAUDE.md 9절)
    return fail(500, 'NO_API_KEY', 'OPENAI_API_KEY가 설정되어 있지 않습니다.');
  }

  const image = await readImageFromRequest(request);
  if (image.errorResponse) return image.errorResponse;
  if (image.blank) return fail(422, 'RECOGNIZE_FAILED', FAIL_MESSAGE);

  const asked = await askVision({
    apiKey,
    dataUrl: image.dataUrl,
    prompt: PROMPT,
    responseFormat: RESPONSE_FORMAT,
    failMessage: FAIL_MESSAGE,
  });
  if (asked.errorResponse) return asked.errorResponse;

  const parsed = asked.data;

  if (typeof parsed?.text !== 'string') {
    return fail(502, 'RECOGNIZE_FAILED', FAIL_MESSAGE);
  }

  // 앞뒤 빈 줄만 걷어낸다. 가운데 줄바꿈은 문단 구분이므로 그대로 둔다.
  let text = parsed.text.replace(/^\s+|\s+$/g, '');

  // 머리말을 따로 적어두고도 본문 앞에 또 붙여 보내는 경우가 있다.
  // 그럴 때는 여기서 걷어낸다. 본문 한가운데 같은 말이 나오는 건 건드리지 않는다.
  const head = String(parsed.runningHead ?? '').trim();
  if (head !== '') {
    const flatHead = flatten(head);
    // 앞쪽 몇 줄만 살펴 머리말과 같은 줄을 떼어낸다.
    const lines = text.split('\n');
    while (lines.length > 0) {
      const first = flatten(lines[0]);
      if (first === '' || (flatHead !== '' && first === flatHead)) {
        lines.shift();
      } else {
        break;
      }
    }
    text = lines.join('\n').replace(/^\s+|\s+$/g, '');
  }

  // 책 페이지가 아니거나 글자를 못 읽었으면 실패로 돌려준다.
  //
  // isBookPage를 함께 보는 까닭:
  // 풍경 사진을 주면 글자를 옮기는 대신 사진을 설명해버렸다.
  // ("하늘은 파랗고 땅은 초록색이다"를 만들어내는 것을 실제로 확인했다)
  // 사용자가 읽지도 않은 문장이 저장되면 안 되므로 여기서 막는다.
  //
  // 빈 값을 성공인 척 넘기면 화면이 빈 편집창을 열어주는 셈이 되어
  // 사용자가 "인식됐다"고 오해한다. (PRD M2 "실패 시 직접 입력")
  if (parsed.isBookPage !== true || parsed.hasText !== true || text === '') {
    return fail(422, 'RECOGNIZE_FAILED', FAIL_MESSAGE);
  }

  return Response.json({ text, page: readPageNumber(parsed.pageNumber) });
}
