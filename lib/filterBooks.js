// 서재 거르기
//
// 상태로 서재를 좁혀 본다. 정렬(lib/sortBooks.js)과 짝이 되는 기능이라 따로 둔다.
//
// Design Ref: §3.3① "상태 필터 — 읽는 중 / 완독 / 일시정지 / 중단 4종"

import { BOOK_STATUS_ALL } from '@/lib/constants';

/** 거르지 않고 다 보여주는 값. 상태 이름과 겹치지 않는 말을 골랐다. */
export const STATUS_FILTER_ALL = '전체';

/**
 * 드롭다운에 담을 목록. 작업 29에서 4종으로 늘었다.
 * 상태가 또 늘면 `BOOK_STATUS_ALL` 한 곳만 고치면 여기도 따라온다.
 */
export const STATUS_FILTER_OPTIONS = [STATUS_FILTER_ALL, ...BOOK_STATUS_ALL];

/**
 * 상태로 거른 새 목록을 돌려준다. 받은 목록은 건드리지 않는다.
 * '전체'면 그대로 돌려준다 — 새 배열을 만들지 않아야 화면이 쓸데없이 다시 그려지지 않는다.
 */
export function filterBooksByStatus(books, status) {
  if (status === STATUS_FILTER_ALL) return books;
  return books.filter((book) => book.status === status);
}
