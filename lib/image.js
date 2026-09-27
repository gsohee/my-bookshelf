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
 * 줄이기 기준.
 *
 * 글자를 읽어야 하는 사진이라 너무 줄이면 인식이 틀린다.
 * 긴 변 2000px이면 책 표지 제목과 본문 글자가 또렷하게 남는다.
 * 인식 정확도(S2 표지 10권 중 9권 / S3 글자 95%)가 모자라면 이 숫자부터 올린다.
 */
export const SHRINK_OPTIONS = {
  /** 긴 변을 이 길이로 맞춘다 */
  maxWidthOrHeight: 2000,
  /** 결과 파일이 이 크기를 넘지 않게 한다 */
  maxSizeMB: 1,
  /** 사진은 JPEG가 가장 작다 */
  fileType: 'image/jpeg',
  /** 1에 가까울수록 또렷하지만 커진다 */
  initialQuality: 0.85,
};

/**
 * 사진을 줄인 새 파일을 돌려준다. 원본은 건드리지 않는다.
 *
 * @param file 찍거나 고른 사진
 * @returns 줄어든 사진 파일
 */
export async function shrinkForUpload(file) {
  return imageCompression(file, {
    ...SHRINK_OPTIONS,

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
