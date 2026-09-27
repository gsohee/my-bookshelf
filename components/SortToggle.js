'use client';

// 정렬 토글 버튼
//
// 드롭다운이 아니라 버튼이다. 드롭다운은 "열기 + 고르기"로 두 번 눌러야 하는데,
// PRD 성공 기준이 "정렬 전환 클릭 1회"라서 한 번 눌러 바로 바뀌게 했다.
//
// 대신 지금 어떤 기준인지 버튼에 글자로 보여준다. 누르기 전에 알 수 있어야 하기 때문이다.
//
// Design Ref: §3.3① "정렬 토글 버튼 — 버튼에 현재 기준이 글자로 보인다"
// Plan SC: S5 서재 정렬 전환 클릭 1회

import { nextSortKey, sortLabel } from '@/lib/sortBooks';

export default function SortToggle({ sortKey, onChange }) {
  const next = nextSortKey(sortKey);

  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-label={`정렬 기준: ${sortLabel(sortKey)}. 누르면 ${sortLabel(next)}으로 바뀝니다`}
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-ink"
    >
      {sortLabel(sortKey)}
      <span aria-hidden="true" className="text-faint">
        ⇄
      </span>
    </button>
  );
}
