'use client';

// 달력 보기 (작업 34)
//
// 완독일에 책등을 세워 "이 달에 이만큼 읽었구나"를 한눈에 본다.
//
// **날짜는 글자로 다룬다.** 'YYYY-MM-DD'를 그대로 견주고, 달력 칸을 만들 때만
// 날짜 계산을 쓴다. Date로 바꿔 비교하면 보는 사람의 시간대에 따라 하루가 밀린다.
// 저장된 날짜는 KST 기준이므로 글자 그대로가 정답이다. (CLAUDE.md 6절)
//
// Design Ref: §3.3⑨ 돌아보기 — 달력
// Design Ref: §4.5 흐름 4

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useBooks, useHydrated } from '@/components/BookStore';
import EmptyState from '@/components/EmptyState';
import { getGenreColor } from '@/lib/constants';
import { finishedReads } from '@/lib/stats';
import { todayKST } from '@/lib/date';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM' 두 조각. 달을 옮길 때 숫자로 다루기 위해 떼어 둔다. */
function splitMonth(value) {
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) };
}

/** 숫자 두 개를 'YYYY-MM'으로. */
function joinMonth(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** 그 달이 며칠까지 있는지. 다음 달 0일 = 이번 달 마지막 날. */
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 그 달 1일이 무슨 요일인지 (0=일). 달력 첫 줄의 빈칸 수가 된다. */
function firstWeekday(year, month) {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

export default function CalendarPanel() {
  const books = useBooks();
  const hydrated = useHydrated();

  // 처음 열면 이번 달. 기록이 없어도 이번 달을 보여준다 — 지금이 기준점이다.
  const [month, setMonth] = useState(() => todayKST().slice(0, 7));

  /** 날짜 → 그날 다 읽은 책들. 달력 칸마다 목록을 다시 훑지 않기 위해 한 번만 만든다. */
  const byDate = useMemo(() => {
    const map = new Map();
    for (const item of finishedReads(books)) {
      const list = map.get(item.finishedAt) ?? [];
      list.push(item);
      map.set(item.finishedAt, list);
    }
    return map;
  }, [books]);

  if (!hydrated) return null;

  if (byDate.size === 0) {
    return (
      <EmptyState
        title="아직 다 읽은 책이 없어요."
        description="책을 끝내면 그날 달력에 책등이 꽂혀요."
        actionLabel="서재로 가기"
        actionHref="/"
      />
    );
  }

  const { year, month: m } = splitMonth(month);
  const blanks = firstWeekday(year, m);
  const days = daysInMonth(year, m);

  /** 달을 옮긴다. 12월 다음은 다음 해 1월이다. */
  function shift(step) {
    const next = new Date(Date.UTC(year, m - 1 + step, 1));
    setMonth(joinMonth(next.getUTCFullYear(), next.getUTCMonth() + 1));
  }

  const monthTotal = [...byDate.entries()]
    .filter(([date]) => date.startsWith(month))
    .reduce((sum, [, list]) => sum + list.length, 0);

  const navButton =
    'rounded-full border border-line px-3 py-1.5 text-sm text-muted';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => shift(-1)} className={navButton}>
          ←
        </button>
        <p className="text-sm font-medium text-ink">
          {year}년 {m}월
          <span className="ml-2 text-xs font-normal text-muted">
            {monthTotal}권
          </span>
        </p>
        <button type="button" onClick={() => shift(1)} className={navButton}>
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day) => (
          <p
            key={day}
            className="py-1 text-[11px] text-faint"
          >
            {day}
          </p>
        ))}

        {/* 1일이 무슨 요일인지에 맞춰 앞을 비운다 */}
        {Array.from({ length: blanks }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}

        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const date = `${month}-${String(day).padStart(2, '0')}`;
          const list = byDate.get(date) ?? [];

          return (
            <div
              key={date}
              className="flex min-h-12 flex-col items-center gap-1 rounded-lg border border-line-soft py-1"
            >
              <span className="text-[11px] text-muted">
                {day}
              </span>
              {/* 그날 다 읽은 책을 책등처럼 세워 둔다. 색은 서재와 같은 장르 색 */}
              <span className="flex flex-wrap items-end justify-center gap-0.5">
                {list.map((item) => (
                  <Link
                    key={`${item.book.id}-${item.read.round}`}
                    href={`/books/${item.book.id}`}
                    title={item.book.title}
                    aria-label={`${item.book.title} — ${date}`}
                    style={{ backgroundColor: getGenreColor(item.book.genre).bg }}
                    className="block h-4 w-1.5 rounded-sm"
                  />
                ))}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-faint">
        색 막대 하나가 그날 다 읽은 책이에요. 누르면 그 책으로 갑니다.
      </p>
    </div>
  );
}
