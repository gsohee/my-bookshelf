// 나의 책장 — 날짜
//
// 날짜는 전부 한국 시간 기준으로 다루고, 'YYYY-MM-DD' 글자로 저장한다.
// 컴퓨터 시간대가 달라도 같은 날짜가 나오게 하려는 것이다.
//
// Design Ref: §5.2 "날짜는 YYYY-MM-DD 문자열로 저장, 표시할 때 한국 시간 기준"

/** 'en-CA'로 만들면 2026-09-20 모양이 나온다. */
const KST_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 한국 기준 오늘 날짜. 예: '2026-09-20' */
export function todayKST() {
  return KST_FORMATTER.format(new Date());
}

/**
 * 'YYYY-MM-DD' 모양이면서 실제로 있는 날짜인지.
 * 2026-02-30 처럼 모양만 맞는 값을 걸러낸다.
 *
 * 1단계에서는 날짜를 `<input type="date">`로만 받아 아직 부르는 곳이 없다.
 * 백업 파일을 되읽는 복원(작업 27)에서 값을 검사할 때 쓴다 — isValidStatus와 같은 자리다.
 */
export function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
