'use client';

// 제목으로 책 찾기 (작업 43)
//
// 사진을 찍는 것보다 빠르고 정확한 두 번째 길이다.
// 제목 몇 글자로 찾아 고르면 제목·지은이·총 페이지가 입력칸에 들어간다.
//
// ★ 고른 결과도 바로 저장되지 않는다. ★ 입력칸을 채워줄 뿐이고,
// 확인하고 저장하는 일은 사람이 한다. (CLAUDE.md 2절 절대 규칙 3)
//
// ★ 표지 이미지는 받지 않는다. ★ 서버가 아예 주소를 돌려주지 않는다.
// (PRD 6절 — 표지를 불러오면 그쪽 서버가 읽는 책을 알게 된다)
//
// Design Ref: §3.3② 새 책 — 제목으로 찾기

import { useId, useState } from 'react';
import { useApiCall } from '@/components/useApiCall';
import { callApi } from '@/lib/api';

export default function BookSearch({ onPick }) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState(null);
  const search = useApiCall();

  async function handleSearch() {
    const text = query.trim();
    if (text === '' || search.loading) return;

    const result = await search.run((signal) =>
      callApi('/api/search-books', {
        signal,
        // 서버가 6초까지 기다리므로 그보다 넉넉하게 잡는다.
        timeoutMs: 9000,
        validate: (data) => Array.isArray(data?.books),
        // 나가는 것은 검색어뿐이다. 서재 내용은 보내지 않는다.
        body: { query: text },
      }),
    );

    if (result) setFound(result.books);
  }

  function handlePick(book) {
    onPick(book);
    // 고르고 나면 목록을 접는다. 입력칸이 채워졌으니 더 볼 이유가 없다.
    setFound(null);
    setQuery('');
    search.reset();
  }

  return (
    <div className="rounded-xl border border-line-soft bg-surface p-3">
      {/*
        **여기에 <form>을 두면 안 된다.** 이 컴포넌트는 책 등록 폼 **안에** 들어가는데,
        HTML은 폼 중첩을 허용하지 않아 안쪽 폼이 무시된다.
        그러면 "찾기"가 바깥 폼(책 저장)을 제출해 책이 그냥 저장돼 버린다. (실제로 겪음)
        그래서 폼 없이 버튼과 엔터만으로 검색한다.
      */}
      <label htmlFor={inputId} className="text-sm font-medium text-muted">
        제목으로 찾기
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // 엔터로도 찾는다. 바깥 폼이 제출되지 않게 기본 동작을 막는다.
            if (event.key === 'Enter') {
              event.preventDefault();
              handleSearch();
            }
          }}
          placeholder="예: 데미안"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-faint focus:border-brand"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={query.trim() === '' || search.loading}
          className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:bg-line disabled:text-faint"
        >
          {search.loading ? '찾는 중…' : '찾기'}
        </button>
      </div>

      {search.errorMessage && (
        <div className="mt-2">
          <p
            role="alert"
            className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-text"
          >
            {search.errorMessage}
          </p>
          <p className="mt-1 text-xs text-faint">
            아래에 직접 적으셔도 됩니다.
          </p>
        </div>
      )}

      {found !== null && found.length === 0 && (
        <p className="mt-2 text-sm text-muted">
          찾지 못했어요. 제목을 줄여서 다시 찾거나 아래에 직접 적어주세요.
        </p>
      )}

      {found !== null && found.length > 0 && (
        <>
          <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
            {found.map((book, index) => (
              <li key={`${book.title}|${book.author}|${index}`}>
                <button
                  type="button"
                  onClick={() => handlePick(book)}
                  className="w-full rounded-lg px-2 py-2 text-left active:bg-surface-soft"
                >
                  <span className="block text-sm font-medium text-ink">
                    {book.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {[
                      book.author,
                      book.publisher,
                      book.totalPages ? `${book.totalPages}쪽` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '정보 없음'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-faint">
            고르면 아래 칸이 채워져요. 표지 그림은 받아오지 않아요.
          </p>
        </>
      )}
    </div>
  );
}
