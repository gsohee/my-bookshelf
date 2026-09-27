// 새 책
//
// 읽을 책 목록에서 "읽기 시작"으로 들어오면 주소에 제목·지은이가 실려 온다.
// 그 값으로 입력칸을 미리 채워, 다시 타이핑하지 않게 한다. (작업 24)
//
// Next.js 16부터 searchParams는 Promise다. 기다려서 꺼내야 한다.
// (node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md — Async Request APIs)
//
// Design Ref: §3.3② 새 책
// Design Ref: §3.1 화면 지도 — 읽을 책 → 읽기 시작 → 새 책 폼

import BookForm from '@/components/BookForm';

export default async function NewBookPage({ searchParams }) {
  const { title, author } = await searchParams;

  return (
    <BookForm
      initialTitle={typeof title === 'string' ? title : ''}
      initialAuthor={typeof author === 'string' ? author : ''}
    />
  );
}
