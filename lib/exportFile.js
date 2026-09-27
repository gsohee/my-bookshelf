// 내보내기 — CSV와 마크다운
//
// 백업(작업 26·27)은 "이 앱으로 되돌리기" 위한 파일이라 사람이 읽기는 불편하다.
// 여기서 만드는 것은 **다른 곳으로 옮기기 위한 파일**이다.
//   · CSV      → 엑셀·구글 시트에서 열어 정렬하고 세어보기
//   · 마크다운 → 블로그·노션에 그대로 붙여넣기
//
// ★ API 키나 설정값은 담지 않는다. ★
// 아래 함수들이 읽는 것은 넘겨받은 책·구절의 필드뿐이라 다른 것이 섞일 길이 없다.
// (PRD M3 "내보내기 파일에 API 키·설정값 포함 금지" / CLAUDE.md 9절)
//
// 이 파일에는 DOM을 건드리는 코드가 없다. 글자를 만들어 돌려주기만 한다 —
// 그래야 결과를 눈으로 확인하기 쉽다.
//
// Design Ref: §3.3⑧ 데이터 — 2단계 CSV·마크다운 내보내기
// Design Ref: §10.1 lib/exportFile.js

/**
 * 엑셀이 한글을 깨뜨리지 않게 파일 맨 앞에 붙이는 표식(BOM).
 * 이게 없으면 엑셀이 CSV를 다른 글자표로 읽어 제목이 깨진다.
 */
export const UTF8_BOM = '﻿';

/** CSV 한 칸. 쉼표·따옴표·줄바꿈이 들어 있으면 따옴표로 감싸고 안쪽 따옴표는 두 번 쓴다. */
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** 줄은 CRLF로 잇는다 — 엑셀이 기대하는 모양이다. */
function csvRows(rows) {
  return UTF8_BOM + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** 마지막 회차. 재독(작업 30)하면 회차가 늘어나므로 항상 마지막 것을 본다. */
function lastRead(book) {
  const reads = Array.isArray(book?.reads) ? book.reads : [];
  return reads[reads.length - 1] ?? {};
}

/** 별점은 reads[].review.rating에만 있다. (CLAUDE.md 6절) */
function ratingOf(book) {
  return lastRead(book).review?.rating ?? null;
}

// ── 책 ────────────────────────────────────────────────

const BOOK_HEADER = [
  '제목',
  '지은이',
  '장르',
  '총 페이지',
  '상태',
  '시작일',
  '완독일',
  '별점',
  '회차',
];

/** 책 목록을 CSV로. */
export function booksToCsv(books) {
  const rows = books.map((book) => {
    const read = lastRead(book);
    return [
      book.title,
      book.author,
      book.genre,
      book.totalPages,
      book.status,
      read.startedAt,
      read.finishedAt,
      ratingOf(book),
      Array.isArray(book.reads) ? book.reads.length : 0,
    ];
  });

  return csvRows([BOOK_HEADER, ...rows]);
}

/**
 * 마크다운의 제목(`##`)과 표는 **한 줄이어야** 뜻이 통한다.
 * 줄바꿈이 섞인 값이 들어오면 둘째 줄부터 제목이나 칸에서 빠져나가 버린다.
 * (손으로 고친 백업을 복원하면 그런 값이 들어올 수 있다)
 */
function oneLine(value) {
  return String(value ?? '').replace(/\s*\r?\n\s*/g, ' ').trim();
}

/** 마크다운 표 안에서는 `|`가 칸을 나누는 글자라 그대로 두면 표가 깨진다. */
function mdCell(value) {
  if (value === null || value === undefined || value === '') return '—';
  return oneLine(value).replace(/\|/g, '\\|');
}

/** 책 목록을 마크다운 표로. 블로그에 붙이면 그대로 표가 된다. */
export function booksToMarkdown(books, today) {
  const lines = [
    '# 나의 책장',
    '',
    `${books.length}권 · ${today} 기준`,
    '',
    `| ${BOOK_HEADER.join(' | ')} |`,
    `| ${BOOK_HEADER.map(() => '---').join(' | ')} |`,
  ];

  for (const book of books) {
    const read = lastRead(book);
    const cells = [
      book.title,
      book.author,
      book.genre,
      book.totalPages,
      book.status,
      read.startedAt,
      read.finishedAt,
      ratingOf(book),
      Array.isArray(book.reads) ? book.reads.length : 0,
    ];
    lines.push(`| ${cells.map(mdCell).join(' | ')} |`);
  }

  return `${lines.join('\n')}\n`;
}

// ── 구절 ──────────────────────────────────────────────

const QUOTE_HEADER = ['책 제목', '지은이', '쪽', '구절', '내 생각'];

/**
 * 구절을 CSV로.
 * 어느 책의 구절인지 알 수 있게 제목·지은이를 함께 적는다 —
 * 파일 하나만 열어도 뜻이 통해야 한다.
 */
export function quotesToCsv(quotes, books) {
  const bookById = new Map(books.map((book) => [book.id, book]));

  const rows = quotes.map((quote) => {
    const book = bookById.get(quote.bookId);
    return [
      book?.title ?? '(지운 책)',
      book?.author ?? '',
      quote.page,
      quote.text,
      quote.thought,
    ];
  });

  return csvRows([QUOTE_HEADER, ...rows]);
}

/** 여러 줄짜리 구절도 인용문으로 보이게 모든 줄 앞에 `> `를 붙인다. */
function blockquote(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => (line === '' ? '>' : `> ${line}`))
    .join('\n');
}

