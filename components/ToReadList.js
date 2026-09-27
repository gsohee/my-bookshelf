'use client';

// 읽을 책
//
// 완독 뒤 추천에서 담아둔 책들이다. "읽기 시작"을 누르면 새 책 등록 폼으로
// 제목과 지은이가 채워진 채 넘어간다 — 다시 타이핑하지 않아도 되도록.
//
// 뭐부터 읽을지 고르기 어려울 때를 위해 **랜덤 뽑기**가 있다. (작업 41)
// 고르는 일 자체가 미루는 이유가 되지 않게 하려는 것이다.
//
// Design Ref: §3.3⑦ 읽을 책
// Design Ref: §3.1 화면 지도 — "읽기 시작" → 새 책 폼

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useToRead, useHydrated, notifyBooksChanged } from '@/components/BookStore';
import { deleteToRead, describeStorageError } from '@/lib/storage';
import ErrorNote from '@/components/ErrorNote';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function ToReadList() {
  const toRead = useToRead();
  const hydrated = useHydrated();

  const [askDelete, setAskDelete] = useState(null);
  const [saveError, setSaveError] = useState(null);
  // 랜덤으로 뽑은 책 (작업 41). 누를 때마다 다시 뽑는다.
  const [drawn, setDrawn] = useState(null);

  // 나중에 담은 것이 위로 온다. 방금 담은 책을 먼저 보게 된다.
  const sorted = useMemo(
    () =>
      [...toRead].sort((a, b) =>
        String(b.savedAt ?? '').localeCompare(String(a.savedAt ?? '')),
      ),
    [toRead],
  );

  // 서버에서 그리는 동안에는 저장소가 없어 목록이 비어 보인다.
  if (!hydrated) return null;

  /**
   * 하나 뽑는다. 방금 뽑은 책은 빼고 고른다 —
   * "다시"를 눌렀는데 같은 책이 나오면 눈금뿐인 것처럼 보인다.
   */
  function draw() {
    const pool =
      drawn === null ? sorted : sorted.filter((item) => item.id !== drawn.id);
    const from = pool.length > 0 ? pool : sorted;
    setDrawn(from[Math.floor(Math.random() * from.length)]);
  }

  function handleDelete() {
    try {
      deleteToRead(askDelete.id);
      notifyBooksChanged();
      setAskDelete(null);
      setSaveError(null);
    } catch (error) {
      setAskDelete(null);
      // 원문 오류를 그대로 보여주지 않는다. Design Ref: §8 오류 처리
      setSaveError(
        describeStorageError(error, '지우지 못했어요. 잠시 후 다시 해주세요.'),
      );
    }
  }

  if (sorted.length === 0) {
    return (
      <EmptyState
        title="아직 저장한 책이 없어요."
        description="책을 다 읽으면 추천을 받을 수 있어요."
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {sorted.length}권
        </p>
        {/* 랜덤 뽑기 (작업 41) — 한 권뿐이면 고를 것이 없어 숨긴다 */}
        {sorted.length > 1 && (
          <button
            type="button"
            onClick={draw}
            className="rounded-full border border-black/15 px-3 py-1.5 text-xs text-zinc-700 dark:border-white/20 dark:text-zinc-300"
          >
            🎲 하나 뽑기
          </button>
        )}
      </div>

      {/* 뽑은 책을 맨 위에 보여준다. 목록을 눈으로 찾게 하지 않는다 */}
      {drawn && (
        <div className="mb-3 rounded-xl bg-zinc-100 px-4 py-3 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            오늘은 이 책 어때요?
          </p>
          <p className="mt-1 text-base font-semibold text-black dark:text-zinc-50">
            {drawn.title}
          </p>
          {drawn.author && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {drawn.author}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Link
              href={`/books/new?title=${encodeURIComponent(drawn.title)}&author=${encodeURIComponent(drawn.author ?? '')}`}
              className="flex-1 rounded-full bg-black px-4 py-2.5 text-center text-sm font-semibold text-white dark:bg-zinc-50 dark:text-black"
            >
              이 책 읽기 시작
            </Link>
            <button
              type="button"
              onClick={draw}
              className="rounded-full border border-black/15 px-4 py-2.5 text-sm text-zinc-700 dark:border-white/20 dark:text-zinc-300"
            >
              다시
            </button>
          </div>
        </div>
      )}

      <ErrorNote
        message={saveError?.message}
        code={saveError?.code}
        className="mb-3"
      />

      <ul className="flex flex-col gap-3">
        {sorted.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-black/10 p-3 dark:border-white/15"
          >
            <p className="text-sm font-semibold text-black dark:text-zinc-50">
              {item.title}
            </p>
            {item.author && (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {item.author}
              </p>
            )}
            {item.reason && (
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {item.reason}
              </p>
            )}

            <div className="mt-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAskDelete(item)}
                className="text-xs text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
              >
                지우기
              </button>
              {/*
                제목·지은이를 주소에 실어 보낸다. 등록 폼이 그 값으로 입력칸을 채운다.
                바로 저장되지는 않는다 — 장르와 쪽수를 고르고 사람이 저장을 누른다.
              */}
              <Link
                href={`/books/new?title=${encodeURIComponent(item.title)}&author=${encodeURIComponent(item.author ?? '')}`}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-black"
              >
                읽기 시작
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {/* 지우기 전에 반드시 묻는다. Design Ref: §8 "삭제 전 확인창" */}
      <ConfirmDialog
        open={askDelete !== null}
        title="목록에서 지울까요?"
        description={`『${askDelete?.title ?? ''}』을(를) 읽을 책에서 지웁니다.`}
        confirmLabel="지우기"
        cancelLabel="그대로 두기"
        onConfirm={handleDelete}
        onCancel={() => setAskDelete(null)}
      />
    </div>
  );
}
