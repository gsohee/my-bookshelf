'use client';

// 상태 필터
//
// 정렬은 한 번 눌러 넘기는 버튼이지만(작업 12), 거르기는 드롭다운이다.
// 정렬은 "다음 차례"가 자연스럽지만 거르기는 원하는 하나를 바로 고르는 일이고,
// 2단계에 항목이 4종으로 늘기 때문이다.
//
// Design Ref: §3.3① "상태 필터 — 상단 드롭다운"

import { STATUS_FILTER_OPTIONS } from '@/lib/filterBooks';

export default function StatusFilter({ value, onChange }) {
  return (
    <>
      <label htmlFor="statusFilter" className="sr-only">
        상태로 거르기
      </label>
      <select
        id="statusFilter"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 outline-none focus:border-black dark:border-white/20 dark:bg-black dark:text-zinc-300 dark:focus:border-zinc-300"
      >
        {STATUS_FILTER_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </>
  );
}
