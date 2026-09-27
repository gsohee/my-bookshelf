// 서버 부르기 공통 처리
//
// 앞으로 만들 서버 API 세 개(표지 인식·구절 인식·추천)가 모두 이 문을 지난다.
// 느릴 때, 인터넷이 없을 때, 한도를 넘었을 때를 여기 한 곳에서만 다룬다.
//
// 지키는 것 네 가지
//   1. 너무 오래 걸리면 끊는다        — 무한정 기다리게 두지 않는다
//   2. 잠깐 탈이 난 것은 한 번 더 해본다 — 통신 끊김·서버 일시 오류
//   3. 답의 모양이 약속과 다르면 실패로 본다 (DESIGN §6)
//   4. 사용자에게는 다듬은 한국어만 보여준다 — 원문 오류를 그대로 띄우지 않는다
//
// Design Ref: §6 서버 API 공통 규칙
// Design Ref: §8 오류 처리
// Design Ref: §7.2 "응답 지연 제한을 Vercel 한도보다 짧게"

/** 무엇 때문에 실패했는지. 화면은 이 값을 보고 다음에 뭘 권할지 고른다. */
export const API_ERROR = {
  /** 인터넷이 끊겨 있다 */
  OFFLINE: 'OFFLINE',
  /** 정해둔 시간 안에 답이 오지 않았다 */
  TIMEOUT: 'TIMEOUT',
  /** 오늘 쓸 수 있는 만큼을 다 썼다 */
  RATE_LIMITED: 'RATE_LIMITED',
  /** 서버 쪽에서 탈이 났다 */
  SERVER: 'SERVER',
  /** 답이 오긴 했는데 약속한 모양이 아니다 */
  BAD_RESPONSE: 'BAD_RESPONSE',
  /** 추천할 책을 받아오지 못했다 */
  RECOMMEND_FAILED: 'RECOMMEND_FAILED',
  /** 그 밖에 */
  UNKNOWN: 'UNKNOWN',
};

/**
 * 사용자에게 보여줄 문구와, 그다음 무엇을 권할지.
 *
 * canRetry — "다시 시도" 버튼을 보여줄 만한가
 *
 * "직접 입력"은 실패한 이유와 상관없이 늘 함께 내주므로 따로 표시하지 않는다.
 * (CameraInput이 인식 실패 때 "다시 시도"와 나란히 보여준다)
 *
 * Design Ref: §8 오류 처리 표
 */
const ERROR_INFO = {
  [API_ERROR.OFFLINE]: {
    message: '인터넷에 연결되어 있지 않아요.',
    canRetry: true,
  },
  [API_ERROR.TIMEOUT]: {
    message: '시간이 오래 걸려요. 다시 해볼까요?',
    canRetry: true,
  },
  [API_ERROR.RATE_LIMITED]: {
    message: '오늘 AI 사용 한도를 넘었어요.',
    canRetry: false,
  },
  [API_ERROR.SERVER]: {
    message: '잠시 문제가 생겼어요. 다시 해볼까요?',
    canRetry: true,
  },
  [API_ERROR.BAD_RESPONSE]: {
    message: '글자를 읽지 못했어요.',
    canRetry: true,
  },
  [API_ERROR.RECOMMEND_FAILED]: {
    message: '추천을 받지 못했어요. 다시 해볼까요?',
    canRetry: true,
  },
  [API_ERROR.UNKNOWN]: {
    message: '잘 되지 않았어요. 다시 해볼까요?',
    canRetry: true,
  },
};

/** 서버가 보내는 실패 이름을 우리 쪽 이름으로 옮긴다. 모르는 것은 UNKNOWN. */
const SERVER_CODE_MAP = {
  RATE_LIMITED: API_ERROR.RATE_LIMITED,
  BAD_IMAGE: API_ERROR.BAD_RESPONSE,
  RECOGNIZE_FAILED: API_ERROR.BAD_RESPONSE,
  RECOMMEND_FAILED: API_ERROR.RECOMMEND_FAILED,
  // 서버가 "내가 기다리다 끊었다"고 알려온 경우. 다시 불러도 또 오래 걸리므로
  // 되풀이하지 않고 사용자에게 묻는다.
  TIMEOUT: API_ERROR.TIMEOUT,
};

/** 서버를 부르다 생긴 실패. */
export class ApiError extends Error {
  constructor(code) {
    const info = ERROR_INFO[code] ?? ERROR_INFO[API_ERROR.UNKNOWN];
    super(info.message);
    this.name = 'ApiError';
    this.code = code;
    this.canRetry = info.canRetry;
  }
}

