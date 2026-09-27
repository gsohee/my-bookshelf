// 구절 추가
//
// Next.js 16부터 params는 Promise다. 기다려서 꺼내야 한다.
// (node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md — Async Request APIs)
//
// Design Ref: §3.3④ 구절 추가

import QuoteForm from '@/components/QuoteForm';

export default async function NewQuotePage({ params }) {
  const { id } = await params;
  return <QuoteForm bookId={id} />;
}
