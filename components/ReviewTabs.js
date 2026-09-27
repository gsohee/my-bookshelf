'use client';

// 돌아보기 — 통계 / 달력 / 결산 전환
//
// 탭을 누르면 **기본으로 통계가 열린다.** 홈에서 클릭 1회로 통계에 닿아야 하기 때문이다(S10).
// 주소를 따로 쓰지 않고 한 화면 안에서 바꾼다 — 세 화면이 같은 숫자를 보므로
// 오가며 다시 읽을 이유가 없다.
//
// Design Ref: §3.3⑨ 돌아보기
// Plan SC: S10 연도·장르·분위기 통계 확인 — 홈에서 클릭 1회

import { useState } from 'react';
import StatsPanel from '@/components/StatsPanel';
import CalendarPanel from '@/components/CalendarPanel';
import YearEndPanel from '@/components/YearEndPanel';

const TABS = [
  { key: 'stats', label: '통계' },
  { key: 'calendar', label: '달력' },
  { key: 'yearEnd', label: '결산' },
];

export default function ReviewTabs() {
  // 기본은 통계. Design Ref: §3.3⑨ "탭을 누르면 기본으로 통계가 열린다"
  const [tab, setTab] = useState('stats');

  return (
    <div className="flex flex-1 flex-col">
      <div
        role="tablist"
        aria-label="돌아보기 화면"
        className="mb-4 flex gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900"
      >
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={`flex-1 rounded-full px-3 py-2 text-sm transition-colors ${
              tab === item.key
                ? 'bg-white font-semibold text-black shadow-sm dark:bg-black dark:text-zinc-50'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'stats' && <StatsPanel />}
      {tab === 'calendar' && <CalendarPanel />}
      {tab === 'yearEnd' && <YearEndPanel />}
    </div>
  );
}
