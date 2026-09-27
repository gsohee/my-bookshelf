// 책 한 권 — 책장에 놓인 모습
//
// 표지 사진을 쓰지 않는다. 사진을 저장하지 않기로 했고(절대 규칙 1),
// 표지 이미지를 외부에서 불러오는 것도 비범위이기 때문이다(PRD 6절 — 그쪽 서버가
// 읽는 책을 알게 된다). 그래서 **제목·지은이·장르로 표지를 그린다.**
//
// ── 세 가지 모습 ────────────────────────────────────
//
//   ① 앞면(cover)  — 지금 읽는 중인 책. 한 칸에 한 권까지만
//   ② 책등(spine)  — 기본. 꽂혀 있다
//   ③ 누운 책(lying) — 2~3권을 쌓아 칸 끝에 둔다. 한 권만 눕히지 않는다
//
// 크기·색·기울기는 모두 **고유번호로 정한다.** 무작위로 하면 화면을 그릴 때마다
// 책이 춤을 추고, 서버가 그린 것과 브라우저가 그린 것이 달라 깜빡인다.
//
// Design Ref: §3.3① 책등 카드 — 색 = 장르 / 두께 = 총 페이지

import Link from 'next/link';
import { getSpineColor, BOOK_STATUS } from '@/lib/constants';

/** 책등 두께의 아래위 한계(px). */
const MIN_THICK = 22;
const MAX_THICK = 48;

/** 이 쪽수부터는 더 두꺼워지지 않는다. */
const PAGES_AT_MAX = 800;

/** 쪽수를 모를 때의 두께. 얇지도 두껍지도 않게 둔다. */
const UNKNOWN_THICK = 30;

/** 칸 하나의 안쪽 높이. 모든 책이 이 바닥선 위에 선다. */
export const ROW_HEIGHT = 170;

/** 책등 키 네 단계. 실제 책장도 키가 들쭉날쭉하다. */
const SPINE_HEIGHTS = [170, 158, 146, 134];

/** 앞면으로 세우는 책의 크기. */
export const COVER_WIDTH = 96;
const COVER_HEIGHT = 140;

/** 눕힌 책의 길이 = 서 있을 때의 키. 조금 짧게 두어 비스듬해 보이게 한다. */
export const LYING_LENGTH = 112;

/** 눕힌 책이 아무리 얇아도 이보다는 두껍다. 그래야 제목이 들어간다. */
const LYING_MIN_THICK = 18;

/** 책 사이 간격. 실제 책장처럼 바짝 붙인다. */
export const BOOK_GAP = 2;

/**
 * 고유번호를 숫자로 바꾼다.
 * 같은 책이면 늘 같은 숫자가 나와야 크기와 색이 흔들리지 않는다.
 */
export function hashOf(id) {
  let hash = 0;
  const text = String(id ?? '');
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 9973;
  }
  return hash;
}

/** 지금 읽는 중인 책인가. 이 책만 앞면으로 세운다. */
export function isReading(book) {
  return (
    book.status === BOOK_STATUS.READING || book.status === BOOK_STATUS.PAUSED
  );
}

/** 쪽수를 책등 두께로. 눕혀도 같은 값을 쓴다 — 같은 책이니까. */
export function thicknessOf(totalPages) {
  if (!Number.isFinite(totalPages) || totalPages <= 0) return UNKNOWN_THICK;
  const ratio = Math.min(totalPages / PAGES_AT_MAX, 1);
  return Math.round(MIN_THICK + ratio * (MAX_THICK - MIN_THICK));
}

/** 눕힌 책의 두께. */
export function lyingThickness(totalPages) {
  return Math.max(LYING_MIN_THICK, thicknessOf(totalPages));
}

/** 책등 키 — 네 단계 중 하나를 고유번호로 고른다. */
function heightOf(hash) {
  return SPINE_HEIGHTS[hash % SPINE_HEIGHTS.length];
}

/**
 * 기울어지는 책의 각도.
 *
 * 왼쪽 아래 모서리를 축으로 돌린다. 그러면 **왼쪽 책에 모서리가 닿은 채**
 * 위쪽만 벌어져 기대어 선 모양이 된다. 가운데를 축으로 돌리면 책이 바닥을 뚫는다.
 */
function leanOf(hash) {
  if (hash % 11 === 0) return 5;
  if (hash % 19 === 0) return 7;
  return 0;
}

/** 책등 — 왼쪽에서 빛을 받는 둥근 통. 가로 방향 그라데이션이 원통감을 만든다. */
const SPINE_SHEEN =
  'linear-gradient(to right, rgba(0,0,0,0.16) 0%, rgba(255,255,255,0.30) 16%, rgba(255,255,255,0.10) 34%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.26) 100%)';

/** 앞표지 — 위쪽이 살짝 밝다. */
const COVER_SHEEN =
  'linear-gradient(160deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0.14) 100%)';

