// 나의 책장 — 저장소
//
// 이 파일은 localStorage로 드나드는 "유일한 통로"다.
// 화면 코드는 localStorage를 직접 부르지 않고 항상 여기 함수를 쓴다.
//
// Design Ref: §1.2 "저장소는 한 문" — 저장 경로를 한 곳에 모아야 감시할 수 있다
// Design Ref: §5.1 저장 위치와 키
// Plan SC: S9 저장 구조 변경 후 기존 데이터 보존율 100%

import {
  BOOK_STATUS,
  DEFAULT_BOOK_STATUS,
  DEFAULT_GENRE,
  isValidGenre,
} from '@/lib/constants';
import { todayKST } from '@/lib/date';

/**
 * 저장 구조 버전.
 * 구조가 바뀌면 이 숫자를 올리고 lib/migrate.js에 변환을 **함께** 추가한다.
 * 하나만 올리면 예전 기록을 가진 브라우저가 화면에서 값을 잃는다.
 * 1단계 = 1 / 2 = 작업 29·30·31 / **지금 = 3**(작업 36·37·40)
 * Design Ref: §5.3 저장 구조 버전 로드맵
 */
export const SCHEMA_VERSION = 3;

/**
 * localStorage 키 이름.
 * 문자열을 코드 여기저기에 흩뿌리지 않기 위해 항상 이 상수를 거친다.
 */
export const STORAGE_KEYS = {
  books: 'books',
  quotes: 'quotes',
  toRead: 'toRead',
  schemaVersion: 'schemaVersion',
  /** 연간 목표 등 설정 (작업 36) */
  settings: 'settings',
  /** 화면 상태 — 오늘의 구절 최근 노출 id 등 (작업 40) */
  ui: 'ui',
};

/** 목록 키 3종 — 초기화와 검사에서 함께 돈다. */
const LIST_KEYS = [STORAGE_KEYS.books, STORAGE_KEYS.quotes, STORAGE_KEYS.toRead];

/** 저장소에서 생기는 실패의 종류. 화면이 이 값을 보고 무엇을 권할지 고른다. */
export const STORAGE_ERROR = {
  /** 저장 공간이 꽉 찼다 */
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  /** 이 브라우저에서는 저장소를 쓸 수 없다 */
  UNAVAILABLE: 'UNAVAILABLE',
};

/**
 * 저장소에서 생기는 오류.
 * code로 화면이 어떤 안내 문구를 띄울지 고른다.
 * Design Ref: §8 오류 처리
 */
export class StorageError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * 저장 중 난 오류를 화면이 그대로 쓸 수 있는 모양으로 바꾼다.
 * 문구만이 아니라 code까지 함께 넘겨야 ErrorNote가
 * "데이터 화면으로 가기" 길을 붙일지 판단할 수 있다.
 *
 * @param error    catch로 받은 값
 * @param fallback StorageError가 아닐 때 보여줄 문구
 * @returns {{ message: string, code?: string }}
 */
export function describeStorageError(error, fallback) {
  if (error instanceof StorageError) {
    return { message: error.message, code: error.code };
  }
  return { message: fallback };
}

/**
 * 지금 localStorage를 쓸 수 있는지.
 * 서버에서 화면을 그리는 동안에는 window가 없으므로 false가 된다.
 * 사생활 보호 모드처럼 접근 자체가 막히는 경우도 여기서 걸러진다.
 */
export function isStorageAvailable() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probe = '__probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** 저장소를 쓸 수 없으면 바로 멈춘다. 호출한 쪽이 이유를 알 수 있게 한다. */
function requireStorage() {
  if (!isStorageAvailable()) {
    throw new StorageError(
      'UNAVAILABLE',
      '이 브라우저에서는 기록을 저장할 수 없어요.',
    );
  }
}

/**
 * 키 하나를 읽어 JSON으로 되돌린다.
 * 값이 없거나 깨져 있으면 fallback을 돌려준다 — 앱이 멈추지 않게 하기 위해서다.
 */
function readKey(key, fallback) {
  requireStorage();
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    // 깨진 값은 덮어쓰지 않고 그대로 둔다. 사용자가 백업으로 되살릴 여지를 남긴다.
    return fallback;
  }
}

/**
 * 키 하나에 JSON으로 저장한다.
 * 저장 공간이 꽉 차면 QUOTA_EXCEEDED로 알린다.
 * Design Ref: §8 "저장 공간이 부족해요. 백업 후 정리해주세요"
 */
