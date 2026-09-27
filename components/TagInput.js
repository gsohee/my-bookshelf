'use client';

// 구절 태그 입력 (작업 39)
//
// 태그는 **자유롭게 적는 말**이다. 장르처럼 정해진 목록이 아니라서,
// 이미 써둔 태그를 아래에 보여주고 눌러 넣을 수 있게 한다 —
// 손으로 다시 치면 "문장"과 "문장 " 처럼 조금씩 다른 태그가 쌓인다.
//
// Design Ref: §5 구절(quote) 데이터 — tags

import { useId, useState } from 'react';

export default function TagInput({ value, onChange, suggestions = [] }) {
  const inputId = useId();
  const [draft, setDraft] = useState('');

  function add(tag) {
    const clean = tag.trim();
    if (clean === '' || value.includes(clean)) {
      setDraft('');
      return;
    }
    onChange([...value, clean]);
    setDraft('');
  }

  function handleKeyDown(event) {
    // 엔터로 넣는다. 폼 안이라 기본 동작(저장)을 막아야 한다.
    if (event.key === 'Enter') {
      event.preventDefault();
      add(draft);
      return;
    }
    // 빈 칸에서 지우기를 누르면 마지막 태그를 뗀다.
    if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  // 이미 붙인 태그는 권하지 않는다.
  const notUsed = suggestions.filter((item) => !value.includes(item.tag));

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        태그
      </label>

      {value.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item !== tag))}
                aria-label={`${tag} 태그 빼기`}
                className="flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-white dark:bg-zinc-200 dark:text-black"
              >
                {tag}
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-1.5 flex gap-2">
        <input
          id={inputId}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="예: 위로, 문장이 좋음"
          className="min-w-0 flex-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-base text-black outline-none focus:border-black dark:border-white/20 dark:bg-black dark:text-zinc-50 dark:focus:border-zinc-300"
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={draft.trim() === ''}
          className="shrink-0 rounded-full border border-black/15 px-4 py-2 text-sm text-zinc-700 disabled:text-zinc-300 dark:border-white/20 dark:text-zinc-300 dark:disabled:text-zinc-700"
        >
          넣기
        </button>
      </div>

      {notUsed.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            전에 쓴 태그
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {notUsed.slice(0, 8).map((item) => (
              <li key={item.tag}>
                <button
                  type="button"
                  onClick={() => add(item.tag)}
                  className="rounded-full border border-black/15 px-3 py-1.5 text-xs text-zinc-600 dark:border-white/20 dark:text-zinc-400"
                >
                  {item.tag}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
