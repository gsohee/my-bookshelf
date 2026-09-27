'use client';

// 책장
//
// 책등 카드를 꽂아 늘어놓는다. 한 줄이 차면 아랫줄로 넘어간다.
// 상태로 거른 뒤 정렬해서 보여준다. 빈 서재 안내는 작업 14에서 붙인다.
//
// Design Ref: §3.3① 서재 (홈)

import { useMemo, useState } from 'react';
import { useBooks } from '@/components/BookStore';
import BookSpine from '@/components/BookSpine';
import SortToggle from '@/components/SortToggle';
import StatusFilter from '@/components/StatusFilter';
import EmptyState from '@/components/EmptyState';
import EmptyShelfMark from '@/components/EmptyShelfMark';
import TodayQuote from '@/components/TodayQuote';
import { sortBooks, DEFAULT_SORT } from '@/lib/sortBooks';
import { filterBooksByStatus, STATUS_FILTER_ALL } from '@/lib/filterBooks';

export default function BookShelf() {
  const books = useBooks();

  // 고른 정렬과 필터는 이 화면을 보는 동안만 기억한다.
  // 앱을 껐다 켜도 남기려면 저장할 곳이 필요한데, 그 자리(`ui` 키)는 2단계에 생긴다.
  const [sortKey, setSortKey] = useState(DEFAULT_SORT);
  const [status, setStatus] = useState(STATUS_FILTER_ALL);

  // 먼저 거르고 그다음 줄을 세운다. 책·기준이 바뀔 때만 다시 한다.
  const shown = useMemo(
    () => sortBooks(filterBooksByStatus(books, status), sortKey),
    [books, status, sortKey],
  );

  // 책이 한 권도 없을 때. 앱을 처음 연 사람이 보는 화면이라 무엇을 하면 되는지까지 준다.
  // 정렬·필터는 고를 것이 없으므로 함께 감춘다.
  if (books.length === 0) {
    return (
      <EmptyState
        decoration={<EmptyShelfMark />}
        title="아직 서재가 비어 있어요."
        description="첫 책을 넣으면 여기에 책등이 꽂혀요."
        actionLabel="새 책"
        actionHref="/books/new"
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* 오늘의 구절 (작업 40) — 책장 위에 둔다. 구절이 없으면 스스로 숨는다 */}
      <TodayQuote />

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
          {shown.length}권
        </p>
        <div className="flex items-center gap-1.5">
          <StatusFilter value={status} onChange={setStatus} />
          <SortToggle sortKey={sortKey} onChange={setSortKey} />
        </div>
      </div>

      {shown.length === 0 ? (
        // 서재에 책은 있는데 고른 상태에 해당하는 책만 없을 때.
        <EmptyState
          title={`‘${status}’인 책이 없어요.`}
          description="다른 상태를 골라보세요."
          actionLabel="전체 보기"
          onAction={() => setStatus(STATUS_FILTER_ALL)}
        />
      ) : (
        <ul className="flex flex-wrap items-end gap-1.5">
          {shown.map((book) => (
            <BookSpine key={book.id} book={book} />
          ))}
        </ul>
      )}
    </div>
  );
}
