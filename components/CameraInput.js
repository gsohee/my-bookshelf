'use client';

// 촬영 입력과 미리보기
//
// 휴대폰에서는 누르면 바로 뒷면 카메라가 열리고, PC에서는 파일 고르기 창이 열린다.
// capture="environment"가 그 역할을 한다.
//
// 보여주는 차례
//   1. 사진을 줄이는 중   (작업 7)
//   2. 표지를 읽는 중      (작업 10) — 취소할 수 있다
//   3. 사진이 있음         — 읽기에 실패했으면 "다시 시도 / 직접 입력"
//   4. 아무것도 없음       — 촬영 버튼
//
// 읽기에 성공하면 사진은 그 자리에서 버려지므로(Design Ref: §4.2 5단계)
// 다시 4번으로 돌아간다. 채워진 입력칸이 결과를 보여준다.
//
// Design Ref: §3.3② 새 책 — 📷 표지 찍기 / 인식 중 · 성공 · 실패
// Design Ref: §10.1 components/CameraInput.js

import { useId, useRef } from 'react';
import { CAMERA_STATUS } from '@/components/useCameraImage';
import { readableSize } from '@/lib/image';

const smallButton =
  'rounded-full border border-black/15 px-4 py-2.5 text-sm text-zinc-700 dark:border-white/20 dark:text-zinc-300';

/** 무언가 하고 있는 동안 보여줄 칸. */
function BusyBox({ title, hint, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-black/15 px-4 py-7 text-center dark:border-white/20">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {title}
      </p>
      {hint && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{hint}</p>
      )}
      {actionLabel && (
        <button type="button" onClick={onAction} className={`mt-3 ${smallButton}`}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function CameraInput({
  label,
  hint,
  image,
  status,
  recognizing,
  /** 읽는 동안 보여줄 말. 표지인지 페이지인지에 따라 다르다 */
  recognizingLabel = '사진을 읽는 중…',
  recognizeError,
  canRetry,
  onPick,
  onClear,
  onInvalid,
  onRetry,
  onCancelRecognize,
  errorMessage,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const shrinking = status === CAMERA_STATUS.SHRINKING;

  function handleChange(event) {
    const file = event.target.files?.[0] ?? null;

    // 같은 파일을 다시 고를 수도 있어야 하므로 입력칸을 비워 둔다.
    event.target.value = '';

    if (!file) return;

    // 사진이 아닌 파일은 받지 않는다. PC에서는 무엇이든 고를 수 있기 때문이다.
    if (!file.type.startsWith('image/')) {
      onInvalid?.();
      return;
    }

    onPick(file);
  }

  return (
    <div>
      {/* 실제 입력칸은 감춰두고 아래 버튼으로 연다 */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="sr-only"
      />

      {shrinking ? (
        <BusyBox title="사진을 줄이는 중…" hint="잠깐만요" />
      ) : recognizing ? (
        <BusyBox
          title={recognizingLabel}
          hint="몇 초 걸려요"
          actionLabel="취소"
          onAction={onCancelRecognize}
        />
      ) : image ? (
        <div className="rounded-xl border border-black/10 p-3 dark:border-white/15">
          {/*
            찍은 사진은 메모리에만 있는 주소(blob:)를 본다.
            next/image는 미리 크기를 아는 그림을 다루는 도구라 여기엔 맞지 않는다.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.previewUrl}
            alt="방금 찍은 사진 미리보기"
            className="mx-auto max-h-56 w-auto rounded-lg object-contain"
          />

          <p className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
            {image.originalSize > image.size
              ? `${readableSize(image.originalSize)} → ${readableSize(image.size)}로 줄였어요`
              : readableSize(image.size)}
            {' · 저장하지 않아요'}
          </p>

          {recognizeError ? (
            // 읽기에 실패했다. 사진은 그대로 두었으므로 다시 찍지 않아도 된다.
            // (PRD M1 "인식이 실패해도 다시 찍지 않고 재시도할 수 있게 할 것")
            <div className="mt-3">
              <p
                role="alert"
                className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
              >
                {recognizeError}
              </p>
              <div className="mt-2 flex gap-2">
                {canRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="flex-1 rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-black"
                  >
                    다시 시도
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClear}
                  className={canRetry ? smallButton : `flex-1 ${smallButton}`}
                >
                  직접 입력
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={`flex-1 ${smallButton}`}
              >
                다시 찍기
              </button>
              <button
                type="button"
                onClick={onClear}
                className="rounded-full border border-black/15 px-5 py-2.5 text-sm text-zinc-500 dark:border-white/20 dark:text-zinc-400"
              >
                지우기
              </button>
            </div>
          )}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-black/15 px-4 py-7 text-center transition-colors hover:border-black/40 dark:border-white/20 dark:hover:border-white/40"
        >
          <span aria-hidden="true" className="text-2xl">
            📷
          </span>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </span>
          {hint && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {hint}
            </span>
          )}
        </label>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
