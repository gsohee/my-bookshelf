'use client';

// 연말 결산 (작업 35)
//
// 한 해를 한 장으로 돌아본다. 올해 몇 권, 어떤 장르를 많이 읽었나,
// 가장 좋았던 책, 그리고 대표 구절 하나.
//
// **목표 미달 같은 말을 쓰지 않는다.** 적게 읽은 해에도 탓하는 문구를 넣지 않는다.
// (CLAUDE.md 8절 "부정적 상황에 탓하는 문구를 쓰지 않는다")
//
// Design Ref: §3.3⑨ 돌아보기 — 결산
// Design Ref: §4.5 흐름 4

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useBooks, useQuotes, useHydrated } from '@/components/BookStore';
import EmptyState from '@/components/EmptyState';
import { formatRating } from '@/lib/constants';
import {
  summarize,
  countByYear,
  bestRated,
  pickYearQuote,
} from '@/lib/stats';

/** 숫자 하나를 크게 보여주는 칸. */
function Figure({ label, value, note }) {
  return (
    <div className="rounded-xl border border-black/10 px-4 py-3 dark:border-white/15">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
        {value}
      </p>
      {note && (
        <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{note}</p>
      )}
    </div>
  );
}

export default function YearEndPanel() {
  const books = useBooks();
  const quotes = useQuotes();
  const hydrated = useHydrated();

  const years = useMemo(
    () => countByYear(books).map((item) => item.year),
    [books],
  );
  const [picked, setPicked] = useState(null);
  const year = picked ?? years[0] ?? null;

  const stat = useMemo(
    () => (year === null ? null : summarize(books, { year })),
    [books, year],
  );
  const best = useMemo(
    () => (year === null ? [] : bestRated(books, { year })),
    [books, year],
  );
  const highlight = useMemo(
    () => (year === null ? null : pickYearQuote(books, quotes, { year })),
    [books, quotes, year],
  );

  if (!hydrated) return null;

  if (year === null) {
    return (
      <EmptyState
        title="아직 결산할 기록이 없어요."
        description="한 해에 한 권만 끝내도 여기에 남아요."
        actionLabel="서재로 가기"
        actionHref="/"
      />
    );
  }

  const topGenre = stat.byGenre[0] ?? null;
  const topMood = stat.byMood[0] ?? null;
  const topBook = best[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <label htmlFor="yearEndYear" className="sr-only">
          연도 고르기
        </label>
        <select
          id="yearEndYear"
          value={year}
          onChange={(event) => setPicked(Number(event.target.value))}
          className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 outline-none focus:border-black dark:border-white/20 dark:bg-black dark:text-zinc-300"
        >
          {years.map((item) => (
            <option key={item} value={item}>
              {item}년
            </option>
          ))}
        </select>
        <p className="text-sm font-medium text-black dark:text-zinc-50">
          {year}년의 독서
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Figure
          label="읽은 책"
          value={`${stat.finishedRounds}권`}
          note={
            stat.finishedRounds !== stat.finishedBooks
              ? '다시 읽은 것도 셌어요'
              : null
          }
        />
        <Figure
          label="읽은 쪽수"
          value={`${stat.pages.pages.toLocaleString('ko-KR')}쪽`}
          note={
            stat.pages.unknown > 0 ? `쪽수 모르는 ${stat.pages.unknown}권 제외` : null
          }
        />
        <Figure
          label="가장 많이 읽은 장르"
          value={topGenre ? topGenre.genre : '—'}
          note={topGenre ? `${topGenre.count}권` : null}
        />
        <Figure
          label="가장 많았던 분위기"
          value={topMood ? topMood.mood : '—'}
          note={topMood ? `${topMood.count}권` : null}
        />
      </div>

      {/* 가장 좋았던 책 */}
      <section className="rounded-xl border border-black/10 p-4 dark:border-white/15">
        <h3 className="text-sm font-medium text-black dark:text-zinc-50">
          가장 좋았던 책
        </h3>
        {topBook ? (
          <div className="mt-2">
            <Link
              href={`/books/${topBook.book.id}`}
              className="text-base font-medium text-black underline-offset-4 hover:underline dark:text-zinc-50"
            >
              {topBook.book.title}
            </Link>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {[topBook.book.author, formatRating(topBook.rating)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            별점을 매긴 책이 아직 없어요.
          </p>
        )}
      </section>

      {/* 올해의 구절 */}
      <section className="rounded-xl border border-black/10 p-4 dark:border-white/15">
        <h3 className="text-sm font-medium text-black dark:text-zinc-50">
          {year}년의 구절
        </h3>
        {highlight ? (
          <blockquote className="mt-2">
            <p className="whitespace-pre-wrap text-sm leading-7 text-black dark:text-zinc-50">
              “{highlight.quote.text}”
            </p>
            <footer className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              —{' '}
              <Link
                href={`/books/${highlight.book.id}`}
                className="underline-offset-4 hover:underline"
              >
                {highlight.book.title}
              </Link>
              {highlight.quote.page ? ` (${highlight.quote.page}쪽)` : ''}
            </footer>
          </blockquote>
        ) : (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            올해 읽은 책에서 모아둔 구절이 없어요.
          </p>
        )}
      </section>

      {stat.excluded > 0 && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          중단한 책 {stat.excluded}권은 모든 숫자에서 뺐어요.
        </p>
      )}
    </div>
  );
}
