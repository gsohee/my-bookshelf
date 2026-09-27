// 책등 카드
//
// 표지 사진 대신 책등을 보여준다. 사진을 저장하지 않기로 했기 때문이기도 하고,
// 좁은 화면에 여러 권을 한눈에 담기에도 책등이 낫다.
//
//   · 색     = 장르
//   · 세로 글씨 = 제목
//   · 두께   = 총 페이지에 비례
//
// 탭하면 책 상세로 간다.
//
// Design Ref: §3.3① "책등 카드 — 장르 색·세로 제목·페이지 비례 두께"

import Link from 'next/link';
import { getGenreColor } from '@/lib/constants';

/** 가장 얇은 책등과 가장 두꺼운 책등의 폭(px). */
const MIN_WIDTH = 26;
const MAX_WIDTH = 58;

/** 이 페이지 수부터는 더 두꺼워지지 않는다. */
const PAGES_AT_MAX = 800;

/** 총 페이지를 모를 때의 폭. 얇지도 두껍지도 않게 둔다. */
const UNKNOWN_WIDTH = 32;

/** 총 페이지를 책등 두께로 바꾼다. */
function spineWidth(totalPages) {
  if (!Number.isFinite(totalPages) || totalPages <= 0) return UNKNOWN_WIDTH;
  const ratio = Math.min(totalPages / PAGES_AT_MAX, 1);
  return Math.round(MIN_WIDTH + ratio * (MAX_WIDTH - MIN_WIDTH));
}

export default function BookSpine({ book }) {
  const { bg, fg } = getGenreColor(book.genre);
  const width = spineWidth(book.totalPages);

  // 마우스를 올렸을 때 보여줄 설명. 좁은 책등에 다 담기지 않는 정보를 여기에 둔다.
  const detail = [
    book.title,
    book.author,
    book.totalPages ? `${book.totalPages}쪽` : null,
    book.genre,
    book.status,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="shrink-0">
      <Link
        href={`/books/${book.id}`}
        title={detail}
        style={{ backgroundColor: bg, color: fg, width: `${width}px` }}
        className="flex h-44 items-center justify-center rounded-sm px-1 py-2 shadow-sm transition-transform hover:-translate-y-1"
      >
        <span className="max-h-full overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium tracking-tight [writing-mode:vertical-rl]">
          {book.title}
        </span>
      </Link>
    </li>
  );
}
