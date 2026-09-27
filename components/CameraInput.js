'use client';

// 사진 넣기와 미리보기
//
// ── 길이 둘이다 ──────────────────────────────────────
//
//   📷 사진 찍기   — capture="environment". 휴대폰에서 뒷면 카메라가 바로 열린다
//   🖼 사진 올리기  — capture 없음. 갤러리·파일에서 이미 있는 사진을 고른다
//
// **입력칸을 둘로 나눈 이유**: `capture`가 붙은 입력칸 하나만 두면 휴대폰에서
// 카메라만 열리고 **갤러리에서 고르는 선택지가 사라진다.** 카메라 권한이 막혀 있으면
// 눌러도 아무 일이 일어나지 않아 "고장난 버튼"이 된다.
// 같은 입력칸에서 capture를 켰다 껐다 할 수는 없어서(브라우저가 처음 값만 본다)
// 숨은 입력칸을 두 개 두고 버튼으로 골라 연다.
//
// 보여주는 차례
//   1. 사진을 줄이는 중   (작업 7)
//   2. 표지를 읽는 중      (작업 10) — 취소할 수 있다
//   3. 사진이 있음         — 읽기에 실패했으면 "다시 시도 / 직접 입력"
//   4. 아무것도 없음       — 사진 찍기 · 사진 올리기
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
  // 찍기용과 올리기용을 따로 둔다. 하나로는 둘 다 못 한다 (위 설명 참고)
  const cameraRef = useRef(null);
  const pickRef = useRef(null);
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
      {/*
        실제 입력칸은 감춰두고 아래 버튼으로 연다.
        capture가 붙은 것과 안 붙은 것, 둘을 따로 둔다.
      */}
      <input
        ref={cameraRef}
        id={`${inputId}-camera`}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="sr-only"
      />
      <input
        ref={pickRef}
        id={`${inputId}-pick`}
        type="file"
        accept="image/*"
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
                onClick={() => cameraRef.current?.click()}
                className={`flex-1 ${smallButton}`}
              >
                다시 찍기
              </button>
              <button
                type="button"
                onClick={() => pickRef.current?.click()}
                className={`flex-1 ${smallButton}`}
              >
                다른 사진
              </button>
              <button
                type="button"
                onClick={onClear}
                className="rounded-full border border-black/15 px-4 py-2.5 text-sm text-zinc-500 dark:border-white/20 dark:text-zinc-400"
              >
                지우기
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-black/15 px-4 py-6 text-center dark:border-white/20">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </p>

          {/*
            두 길을 나란히 둔다. 카메라가 막힌 기기에서도 오른쪽으로 갈 수 있어야
            "버튼이 고장났다"가 되지 않는다.
          */}
          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-black"
            >
              <span aria-hidden="true">📷</span> 사진 찍기
            </button>
            <button
              type="button"
              onClick={() => pickRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-black/15 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:border-white/20 dark:text-zinc-300"
            >
              <span aria-hidden="true">🖼</span> 사진 올리기
            </button>
          </div>

          <p className="text-xs leading-5 text-zinc-400 dark:text-zinc-500">
            {hint}
            <br />
            카메라가 열리지 않으면 <b className="font-medium">사진 올리기</b>를
            써주세요.
          </p>
        </div>
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
