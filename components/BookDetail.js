'use client';

// 책 상세
//
// 한 권의 정보를 보여주고, 고치거나 지울 수 있다.
// [다 읽었어요](작업 20)와 구절 모아보기(작업 16~19)는 이 아래에 들어올 자리다.
//
// Design Ref: §3.3③ 책 상세
// Design Ref: §3.4 "책 상세" 화면 요소 체크리스트

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useBooks,
  useQuotes,
  useHydrated,
  notifyBooksChanged,
} from '@/components/BookStore';
import {
  deleteBook,
  finishReading,
  startReread,
  describeStorageError,
} from '@/lib/storage';
import ErrorNote from '@/components/ErrorNote';
import { getGenreColor, BOOK_STATUS, formatRating } from '@/lib/constants';
import BookForm from '@/components/BookForm';
import ConfirmDialog from '@/components/ConfirmDialog';
import QuoteCard from '@/components/QuoteCard';
import EmptyState from '@/components/EmptyState';
import CurrentPage from '@/components/CurrentPage';
import { sortQuotes } from '@/lib/sortQuotes';

/** "저자 · 소설 · 320쪽"처럼 빈 값은 빼고 가운뎃점으로 잇는다. */
function joinParts(parts) {
  return parts.filter(Boolean).join(' · ');
}

/**
 * 완독일이 없을 때 그 자리에 적을 말. 상태마다 뜻이 다르다. (작업 29)
 * 중단한 책에 "아직 읽는 중"이라고 적으면 사실과 다르다.
 */
function notFinishedLabel(status) {
  if (status === BOOK_STATUS.PAUSED) return '잠시 멈춤';
  if (status === BOOK_STATUS.DROPPED) return '읽지 않음';
  return '아직 읽는 중';
}

