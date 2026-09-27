// 표지 인식
//
// 브라우저가 줄여서 보낸 표지 사진을 받아 제목·저자를 읽어 돌려준다.
//
// 사진을 꺼내고 OpenAI에 물어보는 공통 부분은 lib/visionApi.js가 맡는다.
// 여기서는 "표지에서 무엇을 어떻게 읽을지"만 정한다.
//
// ★ OpenAI 열쇠는 이 파일 같은 서버 코드에서만 쓴다. ★
// 브라우저로 내려보내지 않고, 화면 코드는 열쇠를 모른다. (CLAUDE.md 2절 절대 규칙 2)
//
// 읽은 결과는 그대로 저장되지 않는다. 화면이 입력칸을 채워줄 뿐이고,
// 확인하고 저장하는 일은 사람이 한다. (절대 규칙 3 — 작업 10)
//
// Design Ref: §6 서버 API — /api/recognize-cover
// Design Ref: §4.2 흐름 1 — 책 등록

import { fail, readImageFromRequest, askVision } from '@/lib/visionApi';

/** 사진을 다루므로 Node 환경에서 돌린다. */
export const runtime = 'nodejs';

const FAIL_MESSAGE = '표지에서 제목을 읽지 못했습니다.';

/**
 * 돌려받을 모양을 못박는다.
 * 자유롭게 쓴 글을 우리가 해석하지 않는다 — 모양이 어긋나면 실패로 본다.
 * (CLAUDE.md 7절 "정해진 JSON 스키마로만 받는다")
 *
 * visibleText와 isBookCover를 먼저 묻는 까닭:
 *
 * 제목·저자만 물으면 책 표지가 아닌 사진에도 그럴듯한 이름을 지어낸다.
 * 글자가 하나도 없는 회색 사진에 없는 책 이름을 채워 넣는 것을 실제로 확인했다.
 *
 * 그래서 순서를 바꿨다.
 *   1. 사진에서 "실제로 보이는 글자"를 먼저 그대로 옮겨 적게 한다
 *   2. 그것이 책 표지인지 판단하게 한다
 *   3. 그다음에 제목·저자를 고르게 한다
 *
 * 먼저 본 것을 적어두면 없는 것을 지어내기 어려워지고,
 * "보이는 글자가 없다"고 해놓고 제목을 냈다면 우리가 모순을 잡아낼 수 있다.
 * (PRD M1 "짐작해서 채우지 않습니다")
 */
const RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'book_cover',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        visibleText: {
          type: 'string',
          description:
            '사진에서 실제로 눈에 보이는 글자를 있는 그대로 옮겨 적는다. 글자가 없으면 빈 글자',
        },
        isBookCover: {
          type: 'boolean',
          description:
            '이 사진이 책 표지이고 제목 글자가 실제로 보이면 true. 아니면 false',
        },
        title: {
          type: 'string',
          description: '표지에 적힌 책 제목. 읽히지 않으면 빈 글자',
        },
        author: {
          type: 'string',
          description: '표지에 적힌 지은이. 없거나 읽히지 않으면 빈 글자',
        },
      },
      required: ['visibleText', 'isBookCover', 'title', 'author'],
      additionalProperties: false,
    },
  },
};

const PROMPT = [
  '사진을 보고 아래 순서대로 답해 주세요.',
  '',
  '1) visibleText — 사진에서 눈에 보이는 글자를 있는 그대로 옮겨 적습니다.',
  '   글자가 하나도 없으면 반드시 빈 글자로 둡니다.',
  '   바탕색만 있거나, 풍경·사물 사진이면 글자가 없는 것입니다.',
  '2) isBookCover — visibleText에 책 제목으로 보이는 글자가 있을 때만 true입니다.',
  '   visibleText가 비어 있으면 반드시 false입니다.',
  '3) title, author — visibleText에 적은 글자 중에서만 고릅니다.',
  '',
  '가장 중요한 규칙: 사진에 실제로 보이는 글자만 씁니다. 절대 지어내지 않습니다.',
  '없는 책 이름을 채우느니 빈 글자로 두는 편이 낫습니다.',
  '',
  '- 글자가 흐릿해 확실하지 않으면 짐작하지 말고 빈 글자로 둡니다.',
  '- 표지에 지은이가 없으면 author만 빈 글자로 둡니다.',
  '- 출판사·번역가·추천사·띠지 문구는 지은이가 아닙니다.',
  '- 부제가 있으면 제목에 넣지 않습니다.',
].join('\n');

/** 띄어쓰기와 대소문자를 무시하고 견주기 위해 납작하게 만든다. */
const flatten = (s) => String(s).replace(/\s+/g, '').toLowerCase();

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

  // 모양을 한 번 더 확인한다. 화면 쪽에서도 보지만 여기서 먼저 거른다.
  if (typeof parsed?.title !== 'string' || typeof parsed?.author !== 'string') {
    return fail(502, 'RECOGNIZE_FAILED', FAIL_MESSAGE);
  }

  const title = parsed.title.trim();
  const author = parsed.author.trim();
  const visibleText = String(parsed.visibleText ?? '').trim();

  // 책 표지가 아니거나 제목을 못 읽었으면 실패로 돌려준다.
  // 빈 값을 성공인 척 넘기면 화면이 빈 입력칸을 채워주는 셈이 되어
  // 사용자가 "인식됐다"고 오해한다. (PRD M1 "실패 시 직접 입력으로 전환")
  if (parsed.isBookCover !== true || title === '') {
    return fail(422, 'RECOGNIZE_FAILED', FAIL_MESSAGE);
  }

  // 스스로 "보이는 글자가 없다"고 해놓고 제목을 냈다면 지어낸 것이다.
  if (visibleText === '') {
    return fail(422, 'RECOGNIZE_FAILED', FAIL_MESSAGE);
  }

  // 제목이 "보이는 글자" 안에 없다면 그것도 지어낸 것이다.
  if (!flatten(visibleText).includes(flatten(title))) {
    return fail(422, 'RECOGNIZE_FAILED', FAIL_MESSAGE);
  }

  // 지은이도 "보이는 글자" 안에 있을 때만 넘긴다. 아니면 비워서 사람이 채우게 한다.
  const flatAuthor = flatten(author);
  const authorWasVisible =
    flatAuthor !== '' && flatten(visibleText).includes(flatAuthor);

  // 밖으로 나가는 모양은 { title, author } 그대로다. (Design Ref: §6)
  // visibleText는 지어내기를 막으려고 안에서만 쓰고 내보내지 않는다.
  return Response.json({
    title,
    author: authorWasVisible ? author : '',
  });
}
