// 백업 파일 만들기와 되돌리기
//
// 기록은 이 브라우저 안에만 있다. 저장소를 지우거나 기기를 바꾸면 사라진다.
// 그래서 통째로 파일 하나에 담아 내려받을 수 있게 한다.
//
// ★ schemaVersion을 반드시 함께 담는다. ★
// 없으면 나중에 복원할 때 이 파일이 어느 형식인지 알 수 없어 변환을 못 한다.
// (Design Ref: §4.6 / 문서 검토 때 잡은 것)
//
// ★ API 키나 설정값은 담지 않는다. ★
// 아래에서 읽는 것은 books·quotes·toRead·schemaVersion 네 가지뿐이라,
// 다른 것이 섞여 들어갈 길이 구조적으로 없다. (PRD 7절 / CLAUDE.md 9절)
//
// Design Ref: §4.6 흐름 5 — 백업과 복원
// Design Ref: §10.1 lib/backup.js

import {
  getBooks,
  getQuotes,
  getToRead,
  getSchemaVersion,
  restoreBackup,
  SCHEMA_VERSION,
} from '@/lib/storage';
import { migrate, needsMigration, MigrateError } from '@/lib/migrate';
import {
  DEFAULT_BOOK_STATUS,
  DEFAULT_GENRE,
  isValidGenre,
  isValidStatus,
} from '@/lib/constants';

/**
 * 지금 저장된 것을 백업할 모양으로 모은다.
 *
 * @returns {{ schemaVersion: number, books: Array, quotes: Array, toRead: Array }}
 */
export function buildBackup() {
  return {
    schemaVersion: getSchemaVersion() ?? SCHEMA_VERSION,
    books: getBooks(),
    quotes: getQuotes(),
    toRead: getToRead(),
  };
}

/** 백업 파일 이름. 날짜를 넣어 여러 번 받아도 섞이지 않게 한다. */
export function backupFileName(today) {
  return `나의책장-${today}.json`;
}

/**
 * 파일로 내려받는다.
 *
 * 브라우저에 "이 내용을 파일로 저장해줘"라고 시키는 방법이 이것뿐이라
 * 눈에 보이지 않는 링크를 잠깐 만들어 누른다.
 *
 * 만든 주소는 거둬들인다. 바로 거두면 내려받기가 시작되기 전에 사라질 수 있어
 * 아주 잠깐 뒤에 거둔다.
 */
export function downloadText(text, fileName, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 백업(JSON)을 내려받는다. 사람이 열어볼 수도 있게 들여쓰기해 둔다. */
export function downloadJson(data, fileName) {
  downloadText(
    JSON.stringify(data, null, 2),
    fileName,
    'application/json;charset=utf-8',
  );
}

// ── 되돌리기 (작업 27) ────────────────────────────────

/** 파일을 되돌리다 생기는 실패의 종류. */
export const RESTORE_ERROR = {
  /** 백업 파일이 아니거나 모양이 깨졌다 */
  BAD_FILE: 'BAD_FILE',
  /** 이 앱보다 새 형식이다 */
  TOO_NEW: 'TOO_NEW',
  /** 예전 형식을 바꾸다 실패했다 */
  MIGRATE_FAILED: 'MIGRATE_FAILED',
};

export class RestoreError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'RestoreError';
    this.code = code;
    this.cause = cause;
  }
}

/** §8이 정한 문구. 원문 오류를 그대로 보여주지 않는다. */
const BAD_FILE_MESSAGE = '이 파일은 백업 파일이 아닌 것 같아요.';

/**
 * 백업 파일의 모양을 검사한다.
 *
 * 여기서 걸러야 잘못된 파일로 기존 기록을 덮어쓰는 사고를 막을 수 있다.
 * 개수나 내용은 보지 않는다 — **비어 있는 백업도 정상**이기 때문이다.
 *
 * @throws {RestoreError} BAD_FILE
 */
