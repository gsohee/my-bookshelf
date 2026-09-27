'use client';

// 나의 책장 — 공통 틀
//
// 모든 화면이 이 틀 안에 들어간다. 위에 화면 제목, 아래에 탭, 가운데가 내용이다.
// 지금 어느 화면인지 알아야 제목과 탭 표시를 바꿀 수 있어서 이 파일만 클라이언트로 둔다.
// (CLAUDE.md 5절 — "use client"는 필요한 잎 컴포넌트에만)
//
// Design Ref: §3.2 공통 레이아웃과 하단 탭
// Design Ref: §3.1 화면 지도

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { initStorage } from '@/lib/storage';
import { migrateStorage } from '@/lib/migrate';
import { notifyBooksChanged } from '@/components/BookStore';

/**
 * 하단 탭.
 *
 * DESIGN §3.2에 따라 1단계부터 4개였고, 2단계에 돌아보기가 더해져 5개가 됐다.
 * 돌아보기를 탭에 두는 이유는 **홈에서 클릭 1회로 통계에 닿아야 하기 때문**이다(S10).
 *
 * 다섯 화면 모두 만들어졌으므로 전부 그냥 링크다.
 */
const TABS = [
  { href: '/', label: '서재', title: '나의 책장' },
  { href: '/books/new', label: '새 책', title: '새 책' }, // 작업 4
  { href: '/to-read', label: '읽을 책', title: '읽을 책' }, // 작업 24
  { href: '/review', label: '돌아보기', title: '돌아보기' }, // 작업 33~35
  { href: '/data', label: '데이터', title: '데이터' }, // 작업 26
];

/** 지금 주소에 해당하는 탭을 찾는다. 하위 주소(예: /books/1)도 그 탭에 속한 것으로 본다. */
function findActiveTab(pathname) {
  if (pathname === '/') return TABS[0];
  return (
    TABS.slice(1).find((tab) => pathname.startsWith(tab.href)) ?? TABS[0]
  );
}

/**
 * 위에 보일 화면 제목.
 * 책 상세(/books/<고유번호>)는 어느 탭에도 속하지 않으므로 따로 이름을 준다.
 * 책 제목 자체는 화면 안에서 크게 보여준다. (Design Ref: §3.3③)
 */
function screenTitle(pathname, activeTab) {
  if (pathname.endsWith('/quotes/new')) return '구절 추가';
  if (pathname.endsWith('/finish')) return '다 읽었어요!';
  if (pathname.endsWith('/finish/result')) return '이런 책은 어때요?';

  const isBookDetail =
    pathname.startsWith('/books/') && pathname !== '/books/new';
  return isBookDetail ? '책 정보' : activeTab.title;
}

export default function AppFrame({ children }) {
  const pathname = usePathname();
  const activeTab = findActiveTab(pathname);

  // 앱이 켜질 때 한 번 저장소를 준비한다.
  // 이미 기록이 있으면 아무것도 건드리지 않는다.
  // 저장소를 못 쓰는 환경이어도 여기서는 알리지 않는다 —
  // 실제로 저장을 시도하는 화면(작업 4부터)이 안내 문구를 맡는다.
  //
  // 준비한 뒤 **예전 형식이면 지금 형식으로 올린다.** (작업 31)
  // 화면을 그리기 전에 해야 옛 모양 때문에 값이 사라진 것처럼 보이지 않는다.
  // 올리지 못해도 앱은 뜬다 — 최소한 백업은 받을 수 있어야 하기 때문이다.
  // Design Ref: §5.3 "① 앱 시작 → schemaVersion 읽기 → 낮으면 순서대로 적용"
  useEffect(() => {
    initStorage();
    // 올렸으면 화면이 바뀐 내용을 다시 읽게 한다.
    // 올린 결과를 알리지 않으면 이번에 켠 동안에는 옛 값이 그대로 보인다.
    if (migrateStorage().migrated) notifyBooksChanged();
  }, []);

  return (
    // 기준 폭은 380px. 넓은 화면에서는 가운데에 한 줄로 세운다.
    // Design Ref: §1.2 "380px가 기준"
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white dark:bg-black">
      {/* 상단 — 화면 제목. 화면별 동작 버튼은 각 화면이 나중에 채운다. */}
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-black/10 bg-white/90 px-4 backdrop-blur dark:border-white/15 dark:bg-black/90">
        <p className="text-base font-semibold tracking-tight text-black dark:text-zinc-50">
          {screenTitle(pathname, activeTab)}
        </p>
      </header>

      {/* 가운데 — 화면 내용. 세로 스크롤은 여기서만 생긴다.
          세로 flex로 둬서 각 화면이 flex-1로 남은 높이를 채울 수 있게 한다.
          (빈 서재 안내(작업 14)처럼 가운데 정렬이 필요한 화면을 위해) */}
      <main className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        {children}
      </main>

      {/* 하단 — 탭 */}
      <nav
        aria-label="주요 화면"
        className="sticky bottom-0 shrink-0 border-t border-black/10 bg-white/90 backdrop-blur dark:border-white/15 dark:bg-black/90"
      >
        <ul className="flex">
          {TABS.map((tab) => {
            const isActive = tab.href === activeTab.href;

            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-14 items-center justify-center text-xs transition-colors sm:text-sm ${
                    isActive
                      ? 'font-semibold text-black dark:text-zinc-50'
                      : 'text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50'
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
