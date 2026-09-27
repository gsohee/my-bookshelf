// OpenAI 부르기 공통
//
// 표지 인식·구절 인식(사진을 보냄)과 책 추천(글자만 보냄)이 함께 쓴다.
// 부르는 방법과 실패를 다루는 방법이 같아서 여기 한곳에 모았다.
// 무엇을 물어볼지(프롬프트·답의 모양)는 부르는 쪽이 정한다.
//
// ★ 이 파일은 서버에서만 쓴다. ★
// OpenAI 열쇠를 다루므로 화면 코드에서 부르면 안 된다. (CLAUDE.md 2절 절대 규칙 2)
//
// Design Ref: §6 서버 API 공통 규칙
// Design Ref: §8 오류 처리

/**
 * 쓸 모델.
 * 바꾸고 싶으면 .env에 OPENAI_MODEL을 적으면 된다.
 */
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

/** 실패를 정해진 모양으로 돌려준다. Design Ref: §6 "{ error: { code, message } }" */
export function fail(status, code, message) {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * OpenAI에 물어보고 정해진 모양의 답을 받는다.
 *
 * @param apiKey         .env의 OPENAI_API_KEY
 * @param model          쓸 모델
 * @param messages       보낼 말. 사진을 넣을 수도 있고 글자만일 수도 있다
 * @param responseFormat 돌려받을 모양 (json_schema)
 * @param timeoutMs      이만큼 지나면 끊는다. 화면 쪽 제한보다 짧게 잡는다
 * @param failCode       실패할 때 쓸 이름
 * @param failMessage    실패할 때 보여줄 문구
 * @returns 잘 받았으면 { data }, 아니면 { errorResponse }
 */
export async function askOpenAI({
  apiKey,
  model = OPENAI_MODEL,
  messages,
  responseFormat,
  timeoutMs = 12000,
  failCode = 'RECOGNIZE_FAILED',
  failMessage = '요청을 처리하지 못했습니다.',
}) {
  const stopper = new AbortController();
  const timeoutId = setTimeout(() => stopper.abort(), timeoutMs);

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: stopper.signal,
      body: JSON.stringify({
        model,
        response_format: responseFormat,
        // 같은 물음에 늘 비슷한 답을 주도록 한다.
        temperature: 0,
        messages,
      }),
    });
  } catch {
    // 우리가 정해둔 시간이 다 돼서 끊은 것인지, 통신이 탈난 것인지 가린다.
    //
    // 이 둘을 뭉뚱그리면 화면이 "서버가 탈났다"로 보고 자동으로 한 번 더 부른다.
    // 그러면 기다리는 시간이 두 배가 되어 "추천 10초 이내"(S4)를 넘긴다.
    // 시간 초과라고 분명히 알려주면 화면이 다시 부르지 않고 사용자에게 묻는다.
    if (stopper.signal.aborted) {
      return { errorResponse: fail(504, 'TIMEOUT', '시간이 오래 걸렸습니다.') };
    }
    return { errorResponse: fail(502, failCode, failMessage) };
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 429) {
    return { errorResponse: fail(429, 'RATE_LIMITED', '사용 한도를 넘었습니다.') };
  }
  if (!response.ok) {
    // OpenAI가 보낸 원문은 그대로 내보내지 않는다. 열쇠나 내부 사정이 섞일 수 있다.
    return { errorResponse: fail(502, failCode, failMessage) };
  }

  let text;
  try {
    const payload = await response.json();
    text = payload?.choices?.[0]?.message?.content;
  } catch {
    return { errorResponse: fail(502, failCode, failMessage) };
  }

  if (typeof text !== 'string') {
    return { errorResponse: fail(502, failCode, failMessage) };
  }

  try {
    return { data: JSON.parse(text) };
  } catch {
    return { errorResponse: fail(502, failCode, failMessage) };
  }
}
