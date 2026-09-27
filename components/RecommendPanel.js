'use client';

// 책 추천 받기 — 완독하지 않아도
//
// 원래 추천은 책을 다 읽은 뒤에만 받을 수 있었다(작업 22·23).
// 그래서 읽던 책이 없으면 추천을 받을 길이 없었다. 두 길을 더 낸다. (작업 44)
//
//   내 서재로 — 서재에 꽂힌 책들의 제목·장르·별점을 보고 고른다
//   직접 쓰기 — "요즘 마음이 지쳐서 잔잔한 소설" 처럼 적어서 고른다
//
// ★ 밖으로 나가는 것을 화면에 적어 둔다. ★
//   서재 목록은 원래 내보내지 않기로 한 것이라(PRD 6절),
//   이 길을 고른 사람이 무엇이 나가는지 알고 누를 수 있어야 한다.
//   구절과 메모는 어느 길로도 보내지 않는다. (PRD 7절)
//
// 받은 추천은 그대로 저장되지 않는다. "읽을 책에 저장"은 사람이 누른다.
//
// Design Ref: §3.3⑥ 추천 결과
// Design Ref: §6 서버 API — /api/recommend

import { useMemo, useState } from 'react';
import { useBooks, useHydrated } from '@/components/BookStore';
import { useApiCall } from '@/components/useApiCall';
import { callApi } from '@/lib/api';
import { isCountedInTotals } from '@/lib/stats';
import RecommendList from '@/components/RecommendList';
import RecommendNotice from '@/components/RecommendNotice';
import EmptyState from '@/components/EmptyState';

/** 서재를 보고 고를 때 보낼 책 수의 윗한도. 서버(route.js)와 같은 값이다. */
const MAX_SEND = 30;

/** 직접 쓸 수 있는 글자 수. 서버도 같은 길이에서 자른다. */
const MAX_PROMPT_LENGTH = 300;

/** 무엇을 적으면 되는지 보여주는 예시. 눌러서 그대로 넣을 수 있다. */
const EXAMPLES = [
  '요즘 마음이 지쳐서 잔잔하게 읽을 소설',
  '출퇴근길에 조금씩 읽을 짧은 에세이',
  '우주와 시간에 대해 쉽게 쓴 과학책',
];

const TABS = [
  { key: 'shelf', label: '내 서재로' },
  { key: 'prompt', label: '직접 쓰기' },
];

/**
 * 서재에서 보낼 것만 추려낸다.
 *
 * 중단한 책은 빼고(취향이라고 보기 어렵다), 별점이 높은 쪽부터 담는다.
 * 제목·장르·별점 말고는 담지 않는다 — 여기 없는 것은 밖으로 나가지 않는다.
 */
function buildShelf(books) {
  return books
    .filter(isCountedInTotals)
    .map((book) => ({
      title: book.title,
      genre: book.genre ?? '',
      rating: book.reads?.[book.reads.length - 1]?.review?.rating ?? null,
    }))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, MAX_SEND);
}

