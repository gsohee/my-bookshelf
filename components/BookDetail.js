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
 * 감상에서 **별점 말고** 보여줄 것을 추려낸다.
 *
 * 넷 다 비어 있으면 null을 돌려준다 — 부르는 쪽이 이것으로 칸을 만들지 말지 정한다.
 * 별점은 빼둔다. 이번 회차는 위 목록에, 지난 회차는 날짜 줄에 이미 나오기 때문이다.
 */
function reviewDetailOf(review) {
  if (!review) return null;

  const mood = String(review.mood ?? '').trim();
  const difficulty = String(review.difficulty ?? '').trim();
  const memo = String(review.memo ?? '').trim();
  const likedPoints = Array.isArray(review.likedPoints)
    ? review.likedPoints.filter(Boolean)
    : [];

  // 적은 날만 있고 고른 것이 없으면 칸을 열지 않는다.
  // 날짜 한 줄 때문에 칸을 만들면 별점만 매긴 책이 괜히 길어진다.
  if (!mood && !difficulty && !memo && likedPoints.length === 0) return null;

  // 감상을 적은 날. 4번째 저장 구조부터 담긴다.
  // 그 전에 적은 감상에는 없으므로(null) 그때는 줄을 띄우지 않는다.
  const savedAt = String(review.savedAt ?? '').trim();
  return { mood, likedPoints, difficulty, memo, savedAt };
}

/**
 * 감상 한 벌 — 분위기 · 좋았던 점 · 난이도 · 메모.
 *
 * 이번 회차(「남긴 감상」 칸)와 지난 회차(「읽은 기록」에서 펼쳤을 때)가 함께 쓴다.
 * 두 곳이 다른 모양이면 같은 것을 보는데 다르게 읽힌다.
 */