/**
 * 기다려 줄 시간(밀리초).
 *
 * Vercel의 서버 함수는 오래 걸리면 스스로 끊기므로 그보다 짧게 잡는다(DESIGN §7.2).
 * 추천(작업 22)은 "10초 이내"가 성공 기준(S4)이라 부르는 쪽에서 10000을 넘긴다.
 */
export const DEFAULT_TIMEOUT_MS = 15000;

/** 잠깐 탈이 난 것으로 보고 한 번 더 해볼 실패들. */
const RETRIABLE = new Set([API_ERROR.SERVER, API_ERROR.UNKNOWN]);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 인터넷이 끊겨 있는 게 확실한가. 브라우저가 모르겠다고 하면 일단 있다고 본다. */
function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** 한 번 부른다. 다시 해보는 일은 부르는 쪽(callApi)이 맡는다. */
async function callOnce(path, { body, timeoutMs, signal, validate }) {
  const timer = new AbortController();
  const timeoutId = setTimeout(() => timer.abort('timeout'), timeoutMs);

  // 부르는 쪽이 그만두라고 하면 같이 그만둔다 (화면을 떠났을 때 등)
  const onOuterAbort = () => timer.abort('outer');
  signal?.addEventListener('abort', onOuterAbort);

  let response;
  try {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    response = await fetch(path, {
      method: 'POST',
      body: isForm ? body : JSON.stringify(body ?? {}),
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
      signal: timer.signal,
    });
  } catch {
    // 시간이 다 돼서 끊긴 것인지, 통신이 끊긴 것인지 가린다
    if (signal?.aborted) throw new ApiError(API_ERROR.UNKNOWN);
    if (timer.signal.aborted) throw new ApiError(API_ERROR.TIMEOUT);
    if (isOffline()) throw new ApiError(API_ERROR.OFFLINE);
    throw new ApiError(API_ERROR.SERVER);
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onOuterAbort);
  }

  if (response.status === 429) throw new ApiError(API_ERROR.RATE_LIMITED);

  let data = null;
  try {
    data = await response.json();
  } catch {
    // JSON이 아니다. 아래에서 상태 번호를 보고 판단한다.
    data = null;
  }

  // ★ 서버가 스스로 알려온 이유를 상태 번호보다 먼저 본다. ★
  //
  // 번호부터 보면 500번대가 전부 "서버가 탈났다"로 뭉뚱그려진다.
  // 그러면 서버가 "시간이 다 돼서 끊었다"고 알려줘도 화면은 모른 채
  // 자동으로 한 번 더 불러 기다리는 시간이 두 배가 된다.
  // 서버가 쓴 문구는 쓰지 않고 우리 문구로 바꾼다.
  const knownCode = SERVER_CODE_MAP[data?.error?.code];
  if (knownCode) throw new ApiError(knownCode);

  if (response.status >= 500) throw new ApiError(API_ERROR.SERVER);

  // 답이 JSON이 아니다 — 약속과 다르므로 실패로 본다
  if (data === null) throw new ApiError(API_ERROR.BAD_RESPONSE);

  // 모르는 이름으로 실패를 알려온 경우
  if (data?.error) throw new ApiError(API_ERROR.UNKNOWN);

  if (!response.ok) throw new ApiError(API_ERROR.UNKNOWN);

  // 약속한 모양인지 본다. 아니면 실패다. (DESIGN §6)
  if (validate && !validate(data)) {
    throw new ApiError(API_ERROR.BAD_RESPONSE);
  }

  return data;
}

/**
 * 서버를 부른다.
 *
 * @param path       부를 주소 (예: '/api/recognize-cover')
 * @param body       보낼 것. FormData면 그대로, 아니면 JSON으로 보낸다
 * @param timeoutMs  이만큼 지나면 끊는다
 * @param retries    잠깐 탈이 났을 때 더 해볼 횟수
 * @param signal     부르는 쪽에서 그만두게 할 때
 * @param validate   답이 약속한 모양인지 보는 함수. false면 실패로 본다
 * @throws {ApiError}
 */
export async function callApi(
  path,
  {
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 1,
    signal,
    validate,
  } = {},
) {
  // 인터넷이 끊겨 있으면 굳이 불러보지 않는다. 바로 알려주는 편이 빠르다.
  if (isOffline()) throw new ApiError(API_ERROR.OFFLINE);

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await callOnce(path, { body, timeoutMs, signal, validate });
    } catch (error) {
      lastError = error;

      const 다시해볼만한가 =
        error instanceof ApiError &&
        RETRIABLE.has(error.code) &&
        attempt < retries &&
        !signal?.aborted;

      if (!다시해볼만한가) throw error;

      // 곧바로 다시 부르면 같은 이유로 또 실패하기 쉬워 잠깐 쉬었다 한다
      await wait(500 * (attempt + 1));
    }
  }

  throw lastError;
}
