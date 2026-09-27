'use client';

// 오늘의 구절 (작업 40)
//
// 서재 맨 위에 모아둔 구절 하나를 꺼내 보여준다. 다시 읽으려고 찾아 들어가지 않아도
// 눈에 띄게 하려는 것이다.
//
// ── 어떻게 고르는가 ──────────────────────────────────
//
// **하루 동안은 같은 구절이 보인다.** 무작위로 뽑으면 서재를 드나들 때마다 바뀌어
// "오늘의" 구절이라는 말이 무색해진다. 그래서 날짜(KST)로 자리를 정한다 —
// 같은 날에는 같은 자리가 나오고, 날이 바뀌면 다른 자리가 나온다.
//
// **어제 보여준 구절은 다시 뽑지 않는다.** 최근에 보여준 id를 `ui` 키에 남겨 두고
// 그것만 빼고 고른다. (PRD 작업 40 "같은 구절 연속 노출 금지")
//
// Design Ref: §3.3① 서재 — 오늘의 구절 카드
// Design Ref: §5.1 저장 위치와 키 — ui

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useBooks, useQuotes, useHydrated } from '@/components/BookStore';
import { getUiState, saveUiState } from '@/lib/storage';
import { todayKST } from '@/lib/date';

/** 최근에 보여준 구절 몇 개를 기억할지. 구절이 적어도 막히지 않게 짧게 잡는다. */
const REMEMBER = 3;

/**
 * 날짜 글자를 숫자로 바꾼다. 같은 날이면 늘 같은 숫자가 나온다.
 * 무작위가 아니라 **정해진 값**이어야 하루 동안 같은 구절이 보인다.
 */
function seedOf(text) {
  let seed = 0;
  for (let i = 0; i < text.length; i += 1) {
    seed = (seed * 31 + text.charCodeAt(i)) % 1000003;
  }
  return seed;
}

/** 저장해 둔 화면 상태. 못 읽어도 화면은 떠야 하므로 빈 값으로 넘어간다. */
function readUi() {
  try {
    return getUiState();
  } catch {
    return {};
  }
}

export default function TodayQuote() {
  const quotes = useQuotes();
  const books = useBooks();
  const hydrated = useHydrated();
  const today = todayKST();

  const picked = useMemo(() => {
    if (!hydrated || quotes.length === 0) return null;

    const ui = readUi();

    // 오늘 이미 정해둔 것이 있으면 그대로 쓴다. 새로고침해도 바뀌지 않게 하려는 것이다.
    if (ui.todayQuote?.date === today) {
      const kept = quotes.find((quote) => quote.id === ui.todayQuote.id);
      if (kept) return kept;
      // 그 구절을 지웠으면 아래에서 새로 고른다.
    }

    const recent = Array.isArray(ui.recentQuoteIds) ? ui.recentQuoteIds : [];

    // 최근에 보여준 것을 뺀다. 다 빼서 남는 게 없으면 전체에서 고른다 —
    // 구절이 한두 개뿐일 때 카드가 사라지면 안 된다.
    const fresh = quotes.filter((quote) => !recent.includes(quote.id));
    const pool = fresh.length > 0 ? fresh : quotes;

    return pool[seedOf(today) % pool.length];
    // 구절 수나 날짜가 바뀔 때만 다시 고른다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, quotes.length, today]);

  // 무엇을 보여줬는지 남긴다. 그리는 일과 상관없는 뒷정리라 effect에서 한다.
  useEffect(() => {
    if (picked === null) return;

    const ui = readUi();
    if (ui.todayQuote?.date === today && ui.todayQuote?.id === picked.id) return;

    const recent = Array.isArray(ui.recentQuoteIds) ? ui.recentQuoteIds : [];
    try {
      saveUiState({
        todayQuote: { date: today, id: picked.id },
        recentQuoteIds: [
          picked.id,
          ...recent.filter((id) => id !== picked.id),
        ].slice(0, REMEMBER),
      });
    } catch {
      // 남기지 못해도 화면은 그대로 뜬다. 내일 다른 구절이 안 나올 뿐이다.
    }
  }, [picked, today]);

  if (!hydrated || picked === null) return null;

  const book = books.find((item) => item.id === picked.bookId);

  return (
    <section className="mb-3 rounded-xl bg-surface-soft px-4 py-3">
      <p className="text-xs text-faint">오늘의 구절</p>
      <blockquote className="mt-1.5">
        <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-7 text-ink">
          “{picked.text}”
        </p>
        {book && (
          <footer className="mt-1.5 text-xs text-muted">
            —{' '}
            <Link
              href={`/books/${book.id}`}
              className="underline-offset-4 hover:underline"
            >
              {book.title}
            </Link>
            {picked.page ? ` (${picked.page}쪽)` : ''}
          </footer>
        )}
      </blockquote>
    </section>
  );
}
