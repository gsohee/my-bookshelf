// 비었을 때 안내
//
// 데이터가 0건인 화면은 빈 채로 두지 않는다.
// 무엇이 없는지 알려주고, 다음에 무엇을 하면 되는지까지 준다.
//
// 지금은 서재(작업 14)와 상태 필터 결과(작업 13)가 쓰고,
// 앞으로 읽을 책 0건·구절 0건·통계 0건이 같은 모양을 쓴다.
//
// 문구는 탓하지 않는다 — "아직 없어요"이지 "안 했어요"가 아니다. (CLAUDE.md 8절)
//
// Design Ref: §10.1 components/EmptyState.js "비었을 때 안내 (서재·읽을 책·구절·통계 공용)"
// Design Ref: §3.4 "빈 서재 안내 문구 + 새 책 버튼"

import Link from 'next/link';

const actionClass =
  'rounded-full border border-line px-5 py-2.5 text-sm font-medium text-muted transition-colors hover:border-brand hover:text-ink';

/**
 * @param decoration  글자 위에 놓을 그림 같은 것. 읽어주는 도구는 건너뛴다
 * @param title       무엇이 없는지 (한 줄)
 * @param description 다음에 무엇을 하면 되는지 (한 줄, 없어도 됨)
 * @param actionLabel 버튼 글자 (없으면 버튼을 만들지 않는다)
 * @param actionHref  누르면 갈 곳. 같은 화면에서 처리할 일이면 onAction을 쓴다
 * @param onAction    누르면 할 일
 */
export default function EmptyState({
  decoration,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      {decoration && (
        <div aria-hidden="true" className="mb-1">
          {decoration}
        </div>
      )}

      <p className="text-sm text-muted">{title}</p>

      {description && (
        <p className="text-xs leading-5 text-faint">
          {description}
        </p>
      )}

      {actionLabel && actionHref && (
        <Link href={actionHref} className={`mt-2 ${actionClass}`}>
          {actionLabel}
        </Link>
      )}

      {actionLabel && !actionHref && onAction && (
        <button type="button" onClick={onAction} className={`mt-2 ${actionClass}`}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
