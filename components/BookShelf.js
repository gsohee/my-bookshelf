'use client';

// 책장
//
// 칸(선반)을 하나씩 그리고 그 위에 책을 올린다.
// 화면 폭에 맡겨 흘려보내지 않고 `lib/packShelves.js`가 칸을 직접 나눈다 —
// "앞면은 칸당 한 권", "누운 더미는 칸 끝에" 같은 규칙은 그래야 지켜진다.
//
// 칸 하나는 세 겹이다.
//   ① 어두운 뒷판 — 책 뒤로 보이는 벽
//   ② 위쪽 안그림자 — 윗칸 선반이 드리우는 그늘
//   ③ 나무 선반 — 윗면과 앞면(두께)을 따로 그려 도톰해 보이게
//
// Design Ref: §3.3① 서재 (홈)

import { useMemo, useState } from 'react';
import { useBooks } from '@/components/BookStore';
import BookSpine, { ROW_HEIGHT, BOOK_GAP } from '@/components/BookSpine';
import SortToggle from '@/components/SortToggle';
import StatusFilter from '@/components/StatusFilter';
import EmptyState from '@/components/EmptyState';
import EmptyShelfMark from '@/components/EmptyShelfMark';
import TodayQuote from '@/components/TodayQuote';
import { sortBooks, DEFAULT_SORT } from '@/lib/sortBooks';
import { filterBooksByStatus, STATUS_FILTER_ALL } from '@/lib/filterBooks';
import { packShelves } from '@/lib/packShelves';

/** 선반 윗면 두께와 앞면(도톰해 보이는 부분) 두께. */
const BOARD_TOP = 6;
const BOARD_FACE = 5;

/** 칸 하나 — 뒷판 위에 책이 서고, 아래에 나무 선반이 붙는다. */
function Shelf({ shelf }) {
  return (
    <li>
      <div
        style={{ height: `${ROW_HEIGHT}px` }}
        className="relative flex items-end overflow-hidden rounded-t-[3px] bg-shelf-edge/25 px-1.5 shadow-[inset_0_10px_12px_-8px_rgba(0,0,0,0.45)]"
      >
        {/*
          왼쪽부터 바짝 붙여 놓는다. 누운 더미는 **맨 끝에** 붙고,
          남는 공간은 그 오른쪽에 남는다 — 가운데가 비면 흘린 것처럼 보인다.
        */}
        <div style={{ gap: `${BOOK_GAP}px` }} className="flex items-end">
          {shelf.items.map((item) => (
            <BookSpine key={item.book.id} book={item.book} shape={item.kind} />
          ))}

          {/* 누운 더미 — 아래에서 위로 쌓이게 flex-col-reverse */}
          {shelf.pile && (
            <div className="flex flex-col-reverse gap-px pl-1">
              {shelf.pile.map((book) => (
                <BookSpine key={book.id} book={book} shape="lying" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 나무 선반 — 윗면과 앞면을 나눠 그려 도톰해 보이게 한다 */}
      <div
        style={{ height: `${BOARD_TOP}px` }}
        className="rounded-t-[2px] bg-shelf"
      />
      <div
        style={{ height: `${BOARD_FACE}px` }}
        className="rounded-b-[3px] bg-shelf-edge shadow-[0_2px_4px_rgba(0,0,0,0.18)]"
      />
    </li>
  );
}

export default function BookShelf() {
  const books = useBooks();

  // 고른 정렬과 필터는 이 화면을 보는 동안만 기억한다.
  const [sortKey, setSortKey] = useState(DEFAULT_SORT);
  const [status, setStatus] = useState(STATUS_FILTER_ALL);

  // 먼저 거르고 그다음 줄을 세운다. 책·기준이 바뀔 때만 다시 한다.
  const shown = useMemo(
    () => sortBooks(filterBooksByStatus(books, status), sortKey),
    [books, status, sortKey],
  );

  // 칸 나누기도 책·기준이 바뀔 때만. 그릴 때마다 다시 하면 낭비다.
  const shelves = useMemo(() => packShelves(shown), [shown]);

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
        <p className="shrink-0 text-xs text-muted">{shown.length}권</p>
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
        <ul className="flex flex-col gap-1.5">
          {shelves.map((shelf, index) => (
            <Shelf key={shelf.items[0]?.book.id ?? `empty-${index}`} shelf={shelf} />
          ))}
        </ul>
      )}
    </div>
  );
}
