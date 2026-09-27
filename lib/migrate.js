// 저장 구조 변환
//
// 기록의 모양(schemaVersion)이 바뀌면, 예전 모양으로 저장해 둔 기록을
// 지금 모양으로 바꿔줘야 한다. 그 일을 여기 한 곳에 모은다.
//
// 변환은 **한 칸씩** 올린다. 1→3을 한 번에 하지 않고 1→2, 2→3을 차례로 태운다.
// 그래야 새 버전이 생길 때 앞의 변환을 건드리지 않고 한 줄만 더하면 된다.
//
// 쓰이는 곳은 두 군데다. (Design Ref: §5.3)
//   ① 앱 시작   — 저장된 버전이 낮으면 올린다 (작업 31부터)
//   ② 파일 복원 — 백업 파일의 버전이 낮으면 올린 뒤 반영한다 (작업 27, 지금)
//
// Design Ref: §5.3 저장 구조 버전 로드맵
// Design Ref: §10.1 lib/migrate.js
// Plan SC: S9 저장 구조 변경 후 기존 데이터 보존율 100%

import {
  SCHEMA_VERSION,
  getBooks,
  getQuotes,
  getToRead,
  getSchemaVersion,
  restoreBackup,
  isStorageAvailable,
} from '@/lib/storage';

/** 변환하다 생기는 실패의 종류. */
export const MIGRATE_ERROR = {
  /** 이 앱이 아는 것보다 새 형식이다 — 낮출 수는 없다 */
  TOO_NEW: 'TOO_NEW',
  /** 중간 단계를 올릴 변환기가 없다 */
  NO_STEP: 'NO_STEP',
  /** 변환기를 돌리다 실패했다 */
  FAILED: 'FAILED',
};

export class MigrateError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'MigrateError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * 1 → 2. 상태 4종(작업 29)·재독(작업 30)·0.5점 별점(작업 31)이 들어온 버전.
 *
 * **값을 바꿀 일은 사실 거의 없다.**
 *   · 상태 2종(읽는 중·완독)은 4종 안에 그대로 있다
 *   · 정수 별점 1~5는 0.5 단위 안에 그대로 있다
 *   · `reads`는 1단계부터 배열이라 재독이 들어와도 모양이 같다
 *
 * 딱 하나 옮길 것이 `book.rating`이다. PRD의 데이터 구조 표는 별점을 책에 평평하게
 * 두었고(§5.2에서 회차 안으로 바꾼 결정), 그 모양으로 손수 만든 파일이 들어올 수 있다.
 * 그대로 두면 화면이 `reads[].review.rating`만 보므로 별점이 사라진 것처럼 보인다.
 *
 * Design Ref: §5.3 "2 — 작업 31 … rating을 reads[].review.rating으로 이동"
 */
function v1to2(data) {
  return {
    ...data,
    books: data.books.map((book) => {
      // 평평한 rating이 없으면 손댈 것이 없다.
      if (typeof book?.rating !== 'number' || book.rating <= 0) return book;

      const reads = Array.isArray(book.reads) ? [...book.reads] : [];
      const lastIndex = reads.length - 1;

      // 회차가 없으면 옮겨 담을 자리가 없다. 값을 버리지 않도록 그대로 둔다.
      if (lastIndex < 0) return book;

      const review = reads[lastIndex]?.review ?? null;

      // 이미 회차 안에 별점이 있으면 그쪽이 옳다. 덮어쓰지 않는다.
      if (typeof review?.rating === 'number' && review.rating > 0) {
        const { rating, ...rest } = book;
        return rest;
      }

      reads[lastIndex] = {
        ...reads[lastIndex],
        review: {
          mood: review?.mood ?? null,
          likedPoints: review?.likedPoints ?? [],
          difficulty: review?.difficulty ?? null,
          rating: book.rating,
          memo: review?.memo ?? '',
        },
      };

      // 옮겼으면 평평한 필드는 지운다. 둘이 남으면 어느 쪽이 맞는지 알 수 없다.
      const { rating, ...rest } = book;
      return { ...rest, reads };
    }),
  };
}

