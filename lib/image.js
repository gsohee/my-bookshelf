// 사진 줄이기
//
// 찍은 사진을 보내기 전에 작게 만든다. 메모리에서만 하고 어디에도 저장하지 않는다.
//
// 줄이는 까닭이 셋이다.
//   1. 휴대폰 사진은 3~5MB라 그대로 보내면 서버가 받지 못한다 (DESIGN §7.2)
//   2. 통신이 빨라져 "30초 안에 등록"(S1)을 지킬 수 있다
//   3. 줄이는 과정에서 위치정보(EXIF)가 지워진다 — 사진 찍은 장소가 밖으로 나가지 않는다
//
// Design Ref: §4.2 2단계 "축소 + EXIF(위치정보) 제거"
// Design Ref: §7.2 Vercel 요청 크기 제한
// Plan SC: S6 기기에 저장되는 사진 0장

import imageCompression from 'browser-image-compression';

/**
 * 줄이기 기준 — 표지처럼 **큰 글자**를 읽을 때.
 *
 * 제목은 글자가 커서 조금 뭉개져도 읽힌다.
 */
export const SHRINK_OPTIONS = {
  /** 긴 변을 이 길이로 맞춘다 */
  maxWidthOrHeight: 2000,
  /** 결과 파일이 이 크기를 넘지 않게 한다 */
  maxSizeMB: 1.5,
  /** 사진은 JPEG가 가장 작다 */
  fileType: 'image/jpeg',
  /** 1에 가까울수록 또렷하지만 커진다 */
  initialQuality: 0.9,
};

/**
 * 줄이기 기준 — 구절처럼 **작은 본문 글자**를 읽을 때.
 *
 * ★ 크게 보내면 더 잘 읽을 줄 알았는데 반대였다. ★
 * 한글 본문 한 쪽(654자)을 세 번씩 읽혀 글자 단위로 견준 결과:
 *
 *   2000px · 화질 0.40   99.8%
 *   2000px · 화질 0.92  100.0%   ← 가장 나았다
 *   2048px · 화질 0.95   94.4%
 *   2600px · 화질 0.95   91.5%
 *
 * OpenAI가 긴 변 2048px에 맞춰 **자기가 한 번 더 줄이기** 때문으로 보인다.
 * 그 선을 넘겨 보내면 줄이는 일이 두 번 일어나 글자가 더 뭉개진다.
 * 그래서 **길이는 표지와 같이 2000px로 두고, 화질만 올린다.**
 * 1MB에 맞추느라 화질이 내려가면 한글은 획이 촘촘해 알파벳보다 먼저 뭉개진다.
 */
export const SHRINK_OPTIONS_TEXT = {
  maxWidthOrHeight: 2000,
  maxSizeMB: 2,
  fileType: 'image/jpeg',
  initialQuality: 0.92,
};

/**
 * 사진을 줄인 새 파일을 돌려준다. 원본은 건드리지 않는다.
 *
 * @param file    찍거나 고른 사진
 * @param options 줄이기 기준. 본문 글자를 읽을 사진은 SHRINK_OPTIONS_TEXT를 쓴다
 * @returns 줄어든 사진 파일
 */
export async function shrinkForUpload(file, options = SHRINK_OPTIONS) {
  return imageCompression(file, {
    ...options,

    // 위치정보를 남기지 않는다. 기본값도 false지만 중요한 규칙이라 드러내 적는다.
    // (PRD 7절 "전송 전 축소 과정에서 위치정보(EXIF) 제거")
    preserveExif: false,

    // 일부러 끈다.
    // 켜면 이 라이브러리가 자기 자신을 인터넷(jsdelivr CDN)에서 받아온다.
    // 우리가 밖으로 내보내기로 정한 것은 인식용 사진과 추천용 항목뿐이고(PRD 7절),
    // 인터넷이 없을 때도 앱이 멈추면 안 되므로 전부 이 기기 안에서 처리한다.
    // 대신 줄이는 동안 화면이 잠깐 멈추므로 "줄이는 중"을 보여준다.
    useWebWorker: false,
  });
}

/** 파일 크기를 사람이 읽는 말로. 예: 3.2MB, 480KB */
export function readableSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