export default function BookDetail({ id }) {
  const router = useRouter();
  const books = useBooks();
  const quotes = useQuotes();
  const hydrated = useHydrated();

  const [editing, setEditing] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [askReread, setAskReread] = useState(false);
  // 태그로 거르기 (작업 39). null이면 전체를 본다.
  const [tagFilter, setTagFilter] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // 서버에서 그리는 동안에는 저장소가 없어 서재가 비어 보인다.
  // 그때 "없는 책"이라고 단정하면 있는 책도 잠깐 없는 것처럼 깜빡인다.
  if (!hydrated) return null;

  const book = books.find((item) => item.id === id);

  if (!book) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          그런 책을 찾지 못했어요.
        </p>
        <Link
          href="/"
          className="rounded-full border border-black/15 px-5 py-2 text-sm text-zinc-700 dark:border-white/20 dark:text-zinc-300"
        >
          서재로 가기
        </Link>
      </div>
    );
  }

  const reads = book.reads ?? [];
  const currentRead = reads[reads.length - 1] ?? {};
  const rating = currentRead.review?.rating ?? null;
  const hasReview = currentRead.review != null;
  // 아직 끝낼 수 있는 책인가. 일시정지도 다시 집어 들어 끝낼 수 있다. (작업 29)
  const isReadable =
    book.status === BOOK_STATUS.READING || book.status === BOOK_STATUS.PAUSED;
  const { bg } = getGenreColor(book.genre);
  // 페이지 순으로 줄 세운다. 페이지를 비운 구절은 맨 뒤로 간다.
  const bookQuotes = sortQuotes(
    quotes.filter(
      (quote) =>
        quote.bookId === book.id &&
        (tagFilter === null ||
          (Array.isArray(quote.tags) && quote.tags.includes(tagFilter))),
    ),
  );

  /**
   * 다 읽었다고 표시하고, 감상을 고르는 화면으로 넘어간다.
   * Design Ref: §4.4 흐름 3 — "완독 → 감상 선택 화면"
   */
  function handleFinish() {
    try {
      finishReading(book.id);
      notifyBooksChanged();
      setSaveError(null);
      router.push(`/books/${book.id}/finish`);
    } catch (error) {
      // 원문 오류를 그대로 보여주지 않는다. Design Ref: §8 오류 처리
      setSaveError(
        describeStorageError(error, '바꾸지 못했어요. 잠시 후 다시 해주세요.'),
      );
    }
  }

  /**
   * 다시 읽기 시작한다. 새 회차가 붙고 상태가 '읽는 중'으로 돌아간다. (작업 30)
   * 지난 회차의 날짜와 별점은 그대로 남는다.
   */
  function handleReread() {
    try {
      startReread(book.id);
      notifyBooksChanged();
      setAskReread(false);
      setSaveError(null);
    } catch (error) {
      setAskReread(false);
      setSaveError(
        describeStorageError(error, '바꾸지 못했어요. 잠시 후 다시 해주세요.'),
      );
    }
  }

  function handleDelete() {
    try {
      deleteBook(book.id);
      notifyBooksChanged();
      setAskDelete(false);
      router.push('/');
    } catch (error) {
      setAskDelete(false);
      setSaveError(
        describeStorageError(error, '지우지 못했어요. 잠시 후 다시 해주세요.'),
      );
    }
  }

  // 고치는 중에는 같은 폼을 수정 모드로 보여준다.
  if (editing) {
    return (
      <div className="flex flex-1 flex-col">
        <h2 className="mb-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          책 고치기
        </h2>
        <BookForm book={book} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* 서재로 돌아가기 */}
      <Link
        href="/"
        className="mb-3 inline-flex w-fit items-center gap-1 text-sm text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        ← 서재
      </Link>

      {/* 제목 — 장르 색을 왼쪽에 띠로 둬서 서재의 책등과 이어 보이게 한다 */}
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          style={{ backgroundColor: bg }}
          className="w-1.5 shrink-0 rounded-full"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold leading-8 tracking-tight text-black dark:text-zinc-50">
            {book.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {joinParts([
              book.author,
              book.genre,
              book.totalPages ? `${book.totalPages}쪽` : null,
            ])}
          </p>
        </div>
      </div>

      {/* 상태와 날짜 */}
      <dl className="mt-5 space-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-zinc-500 dark:text-zinc-400">상태</dt>
          <dd className="text-black dark:text-zinc-50">{book.status}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-zinc-500 dark:text-zinc-400">시작일</dt>
          <dd className="text-black dark:text-zinc-50">
            {currentRead.startedAt ?? '—'}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-zinc-500 dark:text-zinc-400">완독일</dt>
          <dd className="text-black dark:text-zinc-50">
            {currentRead.finishedAt ?? notFinishedLabel(book.status)}
          </dd>
        </div>
        {/* 별점은 완독 감상(작업 21)에서 매긴다. 아직 없으면 줄을 띄우지 않는다. */}
        {rating !== null && (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-zinc-500 dark:text-zinc-400">별점</dt>
            <dd className="text-black dark:text-zinc-50">
              {formatRating(rating)}
              {reads.length > 1 && ` (${currentRead.round}회차)`}
            </dd>
          </div>
        )}
      </dl>

      {/*
        지난 회차 (작업 30)
        재독하면 위의 상태·날짜는 '이번 회차'를 가리킨다. 지난 회차가 사라진 것처럼
        보이면 안 되므로 여기에 따로 늘어놓는다. 한 번만 읽은 책에는 나오지 않는다.
        Design Ref: §5.2 "재독해도 이전 회차 별점이 남는다"
      */}
      {reads.length > 1 && (
        <div className="mt-5 rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            읽은 기록 {reads.length}회
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {[...reads].reverse().map((read) => (
              <li key={read.round} className="flex gap-2">
                <span className="w-12 shrink-0 text-zinc-500 dark:text-zinc-400">
                  {read.round}회차
                </span>
                <span className="min-w-0 flex-1 text-black dark:text-zinc-50">
                  {joinParts([
                    // 끝나지 않은 회차는 마지막 하나뿐이다. 거기에만 상태를 적는다.
                    `${read.startedAt ?? '—'} ~ ${
                      read.finishedAt ??
                      (read.round === currentRead.round
                        ? notFinishedLabel(book.status)
                        : '—')
                    }`,
                    formatRating(read.review?.rating),
                  ])}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 지금 읽은 데까지 (작업 37) — 아직 읽는 중인 책에만 보인다 */}
      {isReadable && <CurrentPage book={book} />}

      {/*
        상태에 따라 여기 놓일 것이 달라진다. (작업 29에서 상태가 4종으로 늘었다)
          · 읽는 중 · 일시정지 → [다 읽었어요]  — 일시정지도 결국 끝낼 수 있어야 한다
          · 완독              → [감상 적기/고치기] — 건너뛴 감상을 나중에 적는 길
          · 중단              → 버튼 없음. 그만 읽기로 한 책에 "다 읽었어요"는 맞지 않는다
        Design Ref: §3.3③ / §4.4 흐름 3
      */}
      {isReadable ? (
        <button
          type="button"
          onClick={handleFinish}
          className="mt-6 w-full rounded-full bg-black px-4 py-3 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-black"
        >
          다 읽었어요
        </button>
      ) : book.status === BOOK_STATUS.FINISHED ? (
        <div className="mt-6 flex flex-col gap-2">
          {/* 다 읽은 뒤에는 감상으로 돌아갈 길이 필요하다.
              건너뛰었다가 나중에 적거나, 적어둔 것을 고칠 수 있어야 한다. */}
          <Link
            href={`/books/${book.id}/finish`}
            className="block w-full rounded-full border border-black/15 px-4 py-3 text-center text-sm font-medium text-zinc-700 dark:border-white/20 dark:text-zinc-300"
          >
            감상 {hasReview ? '고치기' : '적기'}
          </Link>
          {/* 다시 읽기 (작업 30) — 새 회차를 더한다. 지난 회차는 그대로 남는다 */}
          <button
            type="button"
            onClick={() => setAskReread(true)}
            className="w-full rounded-full border border-black/15 px-4 py-3 text-sm font-medium text-zinc-700 dark:border-white/20 dark:text-zinc-300"
          >
            다시 읽기
          </button>
        </div>
      ) : (
        // 중단. 탓하지 않는 말로 적는다. (CLAUDE.md 8절)
        <p className="mt-6 rounded-xl bg-zinc-100 px-4 py-3 text-sm leading-6 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          그만 읽기로 한 책이에요. 완독 합계에는 넣지 않아요.
          <br />
          다시 읽고 싶어지면 아래 고치기에서 상태를 바꿔주세요.
        </p>
      )}

      {/* 책 고치기 / 지우기 — 구절이 많아도 찾기 쉽도록 목록 위에 둔다 */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex-1 rounded-full border border-black/15 px-4 py-3 text-sm font-medium text-zinc-700 dark:border-white/20 dark:text-zinc-300"
        >
          고치기
        </button>
        <button
          type="button"
          onClick={() => setAskDelete(true)}
          className="rounded-full border border-rose-200 px-6 py-3 text-sm text-rose-700 dark:border-rose-900 dark:text-rose-400"
        >
          지우기
        </button>
      </div>

      {/* 구절 모아보기 */}
      <div className="mt-6 border-t border-black/10 pt-5 dark:border-white/15">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-black dark:text-zinc-50">
            구절 {bookQuotes.length}개
            {tagFilter !== null && (
              <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                #{tagFilter}
              </span>
            )}
          </p>
          <Link
            href={`/books/${book.id}/quotes/new`}
            className="rounded-full border border-black/15 px-4 py-2 text-sm text-zinc-700 dark:border-white/20 dark:text-zinc-300"
          >
            ＋ 구절 추가
          </Link>
        </div>

        {/* 태그로 거르는 중이면 푸는 길을 준다 (작업 39) */}
        {tagFilter !== null && (
          <button
            type="button"
            onClick={() => setTagFilter(null)}
            className="mt-2 rounded-full border border-black/15 px-3 py-1.5 text-xs text-zinc-700 dark:border-white/20 dark:text-zinc-300"
          >
            #{tagFilter} ✖ 전체 보기
          </button>
        )}

        {bookQuotes.length === 0 ? (
          // 데이터가 0건인 화면에는 안내 문구를 둔다. (CLAUDE.md 8절)
          <div className="py-6">
            <EmptyState
              title={
                tagFilter === null
                  ? '아직 모은 구절이 없어요.'
                  : `‘#${tagFilter}’ 태그를 달아둔 구절이 없어요.`
              }
              description={
                tagFilter === null
                  ? '마음에 남은 문장을 담아보세요.'
                  : '다른 태그를 골라보세요.'
              }
              actionLabel={tagFilter === null ? undefined : '전체 보기'}
              onAction={tagFilter === null ? undefined : () => setTagFilter(null)}
            />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {bookQuotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                book={book}
                onPickTag={setTagFilter}
              />
            ))}
          </ul>
        )}
      </div>

      <ErrorNote
        message={saveError?.message}
        code={saveError?.code}
        className="mt-4"
      />

      {/*
        다시 읽기도 한 번 묻는다. 서재에서 이 책이 '완독'에서 '읽는 중'으로 옮겨 가
        보이는 자리가 달라지기 때문이다. 지난 기록은 지우지 않는다는 것도 함께 알린다.
      */}
      <ConfirmDialog
        open={askReread}
        title={`${reads.length + 1}회차를 시작할까요?`}
        description={`오늘부터 다시 읽는 것으로 기록합니다. 지난 ${reads.length}회차의 날짜와 별점은 그대로 남아요.`}
        confirmLabel="다시 읽기"
        cancelLabel="그대로 두기"
        onConfirm={handleReread}
        onCancel={() => setAskReread(false)}
      />

      {/* 지우기 전에 반드시 묻는다. Design Ref: §8 "삭제 전 확인창" */}
      <ConfirmDialog
        open={askDelete}
        title="이 책을 지울까요?"
        description={`『${book.title}』을(를) 서재에서 지웁니다. 되돌릴 수 없어요.`}
        confirmLabel="지우기"
        cancelLabel="그대로 두기"
        onConfirm={handleDelete}
        onCancel={() => setAskDelete(false)}
      />
    </div>
  );
}
