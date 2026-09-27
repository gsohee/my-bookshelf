// 집계
//
// **숫자를 세는 일은 여기서만 한다.**
// 통계(작업 33)·달력(34)·결산(35)·목표 진행률(36)이 모두 이 파일을 거친다.
// 네 화면이 각자 세면 한 곳만 틀려도 숫자가 어긋나고, 어느 쪽이 맞는지 알 수 없다.
// (Design Ref: §4.5 "lib/stats.js가 하나인 이유")
//
// ── 세는 규칙 세 가지 ────────────────────────────────
//
// ① **중단한 책은 빼고 센다.** (S12) 모든 함수가 booksForTotals를 먼저 거친다.
// ② **상태가 아니라 완독 기록(reads[].finishedAt)을 본다.**
//    다시 읽는 중인 책은 상태가 '읽는 중'이지만 지난 회차는 이미 다 읽었다.
// ③ **날짜는 글자로 자른다.** 'YYYY-MM-DD'에서 연·월을 떼어 쓰고 Date로 바꾸지 않는다.
//    Date로 바꾸면 보는 사람의 시간대에 따라 하루가 밀려 12월 31일이 내년이 된다.
//    저장된 날짜는 KST 기준이므로 글자 그대로가 정답이다. (CLAUDE.md 6절)
//
// ── 세는 단위 ────────────────────────────────────────
//
// | 함수 | 단위 | 재독하면 |
// |---|---|---|
// | countFinished | **권** | 한 번으로 센다 |
// | 그 밖의 모든 집계 | **회차(읽은 횟수)** | 두 번으로 센다 |
//
// "올해 3권 읽었다"에서 같은 책을 두 번 읽었다면 3번 읽은 것이 맞다.
// 반면 "내 서재에서 다 읽은 책"은 권 수라 한 권이다. 두 숫자는 뜻이 달라 섞지 않는다.
//
// Design Ref: §4.5 흐름 4 — 통계
// Design Ref: §5.2 "중단 분리"
// Plan SC: S12 중단한 책이 완독 합계에 섞이지 않음

import {
  GENRES,
  MOODS,
  STATUSES_EXCLUDED_FROM_TOTALS,
} from '@/lib/constants';
import { isValidDateString } from '@/lib/date';

// ── 무엇을 셀 것인가 ─────────────────────────────────

/**
 * 이 책을 합계에 넣어도 되는가.
 *
 * **중단한 책은 넣지 않는다.** 끝까지 읽지 않기로 한 책이 "올해 몇 권 읽었나"에
 * 섞이면 숫자가 실제 독서량을 뜻하지 않게 된다.
 * 일시정지는 다시 읽을 생각이 있는 상태라 빼지 않는다 — 아직 완독이 아닐 뿐이다.
 */
export function isCountedInTotals(book) {
  return !STATUSES_EXCLUDED_FROM_TOTALS.includes(book?.status);
}

/** 합계에 넣을 책만 골라낸다. 아래 모든 집계가 이 결과 위에서 센다. */
export function booksForTotals(books) {
  return (books ?? []).filter(isCountedInTotals);
}

/**
 * 'YYYY-MM-DD'에서 연도. 실제로 있는 날짜가 아니면 null.
 *
 * 모양만 보면 `2026-13-99`도 통과해 13월이 생긴다. 손으로 고친 백업을 복원하면
 * 그런 값이 들어올 수 있으므로 달력에 있는 날인지까지 본다.
 */
function yearOf(date) {
  if (!isValidDateString(date)) return null;
  return Number(date.slice(0, 4));
}

/** 'YYYY-MM-DD'에서 월(1~12). 실제로 있는 날짜가 아니면 null. */
function monthOf(date) {
  if (!isValidDateString(date)) return null;
  return Number(date.slice(5, 7));
}

/**
 * **모든 집계의 바탕.** 다 읽은 회차를 하나씩 펼쳐 놓는다.
 *
 * 책 하나에 회차가 여럿일 수 있어(작업 30), 책 목록을 그대로 세면 재독이 사라진다.
 * 그래서 먼저 "완독 기록"의 평평한 목록으로 바꾼 뒤 그 위에서만 센다.
 *
 * @param books  책 목록
 * @param year   주면 그 해에 다 읽은 것만
 * @returns [{ book, read, finishedAt, year, month }]
 */
