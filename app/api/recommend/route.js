// 다음에 읽을 책 추천
//
// 방금 읽은 책의 제목·장르와, 사용자가 고른 감상 항목만 보내 3권을 받는다.
//
// ★ 밖으로 나가는 것은 여기까지다. ★
//   보내는 것: 제목, 장르, 분위기, 좋았던 점, 난이도, 별점
//   보내지 않는 것: 구절 본문, 메모, 서재의 다른 책
// (PRD 7절 "메모·구절 전문은 보내지 말고 선택 항목과 제목·장르만 전송")
//
// ★ OpenAI 열쇠는 이 파일 같은 서버 코드에서만 쓴다. ★ (CLAUDE.md 2절 절대 규칙 2)
//
// 받은 추천은 그대로 저장되지 않는다. 화면이 보여줄 뿐이고,
// "읽을 책에 저장"은 사람이 누른다. (작업 23)
//
// Design Ref: §6 서버 API — /api/recommend
// Design Ref: §4.4 흐름 3 — 완독 → 추천

import { fail, askOpenAI } from '@/lib/openaiApi';

export const runtime = 'nodejs';

const FAIL_MESSAGE = '추천을 받지 못했습니다.';

/**
 * 몇 권을 받을지.
 *
 * 화면에 보일 것은 3권이지만(PRD N1) 넉넉히 받아 넘긴다.
 * 고르는 일은 화면이 맡는다 — 서재에 이미 있는 책을 빼는 것은 화면만 할 수 있고,
 * 서버가 먼저 3권으로 잘라버리면 그중 하나가 서재에 있을 때 2권만 남는다.
 */
const ASK_COUNT = 5;

/**
 * 기다려 줄 시간.
 * "추천 응답 10초 이내"가 성공 기준(S4)이라, 화면 쪽 제한(10초)보다 짧게 잡는다.
 */
const TIMEOUT_MS = 8000;

/**
 * 돌려받을 모양을 못박는다.
 * 자유롭게 쓴 글을 우리가 해석하지 않는다. (CLAUDE.md 7절)
 */
const RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'book_recommendations',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        books: {
          type: 'array',
          description: `실제로 출간된 책 ${ASK_COUNT}권`,
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: '책 제목' },
              author: { type: 'string', description: '지은이' },
              reason: {
                type: 'string',
                description: '이 사람의 감상과 어떻게 이어지는지 한두 문장',
              },
            },
            required: ['title', 'author', 'reason'],
            additionalProperties: false,
          },
        },
      },
      required: ['books'],
      additionalProperties: false,
    },
  },
};

const PROMPT = [
  '방금 책을 다 읽은 사람에게 다음에 읽을 책을 골라 주세요.',
  '',
  `실제로 출간된 책 ${ASK_COUNT}권을 추천합니다.`,
  '',
  '가장 중요한 규칙: 실제로 있는 책만 추천합니다. 절대 지어내지 않습니다.',
  '제목과 지은이가 확실하지 않으면 그 책은 넣지 않습니다.',
  '',
  '- 방금 읽은 그 책은 추천하지 않습니다.',
  '- 같은 책을 두 번 넣지 않습니다.',
  '- 아주 유명하지 않아도 괜찮지만, 널리 알려진 책이면 더 좋습니다.',
  '- reason에는 이 사람이 고른 감상과 어떻게 이어지는지 한두 문장으로 적습니다.',
  '  줄거리 요약이 아니라 "왜 이 사람에게 맞는지"를 씁니다.',
  '- 지은이가 여럿이면 대표 한 명만 적습니다.',
  '- title에는 책 이름만 적습니다. 『』나 따옴표 같은 괄호를 붙이지 않습니다.',
].join('\n');

/**
 * 제목·지은이 앞뒤에 붙은 괄호·따옴표를 걷어낸다.
 *
 * 프롬프트로 이르기만 해서는 『데미안』처럼 괄호를 붙여 보냈다.
 * 그러면 "방금 읽은 책 빼기"가 글자 비교에서 어긋나 그 책이 다시 추천됐다.
 * 그래서 프롬프트와 함께 여기서도 한 번 더 걷어낸다.
 */
