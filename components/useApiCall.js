'use client';

// 서버를 부르는 동안의 화면 상태
//
// 부르는 화면마다 "지금 부르는 중인가 / 실패했나 / 다시 해볼 수 있나"를 각자 만들면
// 세 곳(표지 인식·구절 인식·추천)이 조금씩 달라진다. 그 상태를 여기 한 곳에 둔다.
//
// 화면을 떠나면 부르던 것을 그만둔다 — 사라진 화면에 답이 도착해도 쓸 데가 없다.
//
// Design Ref: §8 오류 처리 "로딩 표시 / 재시도"
// Design Ref: §3.3② 인식 중 · 인식 성공 · 인식 실패

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const CALL_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
};

export function useApiCall() {
  const [status, setStatus] = useState(CALL_STATUS.IDLE);
  const [error, setError] = useState(null);

  // 마지막으로 시킨 일. "다시 시도"가 같은 일을 한 번 더 하게 한다.
  const lastTask = useRef(null);
  // 지금 부르는 것을 그만두게 하는 손잡이.
  const stopper = useRef(null);
  // 화면이 아직 있는지. 떠난 뒤에는 상태를 건드리지 않는다.
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopper.current?.abort();
    };
  }, []);

  /**
   * 서버를 부른다.
   *
   * @param task (signal) => Promise — 실제로 부르는 일. signal을 callApi에 넘겨주면
   *             화면을 떠날 때 함께 멈춘다.
   * @returns 성공하면 답, 실패하면 null. 실패 내용은 error에 담긴다.
   */
  const run = useCallback(async (task) => {
    lastTask.current = task;

    stopper.current?.abort();
    const controller = new AbortController();
    stopper.current = controller;

    setStatus(CALL_STATUS.LOADING);
    setError(null);

    try {
      const result = await task(controller.signal);
      if (!alive.current || controller.signal.aborted) return null;
      setStatus(CALL_STATUS.SUCCESS);
      return result;
    } catch (caught) {
      if (!alive.current || controller.signal.aborted) return null;
      setStatus(CALL_STATUS.ERROR);
      setError(caught);
      return null;
    }
  }, []);

  /** 방금 실패한 일을 한 번 더 한다. */
  const retry = useCallback(() => {
    if (!lastTask.current) return Promise.resolve(null);
    return run(lastTask.current);
  }, [run]);

  /** 처음 상태로 되돌린다. 부르던 것이 있으면 그만둔다. */
  const reset = useCallback(() => {
    stopper.current?.abort();
    stopper.current = null;
    lastTask.current = null;
    setStatus(CALL_STATUS.IDLE);
    setError(null);
  }, []);

  // 돌려주는 값이 매번 새 객체면, 이것을 지켜보는 effect가 끝없이 다시 돈다.
  // (화면에 들어서자마자 한 번 부르는 곳이 있다 — 작업 23 추천 결과)
  return useMemo(
    () => ({
      status,
      error,
      /** 부르는 중인가 — 로딩 표시에 쓴다 */
      loading: status === CALL_STATUS.LOADING,
      /** 화면에 보여줄 한국어 문구. 실패가 없으면 빈 글자 */
      errorMessage: error?.message ?? '',
      /** "다시 시도" 버튼을 보여줄 만한가 */
      canRetry: error?.canRetry ?? false,
      run,
      retry,
      reset,
    }),
    [status, error, run, retry, reset],
  );
}