export default function RecommendPanel() {
  const books = useBooks();
  const hydrated = useHydrated();
  const recommend = useApiCall();

  const [tab, setTab] = useState('shelf');
  const [prompt, setPrompt] = useState('');
  const [received, setReceived] = useState(null);

  const shelf = useMemo(() => buildShelf(books), [books]);

  // 서버에서 그리는 동안에는 저장소가 없어 서재가 비어 보인다.
  if (!hydrated) return null;

  /** 지금 고른 길로 추천을 받는다. */
  async function ask() {
    setReceived(null);

    const body =
      tab === 'shelf'
        ? { mode: 'shelf', shelf }
        : { mode: 'prompt', prompt: prompt.trim() };

    const data = await recommend.run((signal) =>
      callApi('/api/recommend', {
        signal,
        // "추천 응답 10초 이내"가 성공 기준(S4)이다. 서버는 8초까지만 기다린다.
        timeoutMs: 10000,
        // 약속한 모양인지 여기서도 본다. Design Ref: §6
        validate: (result) => Array.isArray(result?.books),
        body,
      }),
    );
    if (data) setReceived(data.books);
  }

  /** 길을 바꾸면 앞서 받은 결과는 치운다 — 무엇으로 받은 것인지 헷갈린다. */
  function changeTab(key) {
    if (key === tab) return;
    setTab(key);
    setReceived(null);
    recommend.reset();
  }

  const canAsk =
    tab === 'shelf' ? shelf.length > 0 : prompt.trim().length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* 어느 길로 받을지 고른다 */}
      <div
        role="tablist"
        aria-label="추천 받는 방법"
        className="flex gap-1 rounded-full bg-surface-soft p-1"
      >
        {TABS.map((item) => {
          const active = item.key === tab;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => changeTab(item.key)}
              className={`flex-1 rounded-full px-4 py-2 text-sm transition-colors ${
                active
                  ? 'bg-brand font-semibold text-brand-ink'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <RecommendNotice />

      {tab === 'shelf' ? (
        shelf.length === 0 ? (
          <EmptyState
            title="아직 서재에 책이 없어요."
            description="책을 한 권 넣으면 서재를 보고 골라드려요."
            actionLabel="새 책"
            actionHref="/books/new"
          />
        ) : (
          <div className="rounded-xl border border-line-soft p-3">
            <p className="text-sm leading-6 text-ink">
              서재의 책 {shelf.length}권을 보고 골라드려요.
            </p>
            <p className="mt-2 text-xs leading-5 text-faint">
              제목·장르·별점만 보냅니다. 구절과 메모는 보내지 않아요.
              중단한 책은 빼고 봅니다.
            </p>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2">
          <label
            htmlFor="recommend-prompt"
            className="text-sm font-medium text-ink"
          >
            어떤 책이 읽고 싶으세요?
          </label>
          <textarea
            id="recommend-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={MAX_PROMPT_LENGTH}
            rows={4}
            placeholder="요즘 마음이 지쳐서 잔잔하게 읽을 소설"
            className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-sm leading-6 text-ink placeholder:text-faint focus:border-brand focus:outline-none"
          />
          <p className="text-right text-xs text-faint">
            {prompt.length} / {MAX_PROMPT_LENGTH}
          </p>

          {/* 무엇을 적으면 되는지 막막할 때. 눌러서 그대로 넣는다 */}
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-brand hover:text-ink"
              >
                {example}
              </button>
            ))}
          </div>

          <p className="text-xs leading-5 text-faint">
            적은 글만 보냅니다. 서재 목록·구절·메모는 보내지 않아요.
          </p>
        </div>
      )}

      {/* 받기 버튼 — 고른 길에 따라 무엇을 보낼지가 위에 적혀 있다 */}
      {!(tab === 'shelf' && shelf.length === 0) && (
        <button
          type="button"
          onClick={ask}
          disabled={!canAsk || recommend.loading}
          className="w-full rounded-full bg-brand px-4 py-3 text-sm font-semibold text-brand-ink disabled:bg-surface-soft disabled:text-faint"
        >
          {recommend.loading ? '고르는 중…' : '추천 받기'}
        </button>
      )}

      {recommend.loading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-muted">
            어울리는 책을 찾는 중…
          </p>
          <p className="text-xs text-faint">몇 초 걸려요</p>
        </div>
      )}

      {!recommend.loading && recommend.errorMessage && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p
            role="alert"
            className="w-full rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-text"
          >
            {recommend.errorMessage}
          </p>
          {recommend.canRetry && (
            <button
              type="button"
              onClick={() => {
                recommend.retry().then((data) => {
                  if (data) setReceived(data.books);
                });
              }}
              className="rounded-full border border-line px-5 py-2.5 text-sm text-muted"
            >
              다시 시도
            </button>
          )}
        </div>
      )}

      {!recommend.loading && !recommend.errorMessage && received !== null && (
        <RecommendList
          books={received}
          emptyTitle="권해줄 만한 새 책을 찾지 못했어요."
          emptyDescription="추천된 책이 이미 서재에 있을 수 있어요."
        />
      )}
    </div>
  );
}