/** 눕힌 책 — 위에서 보므로 위가 밝고 아래가 어둡다. */
const LYING_SHEEN =
  'linear-gradient(to bottom, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.06) 32%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.24) 100%)';

/** 눌렀을 때 살짝 들리는 움직임. 세 모습이 같은 값을 쓴다. */
const LIFT = 'transition-transform duration-200 ease-out';

/** 마우스를 올렸을 때 보여줄 설명. 좁은 책등에 다 담기지 않는 정보를 여기에 둔다. */
function detailOf(book) {
  return [
    book.title,
    book.author,
    book.totalPages ? `${book.totalPages}쪽` : null,
    book.genre,
    book.status,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * 세로로 쓴 제목에서 **숫자만 눕혀 모아** 준다.
 *
 * text-orientation: upright을 걸면 글자가 하나씩 세로로 선다. 한글은 그게 맞지만
 * "제3인간"의 3이나 "1984" 같은 숫자는 한 글자씩 쌓여 읽기 나쁘다.
 * 숫자 덩어리만 text-combine-upright로 묶어 가로로 눕힌다.
 */
function verticalTitle(title) {
  const parts = String(title ?? '').split(/(\d+)/);
  return parts.map((part, index) =>
    /^\d+$/.test(part) ? (
      <span
        key={`${index}-${part}`}
        style={{ textCombineUpright: 'all' }}
      >
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export default function BookSpine({ book, shape }) {
  const hash = hashOf(book.id);
  // 색맡은 장르가, 짙기는 책이 정한다. (lib/constants.js GENRE_SHADES)
  const { bg, fg } = getSpineColor(book.genre, hash);
  const detail = detailOf(book);
  const href = `/books/${book.id}`;

  // ── ③ 누운 책 ──
  if (shape === 'lying') {
    return (
      <Link
        href={href}
        title={detail}
        style={{
          backgroundColor: bg,
          color: fg,
          width: `${LYING_LENGTH}px`,
          height: `${lyingThickness(book.totalPages)}px`,
          backgroundImage: LYING_SHEEN,
        }}
        className={`flex items-center overflow-hidden rounded-[3px] px-2 shadow-sm hover:-translate-y-2 ${LIFT}`}
      >
        {/* 누워 있으므로 제목도 가로로 읽힌다 */}
        <span
          style={{ fontFamily: 'var(--font-round)' }}
          className="truncate text-[11px] leading-none"
        >
          {book.title}
        </span>
      </Link>
    );
  }

  // ── ① 앞면 — 지금 읽는 중인 책 ──
  if (shape === 'cover') {
    return (
      <Link
        href={href}
        title={detail}
        style={{
          backgroundColor: bg,
          color: fg,
          width: `${COVER_WIDTH}px`,
          height: `${COVER_HEIGHT}px`,
          backgroundImage: COVER_SHEEN,
        }}
        className={`relative flex flex-col justify-between rounded-[3px] rounded-l-[7px] px-2.5 py-3 shadow-lg hover:-translate-y-2 ${LIFT}`}
      >
        {/* 왼쪽 세로 띠 = 책을 묶은 쪽(등). 앞면이라는 걸 알려준다 */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-2 rounded-l-[7px] bg-black/15"
        />
        <span
          style={{ fontFamily: 'var(--font-round)' }}
          className="line-clamp-4 pl-1 text-[14px] leading-snug"
        >
          {book.title}
        </span>
        {/* 지은이를 적지 않은 책에는 아무것도 보이지 않는다 */}
        {book.author ? (
          <span className="truncate pl-1 text-[10px] opacity-70">
            {book.author}
          </span>
        ) : null}
      </Link>
    );
  }

  // ── ② 책등 ──
  const lean = leanOf(hash);
  return (
    <Link
      href={href}
      title={detail}
      style={{
        backgroundColor: bg,
        color: fg,
        width: `${thicknessOf(book.totalPages)}px`,
        height: `${heightOf(hash)}px`,
        backgroundImage: SPINE_SHEEN,
        boxShadow:
          'inset 0 7px 0 -6px rgba(255,255,255,0.4), inset 0 -7px 0 -6px rgba(0,0,0,0.32)',
        // 왼쪽 아래 모서리를 축으로 — 옆 책에 기대어 선 모양이 된다.
        transform: lean ? `rotate(${lean}deg)` : undefined,
        transformOrigin: 'bottom left',
      }}
      className={`flex items-center justify-center rounded-[3px] px-0.5 py-3 shadow-md hover:-translate-y-2 ${LIFT}`}
    >
      <span
        style={{
          fontFamily: 'var(--font-round)',
          writingMode: 'vertical-rl',
          textOrientation: 'upright',
        }}
        className="max-h-full overflow-hidden text-ellipsis whitespace-nowrap text-[12px] leading-tight tracking-tighter"
      >
        {verticalTitle(book.title)}
      </span>
    </Link>
  );
}
