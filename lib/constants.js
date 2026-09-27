// 나의 책장 — 고정 목록
//
// 화면 여러 곳이 같은 목록을 쓴다. 여기 한 곳에만 적어 두고 전부 가져다 쓴다.
// 예) 장르 12종은 등록 폼(작업 4) · 책등 색(작업 11) · 정렬(작업 12) · 통계 비율(작업 33)이 함께 본다.
//
// Design Ref: §1.2 "계산은 한 곳" — 같은 목록을 두 화면이 각자 적지 않는다
// Design Ref: §10.1 lib/constants.js 역할

// ── 장르 ──────────────────────────────────────────────

/**
 * 장르 12종. 순서도 의미가 있다 — 등록 폼의 목록 순서이자 장르 정렬(작업 12)의 기준이다.
 * PRD 5절 M1에 적힌 12종을 그대로 옮겼다. 늘리거나 줄이려면 PRD를 먼저 고친다.
 */
export const GENRES = [
  '소설',
  '에세이',
  '인문',
  '사회·경제',
  '과학',
  '자기계발',
  '역사',
  '예술',
  '여행',
  '건강',
  '실용·취미',
  '기타',
];

/** 장르를 못 알아볼 때 기댈 곳. */
export const DEFAULT_GENRE = '기타';

/**
 * 장르별 책등 색.
 *
 * 색 이름(예: 'bg-violet-700')이 아니라 실제 색값을 적는 이유:
 * Tailwind는 코드에 글자로 쓰인 클래스 이름만 찾아서 CSS를 만든다.
 * `bg-${genre}` 처럼 조립한 이름은 못 찾아 색이 빠진다. 그래서 값으로 직접 넘긴다.
 *
 * bg = 책등 바탕색 / fg = 그 위에 얹는 글자색.
 * 흰 글자가 읽히도록 어두운 쪽 색으로 골랐다 (밝은 화면·어두운 화면 모두 동일).
 *
 * Design Ref: §3.3① 책등 카드 — 색 = 장르
 */
export const GENRE_COLORS = {
  '소설': { bg: '#6D28D9', fg: '#FFFFFF' },
  '에세이': { bg: '#BE185D', fg: '#FFFFFF' },
  '인문': { bg: '#92400E', fg: '#FFFFFF' },
  '사회·경제': { bg: '#0F766E', fg: '#FFFFFF' },
  '과학': { bg: '#1D4ED8', fg: '#FFFFFF' },
  '자기계발': { bg: '#C2410C', fg: '#FFFFFF' },
  '역사': { bg: '#78350F', fg: '#FFFFFF' },
  '예술': { bg: '#BE123C', fg: '#FFFFFF' },
  '여행': { bg: '#155E75', fg: '#FFFFFF' },
  '건강': { bg: '#166534', fg: '#FFFFFF' },
  '실용·취미': { bg: '#3F6212', fg: '#FFFFFF' },
  '기타': { bg: '#52525B', fg: '#FFFFFF' },
};

/** 아는 장르인지. 등록 폼과 복원(작업 27)에서 값을 검사할 때 쓴다. */
export function isValidGenre(genre) {
  return GENRES.includes(genre);
}

/**
 * 장르의 책등 색을 꺼낸다.
 * 모르는 값이 들어와도 화면이 비지 않도록 '기타' 색으로 대신한다.
 */
export function getGenreColor(genre) {
  return GENRE_COLORS[genre] ?? GENRE_COLORS[DEFAULT_GENRE];
}

// ── 완독 감상 ─────────────────────────────────────────
//
// 완독 감상 화면(작업 21)에서 버튼으로 고르고,
// 분위기 비율 통계(작업 33)가 같은 목록을 다시 본다.
// Design Ref: §3.3⑤ 완독 감상 화면

/** 분위기 — 하나만 고른다. */
export const MOODS = ['따뜻함', '잔잔함', '긴장감', '무거움', '유쾌함'];

/** 좋았던 점 — 여러 개 고를 수 있다. */
export const LIKED_POINTS = ['문체', '줄거리', '인물', '새로운 지식', '생각할 거리'];

/** 난이도 — 하나만 고른다. */
export const DIFFICULTIES = ['쉬움', '적당', '어려움'];

/**
 * 별점 범위. 작업 31에서 **0.5 단위(0.5~5)** 로 넓어졌다.
 *
 * 1단계에 매긴 정수 별점(1~5)은 그대로 유효한 값이라 고칠 것이 없다.
 * 0.5가 생기면서 "별 하나 = 두 칸"이 됐을 뿐이다.
 *
 * Design Ref: §3.4 완독 감상 체크리스트 "별점 0.5 단위 (0.5~5)"
 */
export const RATING = {
  min: 0.5,
  max: 5,
  step: 0.5,
  /** 별 개수. 한 별이 두 칸(왼쪽 반 = 0.5, 오른쪽 반 = 1)을 맡는다 */
  stars: 5,
};

/** 별점을 화면에 적는 모양. 4 → "4점", 4.5 → "4.5점" */
export function formatRating(rating) {
  if (typeof rating !== 'number' || rating <= 0) return null;
  return `${Number.isInteger(rating) ? rating : rating.toFixed(1)}점`;
}

// ── 책 상태 ───────────────────────────────────────────

/**
 * 책 상태 4종. (작업 29에서 일시정지·중단이 더해졌다)
 *
 * 일시정지와 중단은 뜻이 다르다.
 *   · 일시정지 — 잠깐 멈췄을 뿐 다시 읽을 생각이 있다
 *   · 중단     — 끝까지 읽지 않기로 했다. **합계에서 완독과 분리한다** → stats.js
 *
 * Design Ref: §3.4 서재 체크리스트
 */
export const BOOK_STATUS = {
  READING: '읽는 중',
  FINISHED: '완독',
  PAUSED: '일시정지',
  DROPPED: '중단',
};

/** 서재 필터와 수정 폼에 보일 상태 전체. */
export const BOOK_STATUS_ALL = [
  BOOK_STATUS.READING,
  BOOK_STATUS.FINISHED,
  BOOK_STATUS.PAUSED,
  BOOK_STATUS.DROPPED,
];

/** 새 책을 등록할 때의 상태. */
export const DEFAULT_BOOK_STATUS = BOOK_STATUS.READING;

/**
 * 합계에서 빼야 하는 상태.
 * 중단한 책은 "올해 몇 권 읽었나" 같은 숫자에 섞이면 안 된다.
 * 세는 일은 `lib/stats.js`에서만 하고, 그곳이 이 목록을 본다.
 * Plan SC: S12 중단한 책이 완독 합계에 섞이지 않음
 */
export const STATUSES_EXCLUDED_FROM_TOTALS = [BOOK_STATUS.DROPPED];

/** 아는 상태인지. 복원(작업 27)에서 값을 검사할 때 쓴다. */
export function isValidStatus(status) {
  return BOOK_STATUS_ALL.includes(status);
}
