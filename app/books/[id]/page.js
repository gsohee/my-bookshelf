// 책 상세
//
// Next.js 16부터 params는 Promise다. 기다려서 꺼내야 한다.
// (node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md — Async Request APIs)
//
// Design Ref: §3.3③ 책 상세

import BookDetail from '@/components/BookDetail';

export default async function BookDetailPage({ params }) {
  const { id } = await params;
  return <BookDetail id={id} />;
}
