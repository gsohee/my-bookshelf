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
 *
 * **파스텔 12색.** 석양 진 어두운 바탕 위에 은은하게 떠오르도록 밝은 쪽으로 골랐다.
 * 밝으므로 글자는 같은 계열의 **어두운 색**을 짝지어 둔다 — 색마다 따로 정한 이유다.
 * 밝은 화면·어두운 화면 모두 같은 값을 쓴다. 책등 색은 장르를 가리키는 표시이지
 * 화면 밝기에 따라 달라질 값이 아니기 때문이다.
 *
 * Design Ref: §3.3① 책등 카드 — 색 = 장르
 */
export const GENRE_COLORS = {
  '소설': { bg: '#F6B8C6', fg: '#4A2A33' },
  '에세이': { bg: '#F8CBA6', fg: '#4A3325' },
  '인문': { bg: '#EBD9A3', fg: '#463C22' },
  '사회·경제': { bg: '#BFE3C8', fg: '#264534' },
  '과학': { bg: '#AFD6F0', fg: '#233F52' },
  '자기계발': { bg: '#FFD8A3', fg: '#4B3820' },
  '역사': { bg: '#D9C3A9', fg: '#453629' },
  '예술': { bg: '#DDBCE8', fg: '#432E4C' },
  '여행': { bg: '#A9DDEA', fg: '#204450' },
  '건강': { bg: '#BCE6D3', fg: '#22473A' },
  '실용·취미': { bg: '#D7E4A6', fg: '#3C4526' },
  '기타': { bg: '#DCD5D1', fg: '#3F3733' },
};

/**
 * 책등에 쓸 **장르별 네 가지 색조** — 옅은 것부터 짙은 것까지.
 *
 * 왜 장르마다 넷인가: 전부 파스텔 한 벌로만 두면 책장이 색표처럼 납작해 보인다.
 * 짙은 책이 섞여야 진짜 책장 같다. 그렇다고 색을 무작정 흩뿌리면
 * "색 = 장르"라는 약속(§3.3①)이 깨져 달력·통계와 따로 놀게 된다.
 *
 * 그래서 **색맡은 장르가, 짙기는 책이** 정한다 — 같은 장르는 같은 계열이되
 * 책마다 농도가 다르다. 어느 색이 걸릴지는 책 고유번호로 정해 늘 같다.
 *
 * fg는 그 바탕 위에서 읽히는 글자색이다. 짙은 바탕에는 밝은 글자가 온다.
 */
export const GENRE_SHADES = {
  '소설': [
    { bg: '#F9CCD7', fg: '#4A2A33' },
    { bg: '#F0A0B4', fg: '#40222B' },
    { bg: '#D2708C', fg: '#FFF4F6' },
    { bg: '#9C4560', fg: '#FDEBF0' },
  ],
  '에세이': [
    { bg: '#FAD9BD', fg: '#4A3325' },
    { bg: '#F2B384', fg: '#432E1F' },
    { bg: '#D68A50', fg: '#FFF6EE' },
    { bg: '#9E5A28', fg: '#FDEEE0' },
  ],
  '인문': [
    { bg: '#EFE0B4', fg: '#463C22' },
    { bg: '#DEC77E', fg: '#3E351D' },
    { bg: '#BFA24C', fg: '#FFFBEE' },
    { bg: '#8A7128', fg: '#FBF4DD' },
  ],
  '사회·경제': [
    { bg: '#CCE9D3', fg: '#264534' },
    { bg: '#9CD2AC', fg: '#20402F' },
    { bg: '#66AC7E', fg: '#F2FBF4' },
    { bg: '#3B7552', fg: '#E9F7ED' },
  ],
  '과학': [
    { bg: '#BFDFF4', fg: '#233F52' },
    { bg: '#8FC4E8', fg: '#1E3848' },
    { bg: '#548FC4', fg: '#F0F8FF' },
    { bg: '#2C5C8A', fg: '#E6F1FA' },
  ],
  '자기계발': [
    { bg: '#FFE0B6', fg: '#4B3820' },
    { bg: '#FBC178', fg: '#45331C' },
    { bg: '#E09A3E', fg: '#FFF8EC' },
    { bg: '#A96C18', fg: '#FDF1DC' },
  ],
  '역사': [
    { bg: '#E2D0BB', fg: '#453629' },
    { bg: '#C8AC8C', fg: '#3D3024' },
    { bg: '#A4825E', fg: '#FBF4EB' },
    { bg: '#70543A', fg: '#F6EDE2' },
  ],
  '예술': [
    { bg: '#E6CCEE', fg: '#432E4C' },
    { bg: '#CDA3DE', fg: '#3C2945' },
    { bg: '#A876C0', fg: '#FBF3FE' },
    { bg: '#754A8C', fg: '#F4E9FA' },
  ],
  '여행': [
    { bg: '#BEE6F1', fg: '#204450' },
    { bg: '#8CCFE2', fg: '#1C3C47' },
    { bg: '#4FA3BC', fg: '#F0FAFD' },
    { bg: '#2A6B80', fg: '#E7F5F9' },
  ],
  '건강': [
    { bg: '#CBEDDC', fg: '#22473A' },
    { bg: '#9BD9BC', fg: '#1E4034' },
    { bg: '#5FAF8B', fg: '#F1FBF6' },
    { bg: '#367760', fg: '#E8F6EF' },
  ],
  '실용·취미': [
    { bg: '#E1EBB8', fg: '#3C4526' },
    { bg: '#C7D889', fg: '#363E22' },
    { bg: '#9CB055', fg: '#F9FCEE' },
    { bg: '#6B7F2E', fg: '#F2F7E2' },
  ],
  '기타': [
    { bg: '#E4DEDA', fg: '#3F3733' },
    { bg: '#C7BEB8', fg: '#39322E' },
    { bg: '#9C918A', fg: '#FAF7F5' },
    { bg: '#6B615B', fg: '#F4F0EE' },
  ],
};

/**
 * 책등 색 하나를 고른다.
 *
 * @param genre 장르 — 색 계열을 정한다
 * @param shade 0~3. 책 고유번호로 정한 값을 넣는다. 클수록 짙다
 */
export function getSpineColor(genre, shade) {
  const shades = GENRE_SHADES[genre] ?? GENRE_SHADES[DEFAULT_GENRE];
  return shades[((shade % shades.length) + shades.length) % shades.length];
}

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
