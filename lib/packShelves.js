// 책을 칸에 나눠 담기
//
// 화면 폭에 맡겨 흘려보내면(flex-wrap) 칸마다 규칙을 지킬 수 없다.
// "앞면은 칸당 한 권", "누운 더미는 칸 끝에" 같은 규칙은 **칸을 직접 나눠야** 지켜진다.
//
// 폭을 재지 않고 정해진 값으로 나눈다. 재려면 화면이 그려진 뒤에 알 수 있어
// 처음 한 번 어긋난 모습이 보이고, 서버가 그린 것과도 달라진다.
// 기준 폭은 380px이므로(CLAUDE.md 8절) 안쪽 폭도 거기서 나온 값이다.
//
// Design Ref: §3.3① 서재 — 책등 카드

import {
  hashOf,
  isReading,
  thicknessOf,
  lyingThickness,
  COVER_WIDTH,
  LYING_LENGTH,
  BOOK_GAP,
  ROW_HEIGHT,
} from '@/components/BookSpine';

/** 칸 안쪽에 책을 놓을 수 있는 폭. 380px 화면에서 좌우 여백을 뺀 값. */
export const SHELF_INNER = 336;

/** 한 칸에 세울 수 있는 앞면 책 수. */
const COVERS_PER_SHELF = 1;

/** 누운 더미 한 개에 쌓을 책 수. */
const PILE_MIN = 2;
const PILE_MAX = 3;

/** 책이 적어도 이만큼은 칸을 그린다. 한 칸만 있으면 책장으로 안 보인다. */
export const MIN_SHELVES = 4;

/** 이 더미가 차지하는 높이. 칸 높이를 넘으면 쌓지 않는다. */
function pileHeight(books) {
  return books.reduce((sum, book) => sum + lyingThickness(book.totalPages), 0);
}

/**
 * 책 목록을 칸 목록으로 나눈다.
 *
 * 규칙
 *   · 앞면(읽는 중)은 칸당 한 권까지
 *   · 누운 책은 2~3권씩 쌓아 **칸 오른쪽 끝**에 놓는다
 *   · 한 권만 남은 눕힘 후보는 눕히지 않고 그냥 꽂는다
 *   · 남는 공간은 칸 오른쪽 끝에 둔다 (책은 왼쪽부터 붙여 놓는다)
 *
 * @returns [{ items: [...], pile: [...] | null }]
 *   items — 왼쪽부터 놓을 것들 ({ kind: 'cover' | 'spine', book })
 *   pile  — 칸 끝에 쌓을 누운 책들. 없으면 null
 */
export function packShelves(books) {
  // ── 1. 어떤 모습으로 놓을지 나눈다 ──
  const covers = [];
  const spines = [];
  const lying = [];

  for (const book of books) {
    if (isReading(book)) {
      covers.push(book);
    } else if (hashOf(book.id) % 7 === 0) {
      lying.push(book);
    } else {
      spines.push(book);
    }
  }

  // ── 2. 누운 책을 더미로 묶는다 ──
  const piles = [];
  let rest = [...lying];

  while (rest.length >= PILE_MIN) {
    let take = Math.min(PILE_MAX, rest.length);
    // 남은 것이 4권이면 3+1이 되어 한 권이 뜬다. 2+2로 나눈다.
    if (rest.length - take === 1) take -= 1;

    const pile = rest.slice(0, take);
    while (pile.length > PILE_MIN && pileHeight(pile) > ROW_HEIGHT) pile.pop();

    piles.push(pile);
    rest = rest.slice(pile.length);
  }

  // 한 권만 남았으면 눕히지 않는다. 혼자 누운 책은 흘린 것처럼 보인다.
  for (const book of rest) spines.push(book);

  // ── 3. 칸에 담는다 ──
  const shelves = [];
  const coverQueue = [...covers];
  const spineQueue = [...spines];
  const pileQueue = [...piles];

  while (coverQueue.length > 0 || spineQueue.length > 0 || pileQueue.length > 0) {
    const shelf = { items: [], pile: null };
    let used = 0;
    let coverCount = 0;

    // 더미는 칸 끝에 놓으므로 자리를 미리 떼어 둔다.
    const wantPile = pileQueue.length > 0;
    const pileRoom = wantPile ? LYING_LENGTH + BOOK_GAP : 0;

    /** 이만큼이 더 들어가는가. */
    const fits = (width) =>
      used + width + (shelf.items.length > 0 ? BOOK_GAP : 0) <=
      SHELF_INNER - pileRoom;

    /** 칸에 한 권 넣는다. */
    const put = (kind, book, width) => {
      used += width + (shelf.items.length > 0 ? BOOK_GAP : 0);
      shelf.items.push({ kind, book });
    };

    // 앞면을 먼저 — 칸당 한 권까지.
    while (coverCount < COVERS_PER_SHELF && coverQueue.length > 0) {
      if (!fits(COVER_WIDTH)) break;
      put('cover', coverQueue.shift(), COVER_WIDTH);
      coverCount += 1;
    }

    // 그다음 책등으로 채운다.
    while (spineQueue.length > 0) {
      const width = thicknessOf(spineQueue[0].totalPages);
      if (!fits(width)) break;
      put('spine', spineQueue.shift(), width);
    }

    if (wantPile) shelf.pile = pileQueue.shift();

    // 한 권도 못 담았는데 남은 것이 있으면 무한히 돈다. 한 권은 억지로라도 넣는다.
    if (shelf.items.length === 0 && shelf.pile === null) {
      if (coverQueue.length > 0) put('cover', coverQueue.shift(), COVER_WIDTH);
      else if (spineQueue.length > 0) {
        const book = spineQueue.shift();
        put('spine', book, thicknessOf(book.totalPages));
      } else break;
    }

    shelves.push(shelf);
  }

  // ── 4. 빈 칸을 채워 책장 꼴을 만든다 ──
  while (shelves.length < MIN_SHELVES) {
    shelves.push({ items: [], pile: null });
  }

  return shelves;
}
