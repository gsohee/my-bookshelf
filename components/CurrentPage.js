'use client';

// 읽는 중인 책의 현재 페이지 (작업 37)
//
// 읽다 멈춘 자리를 적어 둔다. 총 페이지를 아는 책이면 얼마나 왔는지 막대로 보인다.
//
// **다 읽은 책에는 보이지 않는다.** 끝난 책의 '지금 몇 쪽'은 뜻이 없다.
// 중단한 책에도 보이지 않는다 — 더 읽지 않기로 한 책이다.
//
// Design Ref: §5.2 "book.currentPage — 읽는 중인 책의 현재 페이지"

import { useState } from 'react';
import ErrorNote from '@/components/ErrorNote';
import { notifyBooksChanged } from '@/components/BookStore';
import { setCurrentPage, describeStorageError } from '@/lib/storage';

export default function CurrentPage({ book }) {
  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState('');
  const [saveError, setSaveError] = useState(null);

  const current = Number.isInteger(book.currentPage) ? book.currentPage : null;
  const total =
    Number.isInteger(book.totalPages) && book.totalPages > 0
      ? book.totalPages
      : null;
  const percent =
    current !== null && total !== null
      ? Math.min(Math.round((current / total) * 100), 100)
      : null;

  function open() {
    setPage(current === null ? '' : String(current));
    setSaveError(null);
    setEditing(true);
  }

  function handleSave(event) {
    event.preventDefault();
    const value = Number(page.trim());

    try {
      // 비워서 저장하면 기록을 지운다 — 잘못 적었을 때 되돌릴 길이 있어야 한다.
      setCurrentPage(book.id, Number.isInteger(value) && value > 0 ? value : null);
      notifyBooksChanged();
      setEditing(false);
      setSaveError(null);
    } catch (error) {
      setSaveError(
        describeStorageError(error, '저장하지 못했어요. 잠시 후 다시 해주세요.'),
      );
    }
  }

  return (
    <div className="mt-4 rounded-xl bg-surface-soft px-4 py-3">
      {editing ? (
        <form onSubmit={handleSave} className="flex items-end gap-2">
          <div className="flex-1">
            <label
              htmlFor="currentPage"
              className="text-xs text-muted"
            >
              지금 몇 쪽까지 읽었나요{total !== null && ` (총 ${total}쪽)`}
            </label>
            <input
              id="currentPage"
              type="number"
              min="0"
              inputMode="numeric"
              autoFocus
              value={page}
              onChange={(event) => setPage(event.target.value)}
              placeholder="비워두면 지워요"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus:border-brand"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink"
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full border border-line px-4 py-2.5 text-sm text-muted"
          >
            취소
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted">
              지금 읽은 데까지
            </p>
            <p className="mt-0.5 text-sm text-ink">
              {current === null
                ? '아직 적지 않았어요'
                : `${current}쪽${total !== null ? ` / ${total}쪽` : ''}`}
            </p>
          </div>
          <button
            type="button"
            onClick={open}
            className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-muted"
          >
            {current === null ? '적기' : '고치기'}
          </button>
        </div>
      )}

      {/* 총 페이지를 아는 책만 막대를 그린다. 모르면 끝이 어딘지 알 수 없다 */}
      {!editing && percent !== null && (
        <>
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="읽은 진행률"
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
          >
            <div
              style={{ width: `${percent}%` }}
              className="h-full rounded-full bg-warn-bg0"
            />
          </div>
          <p className="mt-1 text-xs text-faint">
            {percent}%
          </p>
        </>
      )}

      <ErrorNote
        message={saveError?.message}
        code={saveError?.code}
        className="mt-2"
      />
    </div>
  );
}