function stripBrackets(value) {
  return String(value ?? '')
    .trim()
    .replace(/^[「『《〈"'“”‘’[(<]+/, '')
    .replace(/[」』》〉"'“”‘’\])>]+$/, '')
    .trim();
}

/** 보낼 말을 만든다. 여기 적히지 않은 것은 밖으로 나가지 않는다. */
function buildUserMessage({ title, genre, mood, likedPoints, difficulty, rating }) {
  const lines = [`방금 읽은 책: 『${title}』`];
  if (genre) lines.push(`장르: ${genre}`);
  if (mood) lines.push(`읽고 난 분위기: ${mood}`);
  if (likedPoints.length > 0) lines.push(`좋았던 점: ${likedPoints.join(', ')}`);
  if (difficulty) lines.push(`난이도: ${difficulty}`);
  if (rating) lines.push(`별점: 5점 만점에 ${rating}점`);
  return lines.join('\n');
}

/** 띄어쓰기와 대소문자를 무시하고 견주기 위해 납작하게 만든다. */
const flatten = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // 열쇠 값은 어디에도 적지 않는다. 없다는 사실만 알린다. (CLAUDE.md 9절)
    return fail(500, 'NO_API_KEY', 'OPENAI_API_KEY가 설정되어 있지 않습니다.');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'BAD_INPUT', '요청을 읽지 못했습니다.');
  }

  const title = String(body?.title ?? '').trim();
  if (title === '') {
    return fail(400, 'BAD_INPUT', '책 제목이 없습니다.');
  }

  // 받기로 한 항목만 골라 쓴다. 다른 것이 섞여 와도 밖으로 내보내지 않는다.
  const input = {
    title,
    genre: String(body?.genre ?? '').trim(),
    mood: String(body?.mood ?? '').trim(),
    likedPoints: Array.isArray(body?.likedPoints)
      ? body.likedPoints.map((item) => String(item).trim()).filter(Boolean)
      : [],
    difficulty: String(body?.difficulty ?? '').trim(),
    rating: Number.isFinite(body?.rating) && body.rating > 0 ? body.rating : null,
  };

  const asked = await askOpenAI({
    apiKey,
    responseFormat: RESPONSE_FORMAT,
    timeoutMs: TIMEOUT_MS,
    failCode: 'RECOMMEND_FAILED',
    failMessage: FAIL_MESSAGE,
    messages: [
      { role: 'system', content: PROMPT },
      { role: 'user', content: buildUserMessage(input) },
    ],
  });
  if (asked.errorResponse) return asked.errorResponse;

  const raw = asked.data?.books;
  if (!Array.isArray(raw)) {
    return fail(502, 'RECOMMEND_FAILED', FAIL_MESSAGE);
  }

  // 모양이 어긋난 것, 방금 읽은 책, 같은 책이 두 번 온 것을 걸러낸다.
  const seen = new Set();
  const books = [];
  for (const item of raw) {
    const bookTitle = stripBrackets(item?.title);
    const bookAuthor = stripBrackets(item?.author);
    const reason = String(item?.reason ?? '').trim();

    if (bookTitle === '' || bookAuthor === '') continue;

    const key = `${flatten(bookTitle)}|${flatten(bookAuthor)}`;
    if (seen.has(key)) continue;
    if (flatten(bookTitle) === flatten(title)) continue;

    seen.add(key);
    books.push({ title: bookTitle, author: bookAuthor, reason });
  }

  if (books.length === 0) {
    return fail(502, 'RECOMMEND_FAILED', FAIL_MESSAGE);
  }

  // 서재에 이미 있는 책을 빼는 일은 화면이 맡는다(작업 23).
  // 서재 목록은 이 기기에만 있고, 밖으로 보내지 않기로 했기 때문이다. (PRD 6절)
  return Response.json({ books });
}