function writeKey(key, value) {
  requireStorage();
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    const isQuota =
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    if (isQuota) {
      throw new StorageError(
        'QUOTA_EXCEEDED',
        '저장 공간이 부족해요. 백업 후 정리해주세요.',
        error,
      );
    }
    throw error;
  }
}

/**
 * 저장된 글자를 그대로 읽는다. 없거나 못 읽으면 null.
 *
 * 값이 지난번과 같은지만 견주려는 용도다(components/BookStore.js).
 * 읽을 때마다 JSON을 새로 풀면 화면이 "바뀌었다"고 보고 끝없이 다시 그린다.
 * 화면이 localStorage를 직접 부르지 않도록 여기에 둔다. (CLAUDE.md 5절)
 */
export function getRawItem(key) {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * 목록을 읽는다. 어떤 이유로든 배열이 아니면 빈 배열로 본다.
 * 화면 코드가 항상 배열을 받는다고 믿을 수 있게 하기 위해서다.
 */
function readList(key) {
  const value = readKey(key, []);
  return Array.isArray(value) ? value : [];
}

// ── 책 ────────────────────────────────────────────────

export function getBooks() {
  return readList(STORAGE_KEYS.books);
}

export function setBooks(books) {
  writeKey(STORAGE_KEYS.books, books);
}

/**
 * 폼에서 온 값을 저장할 모양으로 다듬는다.
 * 등록(addBook)과 수정(updateBook)이 같은 규칙을 쓰도록 한 곳에 둔다.
 */
function cleanBookFields({ title, author, genre, totalPages }) {
  return {
    title: String(title ?? '').trim(),
    author: String(author ?? '').trim(),
    genre: isValidGenre(genre) ? genre : DEFAULT_GENRE,
    totalPages:
      Number.isInteger(totalPages) && totalPages > 0 ? totalPages : null,
  };
}

/**
 * 새 책을 서재에 넣는다.
 *
 * 폼이 채운 값만 받고 고유번호·1회차·등록 시각은 여기서 만든다.
 * 책을 만드는 곳이 하나가 아니라서(작업 4 등록 폼, 작업 23 "읽기 시작")
 * 책의 모양을 한 곳에서만 정하려는 것이다.
 *
 * Design Ref: §4.2 7단계 "storage.addBook() → localStorage"
 * Design Ref: §5.2 "reads는 1단계부터 배열 — 재독이 push 한 줄로 끝난다"
 *
 * @returns 저장된 책
 */
export function addBook({ title, author, genre, totalPages, startedAt }) {
  const book = {
    id: makeId(),
    ...cleanBookFields({ title, author, genre, totalPages }),
    status: DEFAULT_BOOK_STATUS,
    // 1회차. 재독(작업 30)은 여기에 회차를 더한다.
    reads: [
      {
        round: 1,
        startedAt,
        finishedAt: null, // 읽는 중이면 비어 있다
        review: null, // 완독 감상(작업 21)에서 채운다
      },
    ],
    createdAt: new Date().toISOString(),
  };

  setBooks([...getBooks(), book]);
  return book;
}

/** 고유번호로 책 한 권을 찾는다. 없으면 null. */
export function getBookById(id) {
  return getBooks().find((book) => book.id === id) ?? null;
}

/**
 * 책 한 권을 고친다.
 *
 * 넘긴 항목만 바꾸고 나머지는 그대로 둔다 — id와 createdAt은 건드리지 않는다.
 *
 * Design Ref: §3.3③ 책 상세 "수정 화면에 시작일·완독일·상태 편집 포함"
 *
 * @returns 고쳐진 책. 그런 책이 없으면 null
 */
export function updateBook(id, changes) {
  const books = getBooks();
  const index = books.findIndex((book) => book.id === id);
  if (index === -1) return null;

  const { title, author, genre, totalPages, ...rest } = changes;

  // "넘기지 않은 항목"과 "비우려고 null을 넘긴 항목"을 갈라야 한다.
  // ?? 로 처리하면 총 페이지를 비워 저장해도 옛 값이 되살아나 지울 수 없었다.
  const 넘겼나 = (key) => Object.prototype.hasOwnProperty.call(changes, key);
  const 고를값 = (key, 새값) => (넘겼나(key) ? 새값 : books[index][key]);

  const updated = {
    ...books[index],
    ...rest,
    ...cleanBookFields({
      title: 고를값('title', title),
      author: 고를값('author', author),
      genre: 고를값('genre', genre),
      totalPages: 고를값('totalPages', totalPages),
    }),
  };

  const next = [...books];
  next[index] = updated;
  setBooks(next);
  return updated;
}

/**
 * 책을 다 읽은 것으로 표시한다.
 *
 * 지금 읽고 있는 회차의 완독일을 오늘로 적고, 상태를 '완독'으로 바꾼다.
 * 날짜는 한국 시간 기준이다. (Design Ref: §5.2)
 *
 * 되돌리고 싶으면 책 상세의 고치기에서 상태를 '읽는 중'으로 바꾸면 된다.
 * 그러면 완독일도 함께 지워진다. (작업 15)
 *
 * Design Ref: §4.4 흐름 3 — "reads[마지막].finishedAt = 오늘, status = '완독'"
 *
 * @returns 고쳐진 책. 그런 책이 없거나 회차가 없으면 null
 */
export function finishReading(id) {
  const book = getBookById(id);
  if (!book) return null;

  const reads = [...(book.reads ?? [])];
  const lastIndex = reads.length - 1;
  if (lastIndex < 0) return null;

  reads[lastIndex] = {
    ...reads[lastIndex],
    // 이미 날짜가 적혀 있으면 그대로 둔다. 덮어쓸 이유가 없다.
    finishedAt: reads[lastIndex].finishedAt ?? todayKST(),
  };

  return updateBook(id, { status: BOOK_STATUS.FINISHED, reads });
}

/**
 * 다시 읽기 시작한다 — 새 회차를 더한다. (작업 30)
 *
 * 지난 회차를 **고치지 않고 그대로 둔 채 뒤에 붙인다.** 이게 `reads`를 1단계부터
 * 배열로 둔 이유다. 지난번 별점·감상이 남아 있어야 "다시 읽으니 더 좋았다"를 알 수 있고,
 * 작업 35의 "최고 별점 책"도 회차를 견줄 수 있다.
 * (Design Ref: §5.2 "reads — 재독이 reads.push() 한 줄로 끝난다")
 *
 * 다 읽지 않은 책에는 쓰지 않는다. 아직 읽는 중인데 회차를 더하면
 * 끝내지 못한 회차가 기록에 쌓인다.
 *
 * @returns 새 회차가 붙은 책. 다 읽은 책이 아니면 null
 */
export function startReread(id) {
  const book = getBookById(id);
  if (!book) return null;
  if (book.status !== BOOK_STATUS.FINISHED) return null;

  const reads = [...(book.reads ?? [])];
  const lastRound = reads[reads.length - 1]?.round ?? reads.length;

  reads.push({
    round: lastRound + 1,
    startedAt: todayKST(),
    finishedAt: null,
    review: null,
  });

  return updateBook(id, { status: BOOK_STATUS.READING, reads });
}

/**
 * 완독 감상을 담는다.
 *
 * 지금 읽고 있는(막 끝낸) 회차 안에 넣는다.
 * ★ 별점도 여기 들어간다 — `book.rating` 같은 평평한 필드를 만들지 않는다. ★
 * 재독하면 회차가 늘어나므로, 회차마다 그때의 감상과 별점이 따로 남는다.
 * (CLAUDE.md 6절 / 문서 검토 때 정한 것)
 *
 * Design Ref: §4.4 흐름 3 — "reads[마지막].review = {분위기, 좋았던 점, 난이도, 메모}"
 * Design Ref: §5 회차 구조
 *
 * @returns 고쳐진 책. 그런 책이 없거나 회차가 없으면 null
 */
export function saveReview(id, { mood, likedPoints, difficulty, rating, memo }) {
  const book = getBookById(id);
  if (!book) return null;

  const reads = [...(book.reads ?? [])];
  const lastIndex = reads.length - 1;
  if (lastIndex < 0) return null;

  reads[lastIndex] = {
    ...reads[lastIndex],
    review: {
      mood: mood || null,
      likedPoints: Array.isArray(likedPoints) ? likedPoints : [],
      difficulty: difficulty || null,
      // 별점을 고르지 않았으면 null. 0점으로 적어두면 "0점을 줬다"로 읽힌다.
      rating: typeof rating === 'number' && rating > 0 ? rating : null,
      memo: String(memo ?? '').trim(),
    },
  };

  return updateBook(id, { reads });
}

/**
 * 책 한 권을 서재에서 뺀다.
 *
 * 부르기 전에 반드시 사용자에게 확인을 받는다. (PRD M1 "삭제 전 확인창")
 *
 * 그 책에 딸린 구절도 함께 지운다. 남겨두면 어느 책의 것인지 알 수 없는
 * 구절이 저장소에 쌓이고, 나중에 통계(작업 33)의 숫자도 어긋난다.
 *
 * @returns 실제로 지웠으면 true
 */
export function deleteBook(id) {
  const books = getBooks();
  const next = books.filter((book) => book.id !== id);
  if (next.length === books.length) return false;

  setBooks(next);

  // 딸린 구절도 함께 치운다.
  const quotes = getQuotes();
  const keptQuotes = quotes.filter((quote) => quote.bookId !== id);
  if (keptQuotes.length !== quotes.length) setQuotes(keptQuotes);

  return true;
}

/**
 * 같은 제목의 책이 서재에 이미 있는지 찾는다.
 *
 * 앞뒤 공백과 영문 대소문자는 무시한다 — " 사피엔스 "와 "사피엔스"를 같은 책으로 본다.
 * 찾더라도 등록을 막지는 않는다. 알리고 물어본 뒤 결정은 사용자가 한다.
 *
 * Design Ref: §3.3② "제목 중복 — 이미 서재에 있습니다. 그래도 등록할까요?"
 */
export function findBooksByTitle(title) {
  const needle = String(title ?? '').trim().toLowerCase();
  if (!needle) return [];
  return getBooks().filter(
    (book) => String(book.title ?? '').trim().toLowerCase() === needle,
  );
}

// ── 구절 ──────────────────────────────────────────────

export function getQuotes() {
  return readList(STORAGE_KEYS.quotes);
}

export function setQuotes(quotes) {
  writeKey(STORAGE_KEYS.quotes, quotes);
}

/**
 * 구절 하나를 담는다.
 *
 * 페이지는 적지 않아도 된다. 비워두면 null로 두고,
 * 모아볼 때 맨 뒤로 보낸다. (PRD M2 / Design Ref: §5)
 *
 * Design Ref: §3.3④ 구절 추가
 *
 * @returns 저장된 구절
 */
/**
 * 태그 목록을 다듬는다. (작업 39)
 *
 * 앞뒤 공백을 떼고, 빈 것과 중복을 없앤다.
 * 같은 태그가 두 번 들어가면 모아볼 때 같은 구절이 두 번 나온다.
 */
function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const list = [];
  for (const tag of tags) {
    const clean = String(tag ?? '').trim();
    if (clean === '' || seen.has(clean)) continue;
    seen.add(clean);
    list.push(clean);
  }
  return list;
}

