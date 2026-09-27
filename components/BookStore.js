'use client';

// 저장된 기록 함께 보기
//
// 서재 목록·구절 모아보기·통계 등 여러 화면이 같은 기록을 본다.
// 화면마다 따로 읽으면 한쪽만 옛 값을 들고 있을 수 있어서, 읽는 통로를 하나로 둔다.
//
// React의 useSyncExternalStore를 쓴다. localStorage처럼 React 바깥에 있는 값을
// 읽어올 때 쓰라고 만들어진 기능이라, 화면을 그린 뒤에 값을 넣는 방식보다 안전하다.
//
// Design Ref: §2.2 "서재 데이터는 앱이 켜질 때 한 번 읽어 공유한다(BookStore)"
// Design Ref: §1.2 "저장소는 한 문"

import { useSyncExternalStore } from 'react';
import {
  getBooks,
  getQuotes,
  getToRead,
  getRawItem,
  STORAGE_KEYS,
} from '@/lib/storage';

/** 아무것도 없을 때 돌려줄 배열. 매번 새로 만들면 화면이 계속 다시 그려져서 하나를 돌려쓴다. */
const EMPTY = [];

/** 바뀐 것을 알려달라고 등록해 둔 화면들. 책이든 구절이든 함께 알린다. */
const listeners = new Set();

function subscribe(onChange) {
  listeners.add(onChange);
  // 같은 앱을 다른 탭에서 열어 고쳤을 때도 따라간다.
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** 기록을 더하거나 고친 뒤에 부른다. 보고 있는 화면들이 새 값을 다시 읽는다. */
export function notifyBooksChanged() {
  for (const listener of listeners) listener();
}

/**
 * 목록 하나를 읽는 통로를 만든다.
 *
 * 왜 이렇게 감싸는가:
 * localStorage에 든 글자가 그대로면 지난번 결과를 그대로 돌려줘야 한다.
 * 읽을 때마다 새 배열을 만들면 React가 "바뀌었다"고 보고 끝없이 다시 그린다.
 */
function makeListReader(key, read) {
  let cache = { raw: undefined, value: EMPTY };

  return function getSnapshot() {
    // 저장소는 lib/storage.js를 통해서만 드나든다. (CLAUDE.md 5절)
    const raw = getRawItem(key);

    if (raw !== cache.raw) {
      let value = EMPTY;
      try {
        const list = read();
        value = list.length > 0 ? list : EMPTY;
      } catch {
        value = EMPTY;
      }
      cache = { raw, value };
    }
    return cache.value;
  };
}

const readBooks = makeListReader(STORAGE_KEYS.books, getBooks);
const readQuotes = makeListReader(STORAGE_KEYS.quotes, getQuotes);
const readToRead = makeListReader(STORAGE_KEYS.toRead, getToRead);

/** 서버에서 화면을 그릴 때는 저장소가 없다. 항상 비어 있는 것으로 본다. */
function getServerSnapshot() {
  return EMPTY;
}

/** 지금 서재에 있는 책 목록. */
export function useBooks() {
  return useSyncExternalStore(subscribe, readBooks, getServerSnapshot);
}

/** 지금까지 모은 구절 목록. */
export function useQuotes() {
  return useSyncExternalStore(subscribe, readQuotes, getServerSnapshot);
}

/** 추천받아 담아둔 "읽을 책" 목록. */
export function useToRead() {
  return useSyncExternalStore(subscribe, readToRead, getServerSnapshot);
}

const noopSubscribe = () => () => {};

/**
 * 화면이 브라우저에서 한 번 그려졌는지.
 *
 * 서버에서 그릴 때는 저장소가 없어 서재가 항상 비어 보인다.
 * 이 값이 false인 동안 "그런 책이 없다"고 단정하면, 실제로는 있는 책도
 * 잠깐 없는 것처럼 보였다가 나타난다. 그 깜빡임을 막으려고 쓴다.
 */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
