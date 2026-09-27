'use client';

// 추천 결과 — 완독 뒤
//
// 화면에 들어서면 곧바로 추천을 받아 온다. 감상 화면에서 "추천 받기"를 이미 눌렀으므로
// 여기서 또 누르게 하지 않는다.
//
// 받은 책을 보여주고 저장을 받는 일은 `RecommendList`가 맡는다 —
// 서재·직접 입력 추천(작업 44)과 똑같은 모양이어야 하기 때문이다.
//
// 받은 추천은 그대로 저장되지 않는다. "읽을 책에 저장"은 사람이 누른다.
//
// Design Ref: §3.3⑥ 추천 결과
// Design Ref: §4.4 흐름 3

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBooks, useHydrated } from '@/components/BookStore';
import { useApiCall } from '@/components/useApiCall';
import { callApi } from '@/lib/api';
import RecommendList from '@/components/RecommendList';
import RecommendNotice from '@/components/RecommendNotice';

export default function RecommendResult({ bookId }) {
  const router = useRouter();
  const books = useBooks();
  const hydrated = useHydrated();
  const recommend = useApiCall();

  const [received, setReceived] = useState(null);

  const book = books.find((item) => item.id === bookId);
  const review = book?.reads?.[book.reads.length - 1]?.review ?? null;

  // 같은 화면에서 두 번 부르지 않기 위한 표시.
  //
  // 화면을 떠날 때 다시 false로 돌려놓는 것이 중요하다.
  // 개발 모드에서는 React가 화면을 만들었다 지웠다 다시 만드는데,
  // 그때 첫 요청은 중단되고 이 표시만 남아 "이미 물어봤다"고 여겨
  // 다시 부르지 않은 채 로딩에 갇히는 일이 실제로 있었다.
  const asked = useRef(false);

  // run은 바뀌지 않는 함수라 effect를 다시 돌게 하지 않는다.
  const { run } = recommend;

  useEffect(() => {
    if (!book || asked.current) return;
    asked.current = true;

    const ask = async () => {
      const data = await run((signal) =>
        callApi('/api/recommend', {
          signal,
          // "추천 응답 10초 이내"가 성공 기준(S4)이다. 서버는 8초까지만 기다린다.
          timeoutMs: 10000,
          // 약속한 모양인지 여기서도 본다. Design Ref: §6
          validate: (result) => Array.isArray(result?.books),
          // 보내는 것은 여기 적힌 것뿐이다. 구절과 메모는 넣지 않는다. (PRD 7절)
          body: {
            mode: 'book',
            title: book.title,
            genre: book.genre,
            mood: review?.mood ?? '',
            likedPoints: review?.likedPoints ?? [],
            difficulty: review?.difficulty ?? '',
            rating: review?.rating ?? null,
          },
        }),
      );
      if (data) setReceived(data.books);
    };

    ask();

    // 화면이 사라지면 표시를 되돌린다. 다시 들어오면 새로 물어본다.
    return () => {
      asked.current = false;
    };
  }, [book, review, run]);

  // 서버에서 그리는 동안에는 저장소가 없어 서재가 비어 보인다.
  if (!hydrated) return null;

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

  function goBack() {
    router.push(`/books/${bookId}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-xs text-muted">
        『{book.title}』을(를) 읽은 뒤에 어울리는 책이에요
      </p>

      <RecommendNotice />

      {recommend.loading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-muted">
            어울리는 책을 찾는 중…
          </p>
          <p className="text-xs text-faint">몇 초 걸려요</p>
        </div>
      )}

      {!recommend.loading && recommend.errorMessage && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p
            role="alert"
            className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-text"
          >
            {recommend.errorMessage}
          </p>
          <div className="flex gap-2">
            {recommend.canRetry && (
              <button
                type="button"
                onClick={() => {
                  recommend.retry().then((data) => {
                    if (data) setReceived(data.books);
                  });
                }}
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink"
              >
                다시 시도
              </button>
            )}
            <button
              type="button"
              onClick={goBack}
              className="rounded-full border border-line px-5 py-2.5 text-sm text-muted"
            >
              건너뛰기
            </button>
          </div>
        </div>
      )}

      {!recommend.loading && !recommend.errorMessage && received !== null && (
        <>
          <RecommendList
            books={received}
            emptyTitle="권해줄 만한 새 책을 찾지 못했어요."
            emptyDescription="추천된 책이 이미 서재에 있을 수 있어요."
          />

          <button
            type="button"
            onClick={goBack}
            className="mt-auto w-full rounded-full border border-line px-4 py-3 text-sm text-muted"
          >
            책으로 돌아가기
          </button>
        </>
      )}
    </div>
  );
}
