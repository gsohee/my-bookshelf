'use client';

// 구절 한 개
//
// 페이지 · 구절 본문 · 내 생각을 보여주고, 고치거나 지울 수 있다.
// 고칠 때는 같은 자리에서 입력 폼으로 바뀐다 — 화면을 옮기지 않아야 어디를
// 고치는 중인지 잃지 않는다.
//
// 복사 버튼은 **한 번 누르면 끝난다** — 고르거나 확인하는 단계를 두지 않는다. (작업 28)
// 출처(책 제목·지은이·쪽)까지 함께 담아야 블로그에 붙인 뒤 다시 찾아 적지 않는다.
//
// Design Ref: §3.3③ 책 상세 — 구절 목록
// Design Ref: §10.1 components/QuoteCard.js
// Plan SC: S8 블로그용 구절 복사 클릭 1회

import { useRef, useState } from 'react';
import { deleteQuote, describeStorageError } from '@/lib/storage';
import ErrorNote from '@/components/ErrorNote';
import { notifyBooksChanged } from '@/components/BookStore';
import QuoteForm from '@/components/QuoteForm';
import ConfirmDialog from '@/components/ConfirmDialog';
import { quoteToText } from '@/lib/exportFile';
import { copyText } from '@/lib/clipboard';

/** "복사했어요"를 보여줄 시간. 눈에 들어오되 거슬리지 않을 만큼. */
const COPIED_MS = 2000;

/** 지울지 물을 때 보여줄 구절 앞머리. 너무 길면 줄인다. */
function shorten(text, max = 20) {
  const one = String(text ?? '').replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max)}…` : one;
}

/**
 * @param quote     보여줄 구절
 * @param book      이 구절이 나온 책. 복사할 때 출처로 쓴다
 * @param onPickTag 태그를 눌렀을 때. 태그로 모아보기에 쓴다 (작업 39)
 */
export default function QuoteCard({ quote, book, onPickTag }) {
  const [editing, setEditing] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);

  /**
   * 구절을 붙여넣을 수 있는 자리(클립보드)에 담는다.
   *
   * 확인창도 고르기도 없다 — 누르는 순간 끝나야 "클릭 1회"다. (S8)
   * 담긴 뒤에는 잠깐 "복사했어요"를 보여준다. 눌렀는데 아무 일도 안 일어난 것처럼
   * 보이면 사용자는 다시 누르게 된다.
   */
  async function handleCopy() {
    const ok = await copyText(quoteToText(quote, book));

    if (!ok) {
      // 두 방법 모두 막혔다. 원문 오류 대신 다음에 할 일을 알려준다.
      // Design Ref: §8 오류 처리
      setCopied(false);
      setSaveError({
        message: '복사하지 못했어요. 구절을 직접 끌어서 복사해주세요.',
      });
      return;
    }

    setSaveError(null);
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }

  function handleDelete() {
    try {
      deleteQuote(quote.id);
      notifyBooksChanged();
      setAskDelete(false);
    } catch (error) {
      setAskDelete(false);
      // 원문 오류를 그대로 보여주지 않는다. Design Ref: §8 오류 처리
      setSaveError(
        describeStorageError(error, '지우지 못했어요. 잠시 후 다시 해주세요.'),
      );
    }
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-line p-3">
        <QuoteForm
          bookId={quote.bookId}
          quote={quote}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-line-soft p-3">
      <p className="text-xs text-faint">
        {quote.page ? `${quote.page}쪽` : '쪽수 없음'}
      </p>

      {/* 줄바꿈을 적은 그대로 보여준다 */}
      <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-ink">
        {quote.text}
      </p>

      {quote.thought && (
        <p className="mt-2 whitespace-pre-wrap border-l-2 border-line-soft pl-3 text-sm leading-6 text-muted">
          {quote.thought}
        </p>
      )}

      {/* 태그 (작업 39) — 누르면 그 태그만 모아본다 */}
      {Array.isArray(quote.tags) && quote.tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {quote.tags.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => onPickTag?.(tag)}
                className="rounded-full bg-surface-soft px-2.5 py-1 text-xs text-muted"
              >
                #{tag}
              </button>
            </li>
          ))}
        </ul>
      )}

      <ErrorNote
        message={saveError?.message}
        code={saveError?.code}
        className="mt-2"
      />

      <div className="mt-3 flex items-center justify-end gap-3">
        {/* 복사 — 한 번 누르면 끝난다. 가장 자주 쓰는 동작이라 가장 왼쪽에 둔다 */}
        <button
          type="button"
          onClick={handleCopy}
          aria-live="polite"
          className="mr-auto rounded-full border border-line px-3 py-1.5 text-xs text-muted"
        >
          {copied ? '복사했어요' : '복사'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-muted underline-offset-4 hover:underline"
        >
          고치기
        </button>
        <button
          type="button"
          onClick={() => setAskDelete(true)}
          className="text-xs text-danger underline-offset-4 hover:underline"
        >
          지우기
        </button>
      </div>

      {/* 지우기 전에 반드시 묻는다. Design Ref: §8 "삭제 전 확인창" */}
      <ConfirmDialog
        open={askDelete}
        title="이 구절을 지울까요?"
        description={`“${shorten(quote.text)}” 을(를) 지웁니다. 되돌릴 수 없어요.`}
        confirmLabel="지우기"
        cancelLabel="그대로 두기"
        onConfirm={handleDelete}
        onCancel={() => setAskDelete(false)}
      />
    </li>
  );
}
