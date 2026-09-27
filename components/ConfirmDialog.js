'use client';

// 확인창
//
// "정말 할까요?"를 묻는 공용 창. 여러 곳에서 같은 모양으로 쓴다.
// 지금은 제목 중복(작업 5)에서만 쓰고, 앞으로 책 삭제(작업 15)·구절 삭제(작업 19)·
// 복원 덮어쓰기(작업 27)가 같은 창을 쓴다.
//
// 브라우저에 들어 있는 <dialog>를 쓴다. Esc로 닫기, 뒤 배경 어둡게,
// 창 안에서만 키보드가 움직이는 것까지 브라우저가 해준다 — 직접 만들 필요가 없다.
//
// Design Ref: §10.1 components/ConfirmDialog.js
// Design Ref: §8 "삭제·덮어쓰기 전에는 확인창을 띄운다"

import { useEffect, useId, useRef } from 'react';

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);
  // 한 화면에 확인창이 여럿 있을 수 있다(구절마다 하나, 책 상세의 지우기·다시 읽기).
  // 제목 id가 같으면 화면 읽기 도구가 어느 창의 제목인지 가리지 못한다.
  const titleId = useId();

  // open 값에 맞춰 창을 열고 닫는다.
  // 화면 밖(브라우저) 상태를 React 상태에 맞추는 일이라 effect가 맡는다.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  /**
   * Esc를 눌렀을 때.
   * 일부러 막지 않는다 — 브라우저가 창을 닫게 두고 우리는 상태만 맞춘다.
   * 막아 두면 우리 쪽 처리가 한 번이라도 어긋날 때 창이 닫히지 않아 갇힌다.
   */
  function handleEscape() {
    onCancel?.();
  }

  /** 창 바깥(어두운 부분)을 눌렀을 때도 취소로 본다. */
  function handleBackdropClick(event) {
    if (event.target === dialogRef.current) {
      onCancel?.();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleEscape}
      onClick={handleBackdropClick}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-sm border-0 bg-transparent p-0 backdrop:bg-black/50"
    >
      <div className="rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900">
        <h2
          id={titleId}
          className="text-base font-semibold text-black dark:text-zinc-50"
        >
          {title}
        </h2>

        {description && (
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-black/15 px-4 py-3 text-sm text-zinc-700 dark:border-white/20 dark:text-zinc-300"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-full bg-black px-4 py-3 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-black"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
