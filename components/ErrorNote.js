'use client';

// 오류 안내
//
// 실패했을 때 보여주는 노란 칸. 화면마다 따로 만들면 문구와 모양이 조금씩 달라진다.
//
// 저장 공간이 부족할 때는 안내만 하고 끝내지 않는다.
// 백업을 받아 정리하러 갈 수 있게 데이터 화면으로 가는 길을 함께 준다.
// (Design Ref: §8 "저장 공간이 부족해요 … 데이터 화면으로 안내")
//
// Design Ref: §8 오류 처리

import Link from 'next/link';
import { STORAGE_ERROR } from '@/lib/storage';

/**
 * @param message   보여줄 문구
 * @param code      무엇 때문에 실패했는지. 'QUOTA_EXCEEDED'면 데이터 화면 길을 덧붙인다
 * @param className 놓이는 자리마다 다른 여백만 덧붙인다
 */
export default function ErrorNote({ message, code, className = '' }) {
  if (!message) return null;

  const 공간부족 = code === STORAGE_ERROR.QUOTA_EXCEEDED;

  return (
    <div
      role="alert"
      className={`rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100 ${className}`}
    >
      <p>{message}</p>
      {공간부족 && (
        <Link
          href="/data"
          className="mt-1 inline-block font-medium underline underline-offset-4"
        >
          데이터 화면으로 가기
        </Link>
      )}
    </div>
  );
}