/**
 * 2 → 3. 연간 목표(작업 36)·현재 페이지(작업 37)·오늘의 구절(작업 40)이 들어온 버전.
 *
 * 책에 `currentPage` 자리를 만들어 둔다. 없어도 화면은 `?? null`로 읽어 깨지지 않지만,
 * 모양을 맞춰 두면 내보내기·백업 파일이 책마다 다른 모양을 갖지 않는다.
 *
 * `settings`와 `ui`는 **백업 파일에 담기지 않는 키**다(§9 "설정값 미포함").
 * 그래서 여기서 만들지 않고, 읽을 때 기본값을 주는 `getSettings`가 맡는다.
 *
 * Design Ref: §5.3 "3 — 없는 책에 currentPage: null 채우기"
 */
function v2to3(data) {
  return {
    ...data,
    books: data.books.map((book) =>
      Object.prototype.hasOwnProperty.call(book ?? {}, 'currentPage')
        ? book
        : { ...book, currentPage: null },
    ),
  };
}

/**
 * 한 칸 올리는 변환기 모음.
 * 열쇠 `n`은 **"n에서 n+1로 올리는 함수"** 다. 받은 것을 고치지 말고 새 객체를 돌려준다.
 */
const STEPS = {
  1: v1to2,
  2: v2to3,
};

/** 이 버전을 지금 형식으로 올려야 하는가. */
export function needsMigration(version) {
  return version < SCHEMA_VERSION;
}

/**
 * 백업 내용을 지금 형식으로 올린다.
 *
 * 받은 것을 고치지 않고 새 객체를 돌려준다 — 실패했을 때 원본이 그대로 남아 있어야
 * 화면이 "못 불러왔어요"라고 말하고 아무것도 건드리지 않은 채 끝낼 수 있다.
 *
 * @param data {{ schemaVersion: number, books, quotes, toRead }}
 * @returns 같은 모양, 단 schemaVersion이 지금 버전
 * @throws {MigrateError}
 */
export function migrate(data) {
  let current = data;
  let version = data.schemaVersion;

  if (version > SCHEMA_VERSION) {
    throw new MigrateError(
      MIGRATE_ERROR.TOO_NEW,
      '이 앱보다 새 형식이에요. 불러올 수 없어요.',
    );
  }

  while (version < SCHEMA_VERSION) {
    const step = STEPS[version];
    if (typeof step !== 'function') {
      throw new MigrateError(
        MIGRATE_ERROR.NO_STEP,
        '예전 형식을 바꾸는 방법을 찾지 못했어요.',
      );
    }

    try {
      current = step(current);
    } catch (error) {
      throw new MigrateError(
        MIGRATE_ERROR.FAILED,
        '예전 형식을 바꾸는 중에 문제가 생겼어요.',
        error,
      );
    }

    version += 1;
  }

  return { ...current, schemaVersion: SCHEMA_VERSION };
}

/**
 * 앱이 켜질 때 저장소를 지금 형식으로 올린다. (Design Ref: §5.3 "① 앱 시작")
 *
 * 예전 버전에서 쓰던 기록이 그대로 남아 있는 브라우저를 위해서다.
 * 화면이 옛 모양을 만나면 값이 사라진 것처럼 보이므로, 그리기 전에 한 번 올려둔다.
 *
 * **실패하면 아무것도 바꾸지 않는다.** `restoreBackup`이 세 목록을 한꺼번에 쓰고
 * 중간에 막히면 되돌리므로, 반쯤 변환된 상태가 남지 않는다.
 *
 * @returns {{ migrated: boolean, from: number|null, to: number, error: Error|null }}
 */
export function migrateStorage() {
  const done = { migrated: false, from: null, to: SCHEMA_VERSION, error: null };

  if (!isStorageAvailable()) return done;

  const current = getSchemaVersion();

  // 아직 버전이 없으면 initStorage가 맡는다. 여기서 만들지 않는다.
  if (current === null) return done;

  done.from = current;
  if (!needsMigration(current)) return done;

  try {
    const next = migrate({
      schemaVersion: current,
      books: getBooks(),
      quotes: getQuotes(),
      toRead: getToRead(),
    });
    restoreBackup(next);
    done.migrated = true;
  } catch (error) {
    // 올리지 못했어도 앱은 떠야 한다. 옛 모양이어도 대부분의 화면은 읽을 수 있고,
    // 사용자는 최소한 백업을 받아둘 수 있어야 한다.
    done.error = error;
  }

  return done;
}
