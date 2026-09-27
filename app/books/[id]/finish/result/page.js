// 추천 결과
//
// Next.js 16부터 params는 Promise다. 기다려서 꺼내야 한다.
// (node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md — Async Request APIs)
//
// Design Ref: §3.3⑥ 추천 결과

import RecommendResult from '@/components/RecommendResult';

export default async function RecommendResultPage({ params }) {
  const { id } = await params;
  return <RecommendResult bookId={id} />;
}