function requireBackupShape(data) {
  const isObject =
    data !== null && typeof data === 'object' && !Array.isArray(data);

  const hasVersion =
    isObject &&
    Number.isInteger(data.schemaVersion) &&
    data.schemaVersion >= 1;

  const hasLists =
    isObject &&
    Array.isArray(data.books) &&
    Array.isArray(data.quotes) &&
    Array.isArray(data.toRead);

  if (!hasVersion || !hasLists) {
    throw new RestoreError(RESTORE_ERROR.BAD_FILE, BAD_FILE_MESSAGE);
  }
}

/**
 * 기록 하나하나를 앱이 다룰 수 있는 모양으로 맞춘다.
 *
 * **기록을 버리지 않는다.** 모르는 장르·상태가 들어 있으면 기본값으로 바꿔 담을 뿐이다.
 * 한 줄이라도 버리면 보존율 100%(S7·S9)가 깨지기 때문이다.
 * 손으로 고친 파일이나 다른 기기에서 온 파일이 화면을 망가뜨리지 않게 하는 마지막 그물이다.
 */
function normalizeBooks(books) {
  return books.map((book) => ({
    ...book,
    genre: isValidGenre(book?.genre) ? book.genre : DEFAULT_GENRE,
    status: isValidStatus(book?.status) ? book.status : DEFAULT_BOOK_STATUS,
    // reads는 배열이어야 한다. 화면이 reads[reads.length - 1]을 꺼내 쓴다.
    reads: Array.isArray(book?.reads) ? book.reads : [],
  }));
}

/**
 * 고른 파일을 읽어 **어떤 파일인지만** 알려준다. 아직 아무것도 덮어쓰지 않는다.
 *
 * 확인창에 "무엇이 들어왔고, 무엇을 덮어쓰게 되는지"를 보여주려면
 * 반영하기 전에 내용을 알아야 하기 때문에 이 단계를 따로 둔다.
 * (Design Ref: §4.6 "모양 검사 → schemaVersion 확인 → 경고 → 사용자 확인 → 반영")
 *
 * @returns {{ data, version: number, needsMigrate: boolean,
 *             counts: { books: number, quotes: number, toRead: number } }}
 * @throws {RestoreError} BAD_FILE / TOO_NEW
 */
export async function inspectBackupFile(file) {
  let text;
  try {
    text = await file.text();
  } catch (error) {
    throw new RestoreError(
      RESTORE_ERROR.BAD_FILE,
      '파일을 읽지 못했어요. 다시 골라주세요.',
      error,
    );
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new RestoreError(RESTORE_ERROR.BAD_FILE, BAD_FILE_MESSAGE, error);
  }

  requireBackupShape(data);

  // 버전이 더 높으면 여기서 멈춘다. 낮출 방법이 없으므로 확인창까지 가지 않는다.
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new RestoreError(
      RESTORE_ERROR.TOO_NEW,
      '이 앱보다 새 형식이에요. 불러올 수 없어요.',
    );
  }

  return {
    data,
    version: data.schemaVersion,
    needsMigrate: needsMigration(data.schemaVersion),
    counts: {
      books: data.books.length,
      quotes: data.quotes.length,
      toRead: data.toRead.length,
    },
  };
}

/**
 * 확인을 받은 뒤 실제로 반영한다. **여기서부터 기존 기록이 덮어써진다.**
 *
 * 예전 형식이면 먼저 지금 형식으로 올린 다음 반영한다.
 *
 * @returns {{ books: number, quotes: number, toRead: number }} 반영된 개수
 * @throws {RestoreError} MIGRATE_FAILED / TOO_NEW, 또는 저장소 쪽 StorageError
 */
export function applyBackup(data) {
  let ready;
  try {
    ready = migrate(data);
  } catch (error) {
    if (error instanceof MigrateError) {
      const code =
        error.code === 'TOO_NEW'
          ? RESTORE_ERROR.TOO_NEW
          : RESTORE_ERROR.MIGRATE_FAILED;
      throw new RestoreError(code, error.message, error);
    }
    throw error;
  }

  return restoreBackup({ ...ready, books: normalizeBooks(ready.books) });
}
