// 완독 감상
//
// Next.js 16부터 params는 Promise다. 기다려서 꺼내야 한다.
// (node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md — Async Request APIs)
//
// Design Ref: §3.3⑤ 완독 감상

import ReviewForm from '@/components/ReviewForm';

export default async function FinishPage({ params }) {
  const { id } = await params;
  return <ReviewForm bookId={id} />;
}
