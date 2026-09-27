'use client';

// 추천 받은 책 목록
//
// 완독 뒤 추천(작업 23)과 서재·직접 입력 추천(작업 44)이 함께 쓴다.
// 받은 책을 보여주고 "읽을 책에 저장"을 받는 일은 세 길 모두 같아서 여기 모았다.
//
// 지키는 것 두 가지
//   1. 서재에 이미 있는 책은 빼고 보여준다 — 서재는 이 기기에만 있으므로
//      서버가 아니라 여기서 거른다 (PRD 6절)
//   2. 받은 추천은 그대로 저장되지 않는다. 저장은 사람이 누른다
//
// Design Ref: §3.3⑥ 추천 결과

import { useState } from 'react';
import { useBooks } from '@/components/BookStore';
import { addToRead, getToRead, describeStorageError } from '@/lib/storage';
import { titleKey } from '@/lib/titleKey';
import ErrorNote from '@/components/ErrorNote';

/**
 * 화면에 보여줄 권수. PRD N1이 3권으로 정했다.
 * 서재에 있는 책을 뺀 다음에 세어야 늘 3권이 채워진다.
 */
export const SHOW_COUNT = 3;

/**
 * @param books            서버에서 받은 책들
 * @param emptyTitle       보여줄 것이 없을 때 첫 줄
 * @param emptyDescription 보여줄 것이 없을 때 둘째 줄
 */
export default function RecommendList({ books, emptyTitle, emptyDescription }) {
  const shelf = useBooks();
  const [savedKeys, setSavedKeys] = useState([]);
  const [saveError, setSaveError] = useState(null);

  // 서재에 이미 있는 책을 먼저 빼고, 그다음에 3권을 고른다.
  // 순서가 반대면 고른 3권 중 하나가 서재에 있을 때 2권만 남는다.
  const inShelf = new Set(shelf.map((item) => titleKey(item.title)));
  const shown = (books ?? [])
    .filter((item) => !inShelf.has(titleKey(item.title)))
    .slice(0, SHOW_COUNT);

  /** 이미 읽을 책에 담긴 것인지. 새로고침해도 알 수 있도록 저장소에서 확인한다. */
  function alreadySaved(item) {
    const key = titleKey(item.title);
    if (savedKeys.includes(key)) return true;
    try {
      return getToRead().some((saved) => titleKey(saved.title) === key);
    } catch {
      return false;
    }
  }

  function handleSave(item) {
    try {
      addToRead(item);
      setSavedKeys((current) => [...current, titleKey(item.title)]);
      setSaveError(null);
    } catch (error) {
      // 원문 오류를 그대로 보여주지 않는다. Design Ref: §8 오류 처리
      setSaveError(
        describeStorageError(error, '저장하지 못했어요. 잠시 후 다시 해주세요.'),
      );
    }
  }

  if (shown.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-muted">{emptyTitle}</p>
        {emptyDescription && (
          <p className="text-xs text-faint">{emptyDescription}</p>
        )}
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {shown.map((item) => {
          const saved = alreadySaved(item);
          return (
            <li
              key={`${item.title}|${item.author}`}
              className="rounded-xl border border-line-soft p-3"
            >
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-0.5 text-xs text-muted">{item.author}</p>
              {item.reason && (
                <p className="mt-2 text-sm leading-6 text-muted">
                  {item.reason}
                </p>
              )}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSave(item)}
                  disabled={saved}
                  className="rounded-full border border-line px-4 py-2 text-sm text-muted disabled:border-transparent disabled:bg-surface-soft disabled:text-faint"
                >
                  {saved ? '저장됨' : '읽을 책에 저장'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <ErrorNote message={saveError?.message} code={saveError?.code} />
    </>
  );
}
