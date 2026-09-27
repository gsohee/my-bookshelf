'use client';

// 찍은 사진 한 장을 맡아 두는 곳
//
// ★ 이 파일이 이 앱에서 사진을 담는 유일한 자리다. ★
//
// 사진은 아래 길만 지난다. 되돌아오는 길은 만들지 않는다.
//
//   찍음 ──→ 줄임 ──→ (보냄) ──→ 버림
//    └── 이 구간에서만 메모리에 있다 ──┘
//
// 받자마자 줄인다. 그래서 여기가 들고 있는 것은 언제나 "줄어든 사진"이고,
// 원본은 줄인 직후 놓아준다. 보내질 사진과 화면에 보이는 사진이 같아진다.
//
// localStorage · IndexedDB · 서버 · 파일 어디에도 쓰지 않는다.
// 저장하는 코드를 여기에 더하면 안 된다. (CLAUDE.md 2절 절대 규칙 1)
//
// 미리보기 주소(createObjectURL)는 만들면 반드시 거둬들인다(revokeObjectURL).
// 거두지 않으면 사진이 메모리에 계속 남는다 — "버림"이 지켜지지 않는 것이다.
//
// Design Ref: §4.7 사진의 수명
// Design Ref: §4.2 2단계 축소 + EXIF 제거
// Plan SC: S6 기기에 저장되는 사진 0장

import { useCallback, useEffect, useRef, useState } from 'react';
import { shrinkForUpload, SHRINK_OPTIONS } from '@/lib/image';

/** 미리보기 주소를 거둬들인다. 없으면 아무 일도 하지 않는다. */
function revoke(image) {
  if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
}

/**
 * 지금 사진이 어떤 상태인지.
 * 'idle' 없음 / 'shrinking' 줄이는 중 / 'ready' 보낼 준비됨 / 'error' 실패
 */
export const CAMERA_STATUS = {
  IDLE: 'idle',
  SHRINKING: 'shrinking',
  READY: 'ready',
  ERROR: 'error',
};

/**
 * @param shrinkOptions 줄이기 기준. 본문 글자를 읽을 사진(구절)은
 *                      `SHRINK_OPTIONS_TEXT`를 넘긴다 — 더 크고 또렷하게 보내야
 *                      작은 글자가 뭉개지지 않는다.
 */
export function useCameraImage(shrinkOptions = SHRINK_OPTIONS) {
  const [image, setImage] = useState(null);
  const [status, setStatus] = useState(CAMERA_STATUS.IDLE);
  const [errorMessage, setErrorMessage] = useState('');

  // 화면을 떠날 때도 거둬들이려면 지금 무엇을 들고 있는지 알아야 한다.
  // 상태만으로는 떠나는 순간의 값을 알 수 없어서 따로 붙들어 둔다.
  const held = useRef(null);

  // 줄이는 데 시간이 걸린다. 그 사이 다른 사진을 고르거나 지울 수 있으므로,
  // 몇 번째 고른 것인지를 세어 두고 늦게 끝난 옛 작업의 결과는 버린다.
  const pickCount = useRef(0);

  const clear = useCallback(() => {
    pickCount.current += 1; // 진행 중인 줄이기 결과를 버리게 한다
    revoke(held.current);
    held.current = null;
    setImage(null);
    setStatus(CAMERA_STATUS.IDLE);
    setErrorMessage('');
  }, []);

  /**
   * 새로 고른 사진으로 바꾼다. 앞서 들고 있던 사진은 그 자리에서 버린다.
   *
   * @returns 줄이기까지 끝난 사진. 실패했거나 그 사이 다른 사진을 골랐으면 null.
   *          부르는 쪽이 이 값을 받아 바로 인식으로 넘길 수 있게 돌려준다.
   */
  const pick = useCallback(async (file) => {
    const myTurn = (pickCount.current += 1);

    revoke(held.current);
    held.current = null;
    setImage(null);
    setErrorMessage('');

    if (!file) {
      setStatus(CAMERA_STATUS.IDLE);
      return null;
    }

    setStatus(CAMERA_STATUS.SHRINKING);

    try {
      const shrunk = await shrinkForUpload(file, shrinkOptions);

      // 줄이는 사이에 다른 사진을 고르거나 지웠다면 이 결과는 버린다.
      if (myTurn !== pickCount.current) return null;

      const next = {
        file: shrunk,
        previewUrl: URL.createObjectURL(shrunk),
        size: shrunk.size,
        /** 줄이기 전 크기. 얼마나 줄었는지 보여주는 데만 쓴다 */
        originalSize: file.size,
      };
      held.current = next;
      setImage(next);
      setStatus(CAMERA_STATUS.READY);
      return next;
    } catch {
      if (myTurn !== pickCount.current) return null;
      setStatus(CAMERA_STATUS.ERROR);
      // 원문 오류는 보여주지 않는다. Design Ref: §8 오류 처리
      setErrorMessage('사진을 준비하지 못했어요. 다시 해주세요.');
      return null;
    }
    // 넘겨받는 기준은 모듈 상수라 늘 같은 값이다. 이 함수가 새로 만들어지지 않는다.
  }, [shrinkOptions]);

  // 화면을 떠날 때 반드시 버린다.
  // 저장하든 취소하든 뒤로 가든, 결국 이 화면은 사라지므로 여기로 모인다.
  useEffect(() => {
    return () => {
      revoke(held.current);
      held.current = null;
    };
  }, []);

  return { image, status, errorMessage, pick, clear };
}