export function finishedReads(books, { year } = {}) {
  const list = [];

  for (const book of booksForTotals(books)) {
    const reads = Array.isArray(book.reads) ? book.reads : [];

    for (const read of reads) {
      const finishedAt = read?.finishedAt;
      const readYear = yearOf(finishedAt);

      // 날짜가 없거나 모양이 깨진 회차는 "언제 읽었는지 모르는 것"이라 세지 않는다.
      if (readYear === null) continue;
      if (year !== undefined && readYear !== year) continue;

      list.push({
        book,
        read,
        finishedAt,
        year: readYear,
        month: monthOf(finishedAt),
      });
    }
  }

  return list;
}

// ── 권 수 ─────────────────────────────────────────────

/**
 * 다 읽은 책 수. 같은 책을 두 번 읽어도 **한 권**으로 센다.
 * 중단한 책은 합계 대상에서 먼저 빠진다. (S12)
 *
 * 회차 목록에서 책 id를 모아 센다 — 횟수와 권 수가 **같은 기록**을 보게 해야
 * "3번 읽었는데 0권"처럼 서로 어긋나는 숫자가 나오지 않는다.
 */
export function countFinished(books, options) {
  const ids = new Set(finishedReads(books, options).map((item) => item.book.id));
  return ids.size;
}

/** 다 읽은 **횟수**. 재독하면 한 권이 두 번으로 센다. */
export function countFinishedRounds(books, options) {
  return finishedReads(books, options).length;
}

/** 합계에서 뺀 책 수. "왜 숫자가 안 맞지?"에 답할 수 있어야 한다. */
export function countExcluded(books) {
  return (books ?? []).length - booksForTotals(books).length;
}

// ── 묶어 세기 ─────────────────────────────────────────

/**
 * 같은 열쇠끼리 모아 센다.
 * 많은 순으로 줄 세우고, 개수가 같으면 `order`에 적힌 차례를 따른다 —
 * 그래야 화면을 다시 그려도 순서가 춤추지 않는다.
 */
function tally(items, keyOf, order = []) {
  const counts = new Map();

  for (const item of items) {
    const key = keyOf(item);
    if (key === null || key === undefined || key === '') continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const rank = (key) => {
    const index = order.indexOf(key);
    return index === -1 ? order.length : index;
  };

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || rank(a.key) - rank(b.key));
}

/**
 * 연도별 읽은 횟수. **최근 해가 위**로 온다.
 * 읽지 않은 해는 줄이 생기지 않는다 — 빈 해까지 그리면 막대그래프가 헐거워진다.
 *
 * @returns [{ year, count }]
 */
