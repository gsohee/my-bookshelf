'use client';

// 연간 목표 (작업 36)
//
// 올해 몇 권·몇 쪽을 읽을지 정하고, 지금 얼마나 왔는지 본다.
//
// **미달을 탓하지 않는다.** "목표에 한참 못 미쳐요" 같은 말을 쓰지 않고,
// 지금까지 읽은 것을 먼저 말한다. (CLAUDE.md 8절)
//
// 숫자는 여기서 세지 않는다 — `lib/stats.js`가 낸 값을 받아 쓴다.
//
// Design Ref: §3.3⑧ 데이터 — 연간 목표 설정과 진행률
// Plan SC: S12 중단 분리 (목표 진행률도 같은 규칙을 쓴다)

import { useMemo, useState } from 'react';
import { useBooks, useHydrated } from '@/components/BookStore';
import ErrorNote from '@/components/ErrorNote';
import {
  getSettings,
  saveSettings,
  describeStorageError,
} from '@/lib/storage';
import { summarize } from '@/lib/stats';
import { todayKST } from '@/lib/date';

/** 진행 막대 하나. */
function Progress({ label, done, goal, unit }) {
  // 목표를 넘겨도 막대는 100%에서 멈춘다. 숫자로는 넘긴 만큼 그대로 보여준다.
  const ratio = goal > 0 ? Math.min(done / goal, 1) : 0;
  const percent = Math.round(ratio * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
        <p className="text-sm text-black dark:text-zinc-50">
          {done.toLocaleString('ko-KR')}
          <span className="text-zinc-400 dark:text-zinc-500">
            {' / '}
            {goal.toLocaleString('ko-KR')}
            {unit}
          </span>
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
      >
        <div
          style={{ width: `${percent}%` }}
          className="h-full rounded-full bg-amber-500 transition-[width]"
        />
      </div>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
        {done >= goal ? '목표를 채웠어요' : `${percent}%`}
      </p>
    </div>
  );
}

const inputClass =
  'mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-base text-black outline-none focus:border-black dark:border-white/20 dark:bg-black dark:text-zinc-50 dark:focus:border-zinc-300';

export default function GoalPanel() {
  const books = useBooks();
  const hydrated = useHydrated();
  const year = Number(todayKST().slice(0, 4));

  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // 저장한 뒤 다시 읽게 하는 값. 설정은 BookStore가 지켜보지 않는다.
  const [savedAt, setSavedAt] = useState(0);

  // 설정은 BookStore가 지켜보지 않으므로, 저장한 시각이 바뀔 때만 다시 읽는다.
  // hydrated가 false인 동안에는 아래에서 화면을 그리지 않으므로 값이 쓰이지 않는다.
  const settings = useMemo(() => {
    void savedAt;
    try {
      return getSettings();
    } catch {
      return { yearlyBooks: 0, yearlyPages: 0 };
    }
  }, [savedAt]);

  const [bookGoal, setBookGoal] = useState('');
  const [pageGoal, setPageGoal] = useState('');

  const stat = useMemo(() => summarize(books, { year }), [books, year]);

  if (!hydrated) return null;

  function openEditor() {
    setBookGoal(settings.yearlyBooks > 0 ? String(settings.yearlyBooks) : '');
    setPageGoal(settings.yearlyPages > 0 ? String(settings.yearlyPages) : '');
    setSaveError(null);
    setEditing(true);
  }

  function handleSave(event) {
    event.preventDefault();
    const toNumber = (text) => {
      const value = Number(text.trim());
      return Number.isInteger(value) && value > 0 ? value : 0;
    };

    try {
      saveSettings({
        yearlyBooks: toNumber(bookGoal),
        yearlyPages: toNumber(pageGoal),
      });
      setSavedAt(Date.now());
      setEditing(false);
      setSaveError(null);
    } catch (error) {
      setSaveError(
        describeStorageError(error, '저장하지 못했어요. 잠시 후 다시 해주세요.'),
      );
    }
  }

  const hasGoal = settings.yearlyBooks > 0 || settings.yearlyPages > 0;

  return (
    <section className="rounded-xl border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">
          {year}년 목표
        </h2>
        {!editing && (
          <button
            type="button"
            onClick={openEditor}
            className="rounded-full border border-black/15 px-3 py-1.5 text-xs text-zinc-700 dark:border-white/20 dark:text-zinc-300"
          >
            {hasGoal ? '고치기' : '정하기'}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="mt-3 flex flex-col gap-3">
          <div>
            <label htmlFor="goalBooks" className="text-sm text-zinc-600 dark:text-zinc-400">
              올해 읽을 권수
            </label>
            <input
              id="goalBooks"
              type="number"
              min="0"
              inputMode="numeric"
              value={bookGoal}
              onChange={(event) => setBookGoal(event.target.value)}
              placeholder="비워두면 정하지 않음"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="goalPages" className="text-sm text-zinc-600 dark:text-zinc-400">
              올해 읽을 쪽수
            </label>
            <input
              id="goalPages"
              type="number"
              min="0"
              inputMode="numeric"
              value={pageGoal}
              onChange={(event) => setPageGoal(event.target.value)}
              placeholder="비워두면 정하지 않음"
              className={inputClass}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-black"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-black/15 px-5 py-2.5 text-sm text-zinc-500 dark:border-white/20 dark:text-zinc-400"
            >
              취소
            </button>
          </div>
        </form>
      ) : hasGoal ? (
        <div className="mt-3 flex flex-col gap-4">
          {settings.yearlyBooks > 0 && (
            <Progress
              label="권수"
              done={stat.finishedRounds}
              goal={settings.yearlyBooks}
              unit="권"
            />
          )}
          {settings.yearlyPages > 0 && (
            <Progress
              label="쪽수"
              done={stat.pages.pages}
              goal={settings.yearlyPages}
              unit="쪽"
            />
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          올해 {stat.finishedRounds}권을 읽었어요. 목표를 정하면 여기에 진행률이
          보여요.
        </p>
      )}

      <ErrorNote
        message={saveError?.message}
        code={saveError?.code}
        className="mt-3"
      />
    </section>
  );
}