export function addQuote({ bookId, text, page, thought, tags }) {
  const quote = {
    id: makeId(),
    bookId,
    text: String(text ?? '').trim(),
    page: Number.isInteger(page) && page > 0 ? page : null,
    thought: String(thought ?? '').trim(),
    tags: cleanTags(tags),
    createdAt: new Date().toISOString(),
  };

  setQuotes([...getQuotes(), quote]);
  return quote;
}

/**
 * 써둔 태그를 많은 순으로 모은다. (작업 39)
 * 개수가 같으면 가나다 순으로 — 볼 때마다 순서가 바뀌지 않게 한다.
 *
 * @returns [{ tag, count }]
 */
export function getTagCounts() {
  const counts = new Map();
  for (const quote of getQuotes()) {
    for (const tag of cleanTags(quote.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ko'));
}

/** 어떤 책의 구절만 골라낸다. */
export function getQuotesByBook(bookId) {
  return getQuotes().filter((quote) => quote.bookId === bookId);
}

/**
 * 구절 하나를 고친다. 넘긴 항목만 바꾸고 나머지는 그대로 둔다.
 * id·bookId·createdAt은 건드리지 않는다.
 *
 * @returns 고쳐진 구절. 그런 구절이 없으면 null
 */
export function updateQuote(id, { text, page, thought, tags }) {
  const quotes = getQuotes();
  const index = quotes.findIndex((quote) => quote.id === id);
  if (index === -1) return null;

  const updated = {
    ...quotes[index],
    text: String(text ?? quotes[index].text).trim(),
    page: Number.isInteger(page) && page > 0 ? page : null,
    thought: String(thought ?? quotes[index].thought ?? '').trim(),
    // 태그를 넘기지 않았으면 있던 것을 그대로 둔다. (작업 39)
    tags: tags === undefined ? cleanTags(quotes[index].tags) : cleanTags(tags),
  };

  const next = [...quotes];
  next[index] = updated;
  setQuotes(next);
  return updated;
}

/**
 * 구절 하나를 지운다.
 * 부르기 전에 반드시 사용자에게 확인을 받는다. (CLAUDE.md 8절)
 *
 * @returns 실제로 지웠으면 true
 */
export function deleteQuote(id) {
  const quotes = getQuotes();
  const next = quotes.filter((quote) => quote.id !== id);
  if (next.length === quotes.length) return false;
  setQuotes(next);
  return true;
}

// ── 읽을 책 ───────────────────────────────────────────

export function getToRead() {
  return readList(STORAGE_KEYS.toRead);
}

export function setToRead(toRead) {
  writeKey(STORAGE_KEYS.toRead, toRead);
}

/**
 * 추천받은 책을 "읽을 책"에 담는다.
 *
 * 추천 이유도 함께 남긴다 — 나중에 목록에서 "왜 저장했더라"를 알 수 있어야 한다.
 *
 * Design Ref: §3.3⑥ 추천 결과 — "읽을 책에 저장"
 * Design Ref: §5 읽을 책(toRead) 데이터
 *
 * @returns 저장된 항목
 */
export function addToRead({ title, author, reason }) {
  const item = {
    id: makeId(),
    title: String(title ?? '').trim(),
    author: String(author ?? '').trim(),
    reason: String(reason ?? '').trim(),
    savedAt: new Date().toISOString(),
  };

  setToRead([...getToRead(), item]);
  return item;
}

/**
 * "읽을 책"에서 하나를 뺀다.
 *
 * 읽기 시작했거나 마음이 바뀌었을 때 쓴다. 빼지 못하면 목록이 쌓이기만 한다.
 * 부르기 전에 사용자에게 확인을 받는다. (CLAUDE.md 8절)
 *
 * @returns 실제로 뺐으면 true
 */
export function deleteToRead(id) {
  const list = getToRead();
  const next = list.filter((item) => item.id !== id);
  if (next.length === list.length) return false;
  setToRead(next);
  return true;
}

// ── 저장 구조 버전 ────────────────────────────────────

/** 저장된 버전. 아직 없으면 null — 첫 실행인지 판단하는 데 쓴다. */
export function getSchemaVersion() {
  const value = readKey(STORAGE_KEYS.schemaVersion, null);
  return typeof value === 'number' ? value : null;
}

export function setSchemaVersion(version) {
  writeKey(STORAGE_KEYS.schemaVersion, version);
}

// ── 설정 (작업 36) ────────────────────────────────────

/**
 * 연간 목표의 기본값. **0은 "정하지 않음"** 이다.
 * 0을 "목표 0권"으로 읽으면 진행률이 늘 100%가 되어 아무 뜻이 없다.
 */
export const DEFAULT_SETTINGS = {
  /** 올해 읽을 권수 목표 */
  yearlyBooks: 0,
  /** 올해 읽을 쪽수 목표 */
  yearlyPages: 0,
};

/** 설정을 읽는다. 없거나 깨져 있으면 기본값. */
export function getSettings() {
  const value = readKey(STORAGE_KEYS.settings, null);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_SETTINGS };
  }
  return { ...DEFAULT_SETTINGS, ...value };
}

/** 넘긴 항목만 바꾼다. 나중에 설정이 늘어도 서로 덮어쓰지 않게 하기 위해서다. */
export function saveSettings(changes) {
  const next = { ...getSettings(), ...changes };
  writeKey(STORAGE_KEYS.settings, next);
  return next;
}

// ── 화면 상태 (작업 40) ───────────────────────────────

/**
 * 화면 상태를 읽는다. 기록이 아니라 **화면을 위한 메모**다.
 * 백업 파일에 담지 않는다 — 다른 기기로 옮길 값이 아니다.
 */
export function getUiState() {
  const value = readKey(STORAGE_KEYS.ui, null);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value;
}

/** 넘긴 항목만 바꾼다. */
export function saveUiState(changes) {
  const next = { ...getUiState(), ...changes };
  writeKey(STORAGE_KEYS.ui, next);
  return next;
}

// ── 읽는 중인 책의 현재 페이지 (작업 37) ──────────────

/**
 * 지금 몇 쪽까지 읽었는지 적는다.
 *
 * 총 페이지를 아는 책만 진행률을 낼 수 있지만, 총 페이지를 몰라도 쪽수 자체는 적을 수 있게 한다.
 * 다 읽은 책에는 쓰지 않는다 — 끝난 책의 '현재 페이지'는 뜻이 없다.
 *
 * @param page 숫자면 그 쪽, null이면 지움
 * @returns 고쳐진 책. 그런 책이 없으면 null
 */
export function setCurrentPage(id, page) {
  const book = getBookById(id);
  if (!book) return null;

  const clean =
    Number.isInteger(page) && page > 0
      ? // 총 페이지를 아는 책이면 그 너머로 넘어가지 않게 잡아 둔다.
        Number.isInteger(book.totalPages) && book.totalPages > 0
        ? Math.min(page, book.totalPages)
        : page
      : null;

  return updateBook(id, { currentPage: clean });
}

// ── 복원 ──────────────────────────────────────────────

/**
 * 백업 내용으로 통째로 되돌린다. (작업 27)
 *
 * 세 목록과 버전을 한꺼번에 바꾼다. 중간에 실패하면 **바꾸기 전으로 되돌린다** —
 * 책은 새 파일 것인데 구절은 옛 것인 어정쩡한 상태가 남으면
 * 어느 쪽도 믿을 수 없게 되기 때문이다.
 * (Design Ref: §5.3 "변환 전에 현재 데이터의 백업본을 잡아두고, 오류가 나면 되돌린다")
 *
 * 부르기 전에 사용자 확인을 받는다. 덮어쓰기는 되돌릴 수 없다. (CLAUDE.md 8절)
 *
 * @param data {{ schemaVersion: number, books: Array, quotes: Array, toRead: Array }}
 * @returns {{ books: number, quotes: number, toRead: number }} 반영된 개수
 */
export function restoreBackup({ schemaVersion, books, quotes, toRead }) {
  requireStorage();

  const before = {
    books: getBooks(),
    quotes: getQuotes(),
    toRead: getToRead(),
    schemaVersion: getSchemaVersion(),
  };

  try {
    setBooks(books);
    setQuotes(quotes);
    setToRead(toRead);
    setSchemaVersion(schemaVersion);
  } catch (error) {
    // 되돌린다. 되돌리다 또 실패하면 그 오류는 덮어쓰지 않는다 —
    // 사용자에게 알려야 하는 것은 처음에 막힌 이유(예: 저장 공간 부족)다.
    try {
      setBooks(before.books);
      setQuotes(before.quotes);
      setToRead(before.toRead);
      if (before.schemaVersion !== null) setSchemaVersion(before.schemaVersion);
    } catch {
      // 되돌리기조차 안 되는 상황은 저장소 자체가 막힌 경우다. 아래에서 알린다.
    }
    throw error;
  }

  return { books: books.length, quotes: quotes.length, toRead: toRead.length };
}

// ── 초기화 ────────────────────────────────────────────

/**
 * 저장소를 쓸 준비를 한다. 앱이 시작할 때 한 번 부른다.
 *
 * - 처음이면 빈 목록 3개와 버전을 만든다
 * - 이미 있으면 건드리지 않는다 (기존 기록을 덮어쓰지 않는다)
 * - 목록 중 일부만 없으면 그것만 채운다
 *
 * @returns {{ created: boolean, version: number|null, available: boolean }}
 *   created: 이번에 새로 만들었는지 / version: 현재 저장된 버전
 */
export function initStorage() {
  if (!isStorageAvailable()) {
    return { created: false, version: null, available: false };
  }

  const existingVersion = getSchemaVersion();
  const isFirstRun = existingVersion === null;

  // 없는 목록만 빈 배열로 채운다. 있는 목록은 그대로 둔다.
  for (const key of LIST_KEYS) {
    if (window.localStorage.getItem(key) === null) {
      writeKey(key, []);
    }
  }

  // 설정도 없으면 기본값으로 만들어 둔다. (작업 36)
  // 백업 파일에는 담기지 않는 키라 복원으로는 생기지 않는다.
  if (window.localStorage.getItem(STORAGE_KEYS.settings) === null) {
    writeKey(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS });
  }

  if (isFirstRun) {
    setSchemaVersion(SCHEMA_VERSION);
  }

  return {
    created: isFirstRun,
    version: getSchemaVersion(),
    available: true,
  };
}

// ── 공통 ──────────────────────────────────────────────

/**
 * 새 기록의 고유 번호를 만든다.
 * 브라우저에 들어 있는 기능이라 따로 설치할 도구가 없다.
 * Design Ref: §5.2 "id 만들기 — crypto.randomUUID()"
 */
export function makeId() {
  return crypto.randomUUID();
}