function ReviewDetail({ detail }) {
  return (
    <>
      <dl className="space-y-2 text-sm">
        {detail.mood && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted">분위기</dt>
            <dd className="min-w-0 flex-1 text-ink">{detail.mood}</dd>
          </div>
        )}
        {detail.likedPoints.length > 0 && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted">좋았던 점</dt>
            <dd className="min-w-0 flex-1 text-ink">
              {detail.likedPoints.join(' · ')}
            </dd>
          </div>
        )}
        {detail.difficulty && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted">난이도</dt>
            <dd className="min-w-0 flex-1 text-ink">{detail.difficulty}</dd>
          </div>
        )}
        {detail.savedAt && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted">적은 날</dt>
            <dd className="min-w-0 flex-1 text-ink">{detail.savedAt}</dd>
          </div>
        )}
      </dl>

      {/* 메모는 여러 줄일 수 있어 목록 아래에 따로 놓는다. 줄바꿈을 살린다. */}
      {detail.memo && (
        <div className="mt-3 border-t border-line-soft pt-3">
          <p className="text-xs text-muted">메모</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">
            {detail.memo}
          </p>
        </div>
      )}
    </>
  );
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
        <p className="text-sm text-muted">
          그런 책을 찾지 못했어요.
        </p>
        <Link
          href="/"
          className="rounded-full border border-line px-5 py-2 text-sm text-muted"
        >
          서재로 가기
        </Link>
      </div>
    );
  }

  const reads = book.reads ?? [];
  const currentRead = reads[reads.length - 1] ?? {};
  const review = currentRead.review ?? null;
  const rating = review?.rating ?? null;
  const hasReview = review != null;

  // 이번 회차 감상에서 별점 말고 보여줄 것. 없으면 null이라 칸을 만들지 않는다.
  const reviewDetail = reviewDetailOf(review);
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
        <h2 className="mb-4 text-sm font-medium text-muted">
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
        className="mb-3 inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink"
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
          <h1 className="text-xl font-semibold leading-8 tracking-tight text-ink">
            {book.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
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
          <dt className="w-16 shrink-0 text-muted">상태</dt>
          <dd className="text-ink">{book.status}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-muted">시작일</dt>
          <dd className="text-ink">
            {currentRead.startedAt ?? '—'}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-muted">완독일</dt>
          <dd className="text-ink">
            {currentRead.finishedAt ?? notFinishedLabel(book.status)}
          </dd>
        </div>
        {/* 별점은 완독 감상(작업 21)에서 매긴다. 아직 없으면 줄을 띄우지 않는다. */}
        {rating !== null && (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-muted">별점</dt>
            <dd className="text-ink">
              {formatRating(rating)}
              {reads.length > 1 && ` (${currentRead.round}회차)`}
            </dd>
          </div>
        )}
      </dl>

      {/*
        남긴 감상
        완독 화면에서 고른 것들이다. 담기기만 하고 어디에도 보이지 않아
        "저장이 안 된 것 같다"는 말을 들었다. 적은 사람이 다시 읽을 자리가 있어야 한다.
        별점은 위 목록에 이미 나오므로 여기서 또 적지 않는다.
        Design Ref: §3.3③ 책 상세
      */}
      {reviewDetail && (
        <div className="mt-5 rounded-xl bg-surface-soft px-4 py-3">
          <p className="mb-2 text-xs font-medium text-muted">
            남긴 감상
            {reads.length > 1 && ` (${currentRead.round}회차)`}
          </p>
          <ReviewDetail detail={reviewDetail} />
        </div>
      )}

      {/*
        지난 회차 (작업 30)
        재독하면 위의 상태·날짜는 '이번 회차'를 가리킨다. 지난 회차가 사라진 것처럼
        보이면 안 되므로 여기에 따로 늘어놓는다. 한 번만 읽은 책에는 나오지 않는다.
        Design Ref: §5.2 "재독해도 이전 회차 별점이 남는다"
      */}
      {reads.length > 1 && (
        <div className="mt-5 rounded-xl bg-surface-soft px-4 py-3">
          <p className="text-xs font-medium text-muted">
            읽은 기록 {reads.length}회
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {[...reads].reverse().map((read) => {
              const line = joinParts([
                // 끝나지 않은 회차는 마지막 하나뿐이다. 거기에만 상태를 적는다.
                `${read.startedAt ?? '—'} ~ ${
                  read.finishedAt ??
                  (read.round === currentRead.round
                    ? notFinishedLabel(book.status)
                    : '—')
                }`,
                formatRating(read.review?.rating),
              ]);

              // 이번 회차 감상은 위 「남긴 감상」에 이미 펼쳐져 있으므로 여기서 또 접었다 펴지 않는다.
              const isCurrent = read.round === currentRead.round;
              const pastDetail = isCurrent ? null : reviewDetailOf(read.review);

              if (!pastDetail) {
                return (
                  <li key={read.round} className="flex gap-2">
                    <span className="w-12 shrink-0 text-muted">
                      {read.round}회차
                    </span>
                    <span className="min-w-0 flex-1 text-ink">{line}</span>
                  </li>
                );
              }

              return (
                <li key={read.round}>
                  {/*
                    지난 회차 감상 펼쳐보기.
                    `<details>`를 쓰면 상태를 따로 들지 않아도 되고,
                    읽어주는 도구에도 "펼침/접힘"이 그대로 전해진다.
                    사파리가 기본으로 그리는 삼각형은 지우고 우리 화살표를 쓴다.
                  */}
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                      <span className="w-12 shrink-0 text-muted">
                        {read.round}회차
                      </span>
                      <span className="min-w-0 flex-1 text-ink">{line}</span>
                      <span className="shrink-0 text-xs text-muted">
                        감상
                        <span
                          aria-hidden="true"
                          className="ml-0.5 inline-block transition-transform group-open:rotate-180"
                        >
                          ▾
                        </span>
                      </span>
                    </summary>

                    <div className="mt-2 rounded-lg bg-surface px-3 py-2.5">
                      <ReviewDetail detail={pastDetail} />
                    </div>
                  </details>
                </li>
              );
            })}
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
          className="mt-6 w-full rounded-full bg-brand px-4 py-3 text-sm font-semibold text-brand-ink"
        >
          다 읽었어요
        </button>
      ) : book.status === BOOK_STATUS.FINISHED ? (
        <div className="mt-6 flex flex-col gap-2">
          {/* 다 읽은 뒤에는 감상으로 돌아갈 길이 필요하다.
              건너뛰었다가 나중에 적거나, 적어둔 것을 고칠 수 있어야 한다. */}
          <Link
            href={`/books/${book.id}/finish`}
            className="block w-full rounded-full border border-line px-4 py-3 text-center text-sm font-medium text-muted"
          >
            감상 {hasReview ? '고치기' : '적기'}
          </Link>
          {/* 다시 읽기 (작업 30) — 새 회차를 더한다. 지난 회차는 그대로 남는다 */}
          <button
            type="button"
            onClick={() => setAskReread(true)}
            className="w-full rounded-full border border-line px-4 py-3 text-sm font-medium text-muted"
          >
            다시 읽기
          </button>
        </div>
      ) : (
        // 중단. 탓하지 않는 말로 적는다. (CLAUDE.md 8절)
        <p className="mt-6 rounded-xl bg-surface-soft px-4 py-3 text-sm leading-6 text-muted">
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
          className="flex-1 rounded-full border border-line px-4 py-3 text-sm font-medium text-muted"
        >
          고치기
        </button>
        <button
          type="button"
          onClick={() => setAskDelete(true)}
          className="rounded-full border border-danger/40 px-6 py-3 text-sm text-danger"
        >
          지우기
        </button>
      </div>

      {/* 구절 모아보기 */}
      <div className="mt-6 border-t border-line-soft pt-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">
            구절 {bookQuotes.length}개
            {tagFilter !== null && (
              <span className="ml-1 text-xs font-normal text-muted">
                #{tagFilter}
              </span>
            )}
          </p>
          <Link
            href={`/books/${book.id}/quotes/new`}
            className="rounded-full border border-line px-4 py-2 text-sm text-muted"
          >
            ＋ 구절 추가
          </Link>
        </div>

        {/* 태그로 거르는 중이면 푸는 길을 준다 (작업 39) */}
        {tagFilter !== null && (
          <button
            type="button"
            onClick={() => setTagFilter(null)}
            className="mt-2 rounded-full border border-line px-3 py-1.5 text-xs text-muted"
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
