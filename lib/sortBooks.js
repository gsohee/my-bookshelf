// 서재 정렬
//
// 서재를 어떤 차례로 보여줄지 정한다.
// 누를 때마다 다음 기준으로 넘어가고, 마지막 다음은 다시 처음이다.
//
// Design Ref: §3.3① "정렬 토글 버튼 — 시작일 → 완독일 → 장르 → 제목 순환"
// Plan SC: S5 서재 정렬 전환 클릭 1회

import { GENRES } from '@/lib/constants';

/**
 * 정렬 기준과 순환 차례.
 *
 * 이름에 방향을 넣었다. "시작일순"만으로는 최근이 앞인지 뒤인지 알 수 없어서다.
 * 장르는 가나다가 아니라 GENRES에 적힌 차례를 따른다 — 등록 폼 목록과 같은 순서라
 * 눈에 익은 차례가 된다.
 */
export const SORT_ORDERS = [
  { key: 'startedAt', label: '최근 시작순' },
  { key: 'finishedAt', label: '최근 완독순' },
  { key: 'genre', label: '장르순' },
  { key: 'title', label: '제목순' },
];

export const DEFAULT_SORT = SORT_ORDERS[0].key;

/** 다음 정렬 기준. 마지막이면 처음으로 돌아간다. */
export function nextSortKey(key) {
  const index = SORT_ORDERS.findIndex((order) => order.key === key);
  return SORT_ORDERS[(index + 1) % SORT_ORDERS.length].key;
}

/** 버튼에 적을 이름. */
export function sortLabel(key) {
  return (
    SORT_ORDERS.find((order) => order.key === key)?.label ?? SORT_ORDERS[0].label
  );
}

/** 마지막 회차. 시작일과 완독일이 여기 들어 있다. */
function lastRead(book) {
  return book?.reads?.[book.reads.length - 1] ?? {};
}

/**
 * 날짜를 최근이 앞에 오게 견준다.
 * 날짜가 없는 책(아직 안 끝낸 책)은 맨 뒤로 보낸다 —
 * 구절 모아보기에서 페이지 없는 구절을 뒤로 보내는 것과 같은 규칙이다.
 * 'YYYY-MM-DD' 글자는 그대로 견주어도 날짜 차례가 된다.
 */
function compareDateDesc(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return b.localeCompare(a);
}

function compareByKey(a, b, key) {
  switch (key) {
    case 'finishedAt':
      return compareDateDesc(lastRead(a).finishedAt, lastRead(b).finishedAt);
    case 'genre':
      return GENRES.indexOf(a.genre) - GENRES.indexOf(b.genre);
    case 'title':
      return String(a.title).localeCompare(String(b.title), 'ko');
    case 'startedAt':
    default:
      return compareDateDesc(lastRead(a).startedAt, lastRead(b).startedAt);
  }
}

/**
 * 정렬한 새 목록을 돌려준다. 받은 목록은 건드리지 않는다.
 *
 * 기준이 같을 때는 나중에 등록한 책이 앞에 오고, 그것도 같으면 제목 차례로 둔다.
 * 그래야 같은 목록을 다시 정렬해도 차례가 흔들리지 않는다.
 */
export function sortBooks(books, key) {
  return [...books].sort((a, b) => {
    const byKey = compareByKey(a, b, key);
    if (byKey !== 0) return byKey;

    const byCreated = String(b.createdAt ?? '').localeCompare(
      String(a.createdAt ?? ''),
    );
    if (byCreated !== 0) return byCreated;

    return String(a.title).localeCompare(String(b.title), 'ko');
  });
}