/**
 * 구절을 마크다운으로. **블로그에 옮기는 것이 목적**이라 책별로 묶어 적는다.
 * 책 제목이 소제목, 구절이 인용문, 내 생각이 그 아래 문단이 된다.
 */
export function quotesToMarkdown(quotes, books, today) {
  const lines = ['# 모아둔 구절', '', `${quotes.length}개 · ${today} 기준`];

  // 책이 등록된 순서대로 묶는다. 구절만 모아 보면 어느 책인지 알 수 없다.
  const groups = books
    .map((book) => ({
      book,
      list: quotes.filter((quote) => quote.bookId === book.id),
    }))
    .filter((group) => group.list.length > 0);

  // 책을 지웠는데 구절만 남은 경우는 정상적으로는 없지만(deleteBook이 함께 지운다),
  // 손으로 고친 백업을 복원하면 생길 수 있어 버리지 않고 맨 뒤에 모은다.
  const knownIds = new Set(books.map((book) => book.id));
  const orphans = quotes.filter((quote) => !knownIds.has(quote.bookId));

  for (const { book, list } of groups) {
    const heading = oneLine(book.title);
    const writer = oneLine(book.author);
    lines.push('', `## ${heading}${writer ? ` — ${writer}` : ''}`);
    for (const quote of list) {
      lines.push('', blockquote(quote.text));
      lines.push('', `— ${quote.page ? `${quote.page}쪽` : '쪽수 없음'}`);
      if (quote.thought) lines.push('', quote.thought);
    }
  }

  if (orphans.length > 0) {
    lines.push('', '## 책을 알 수 없는 구절');
    for (const quote of orphans) {
      lines.push('', blockquote(quote.text));
    }
  }

  return `${lines.join('\n')}\n`;
}

// ── 파일 이름 ─────────────────────────────────────────

/** 예: 나의책장-구절-2026-09-20.md — 날짜를 넣어 여러 번 받아도 섞이지 않게 한다. */
export function exportFileName(what, extension, today) {
  return `나의책장-${what}-${today}.${extension}`;
}

// ── 구절 하나 복사 (S8) ───────────────────────────────

/**
 * 구절 하나를 블로그에 바로 붙일 수 있는 모양으로 만든다.
 *
 * 구절만 복사하면 어느 책에서 왔는지 다시 찾아 적어야 한다.
 * 출처까지 함께 넣어야 **클릭 1회**로 끝난다. (Plan SC: S8)
 */
export function quoteToText(quote, book) {
  const source = [book?.title, book?.author].filter(Boolean).join(', ');
  const place = quote.page ? ` (${quote.page}쪽)` : '';

  const lines = [`"${quote.text}"`];
  if (source) lines.push(`— ${source}${place}`);
  else if (place) lines.push(`—${place}`);

  return lines.join('\n');
}