export function countByYear(books) {
  const counts = new Map();

  for (const item of finishedReads(books)) {
    counts.set(item.year, (counts.get(item.year) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year);
}

/**
 * 월별 읽은 횟수. **1월부터 12월까지 12칸을 빠짐없이** 돌려준다.
 * 읽지 않은 달을 빼면 꺾은선 그래프에서 그 달이 없었던 것처럼 이어져 버린다.
 *
 * @returns [{ month: 1..12, count }]
 */
export function countByMonth(books, year) {
  const counts = new Array(12).fill(0);

  for (const item of finishedReads(books, { year })) {
    if (item.month >= 1 && item.month <= 12) counts[item.month - 1] += 1;
  }

  return counts.map((count, index) => ({ month: index + 1, count }));
}

/**
 * 장르별 읽은 횟수. 읽은 것만, 많은 순.
 * 같은 수면 장르 12종의 정해진 차례를 따른다.
 *
 * @returns [{ genre, count }]
 */
export function countByGenre(books, options) {
  return tally(
    finishedReads(books, options),
    (item) => item.book.genre,
    GENRES,
  ).map(({ key, count }) => ({ genre: key, count }));
}

/**
 * 분위기별 읽은 횟수. 감상을 적지 않았거나 분위기를 고르지 않은 회차는 빠진다.
 *
 * @returns [{ mood, count }]
 */
export function countByMood(books, options) {
  return tally(
    finishedReads(books, options),
    (item) => item.read.review?.mood ?? null,
    MOODS,
  ).map(({ key, count }) => ({ mood: key, count }));
}

// ── 페이지 ────────────────────────────────────────────

/**
 * 다 읽은 쪽수의 합.
 *
 * 총 페이지는 **적지 않아도 되는 값**이라(작업 4) 모르는 책이 섞인다.
 * 모르는 책을 0쪽으로 치면 합계가 조용히 작아진다. 그래서 세지 않고,
 * **몇 권을 뺐는지 함께 돌려준다** — 화면이 "쪽수를 적지 않은 N권은 빠졌어요"라고
 * 말할 수 있어야 숫자를 믿을 수 있다.
 *
 * @returns {{ pages: number, counted: number, unknown: number }}
 */
export function sumPages(books, options) {
  let pages = 0;
  let counted = 0;
  let unknown = 0;

  for (const { book } of finishedReads(books, options)) {
    const total = book.totalPages;
    if (Number.isFinite(total) && total > 0) {
      pages += total;
      counted += 1;
    } else {
      unknown += 1;
    }
  }

  return { pages, counted, unknown };
}

// ── 연말 결산이 쓰는 것 (작업 35) ─────────────────────

/**
 * 별점 높은 순으로 줄 세운 완독 기록.
 * 별점이 같으면 **나중에 읽은 것**이 위로 온다 — 최근 기억이 대표에 어울린다.
 *
 * @returns [{ book, read, rating, finishedAt }]
 */
export function bestRated(books, options) {
  return finishedReads(books, options)
    .map((item) => ({ ...item, rating: item.read.review?.rating ?? null }))
    .filter((item) => typeof item.rating === 'number' && item.rating > 0)
    .sort((a, b) => b.rating - a.rating || b.finishedAt.localeCompare(a.finishedAt));
}

/**
 * 그 해를 대표할 구절 하나.
 *
 * **가장 높은 별점을 준 책의 첫 구절**을 고른다. 아무거나 뽑으면 볼 때마다 달라져
 * "올해의 구절"이라는 말이 무색해진다. 별점을 매긴 책이 없으면 그 해에 읽은 책 중
 * 구절이 있는 첫 책에서 가져온다.
 *
 * @returns {{ quote, book }} 또는 null
 */
export function pickYearQuote(books, quotes, options) {
  const list = quotes ?? [];
  const pickFrom = (candidates) => {
    for (const item of candidates) {
      const found = list.find((quote) => quote.bookId === item.book.id);
      if (found) return { quote: found, book: item.book };
    }
    return null;
  };

  return (
    pickFrom(bestRated(books, options)) ??
    pickFrom(finishedReads(books, options))
  );
}

// ── 화면이 한 번에 받아가는 묶음 ──────────────────────

/**
 * 통계 화면(작업 33)이 필요한 숫자를 한 번에 낸다.
 *
 * 화면이 함수를 골라 부르다 보면 어떤 화면은 중단을 빼고 어떤 화면은 안 빼는 일이 생긴다.
 * 한 번에 내주면 그럴 여지가 없다.
 *
 * @param year 주면 그 해만. 없으면 전체 기간
 */
export function summarize(books, { year } = {}) {
  const options = year === undefined ? undefined : { year };

  return {
    year: year ?? null,
    /** 다 읽은 횟수 */
    finishedRounds: countFinishedRounds(books, options),
    /** 다 읽은 책 수 (전체 기간 기준) */
    finishedBooks: countFinished(books),
    /** 합계에서 뺀 중단 책 수 */
    excluded: countExcluded(books),
    byYear: countByYear(books),
    byMonth: year === undefined ? null : countByMonth(books, year),
    byGenre: countByGenre(books, options),
    byMood: countByMood(books, options),
    pages: sumPages(books, options),
  };
}
