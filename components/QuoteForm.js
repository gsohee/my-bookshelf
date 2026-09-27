'use client';

// 구절 입력 폼 — 새로 담을 때와 고칠 때를 함께 맡는다
//
// quote를 주지 않으면 "담기", 주면 "고치기"다.
// 입력칸이 같아서 두 벌로 나누면 한쪽만 고치는 실수가 생긴다.
// 고칠 때는 구절 목록 안에 끼워 넣으므로 화면 높이를 채우지 않는다.
//
// 페이지를 찍으면 읽어서 편집창을 채운다. 채워줄 뿐이고,
// 확인하고 저장하는 일은 그대로 사람이 한다. (PRD M2 "인식 결과 자동 저장 금지")
//
// Design Ref: §3.3④ 구절 추가
// Design Ref: §3.3③ 책 상세 — 구절 수정
// Design Ref: §4.3 흐름 2 — 구절 수집
// Design Ref: §5 구절(quote) 데이터

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBooks, useHydrated, notifyBooksChanged } from '@/components/BookStore';
import {
  addQuote,
  updateQuote,
  getTagCounts,
  describeStorageError,
} from '@/lib/storage';
import CameraInput from '@/components/CameraInput';
import ErrorNote from '@/components/ErrorNote';
import ConfirmDialog from '@/components/ConfirmDialog';
import TagInput from '@/components/TagInput';
import { useCameraImage } from '@/components/useCameraImage';
import { useApiCall } from '@/components/useApiCall';
import { callApi } from '@/lib/api';

const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-zinc-300';
const fieldClass =
  'mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-base text-black outline-none focus:border-black dark:border-white/20 dark:bg-black dark:text-zinc-50 dark:focus:border-zinc-300';

/**
 * @param bookId 어느 책의 구절인지
 * @param quote  주면 그 구절을 고친다. 없으면 새로 담는다
 * @param onDone 고치기를 마쳤을 때. 없으면 책 상세로 돌아간다
 */
export default function QuoteForm({ bookId, quote = null, onDone }) {
  const router = useRouter();
  const books = useBooks();
  const hydrated = useHydrated();
  const isEditing = quote !== null;

  // 같은 화면에 폼이 여럿 있을 수 있어(구절마다 고치기) 입력칸 이름이 겹치면 안 된다.
  const fieldId = useId();
  const textId = `quoteText-${fieldId}`;
  const pageId = `quotePage-${fieldId}`;
  const thoughtId = `quoteThought-${fieldId}`;

  const [text, setText] = useState(quote?.text ?? '');
  const [page, setPage] = useState(quote?.page ? String(quote.page) : '');
  const [thought, setThought] = useState(quote?.thought ?? '');
  // 태그 (작업 39)
  const [tags, setTags] = useState(() =>
    Array.isArray(quote?.tags) ? quote.tags : [],
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // 페이지 사진. 메모리에만 있고 저장하지 않는다. Design Ref: §4.7 사진의 수명
  const photo = useCameraImage();
  const [photoError, setPhotoError] = useState('');

  // 페이지 읽기. 부르는 동안의 상태와 실패 문구를 맡는다. (작업 8)
  const recognize = useApiCall();
  const [justRecognized, setJustRecognized] = useState(false);
  // 사진에서 읽은 쪽 번호. 손으로 적은 것과 구분해 안내하려고 따로 둔다. (작업 38)
  const [recognizedPage, setRecognizedPage] = useState(null);

  // 이미 적어둔 글이 있을 때 "바꿀까요?"를 묻는 중인지.
  //
  // 사진 자체는 여기에 담지 않는다. 사진을 담는 자리는 useCameraImage 한 곳뿐이고,
  // 여기서는 photo.image를 꺼내 쓴다. (Design Ref: §4.7)
  const [askReplace, setAskReplace] = useState(false);

  // 전에 쓴 태그 목록. 눌러서 넣을 수 있게 한다. (작업 39)
  // 구절이 바뀔 때만 다시 센다.
  const tagOptions = useMemo(() => {
    try {
      return getTagCounts();
    } catch {
      return [];
    }
  }, []);

  // 서버에서 그리는 동안에는 저장소가 없어 서재가 비어 보인다.
  // 그때 "없는 책"이라고 단정하면 있는 책도 잠깐 없는 것처럼 깜빡인다.
  if (!hydrated) return null;

  const book = books.find((item) => item.id === bookId);

  if (!book) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          그런 책을 찾지 못했어요.
        </p>
        <Link
          href="/"
          className="rounded-full border border-black/15 px-5 py-2 text-sm text-zinc-700 dark:border-white/20 dark:text-zinc-300"
        >
          서재로 가기
        </Link>
      </div>
    );
  }

  // 구절 본문이 없으면 저장할 수 없다. (PRD M2 — text는 필수)
  const canSave = text.trim().length > 0 && !saving;

  /**
   * 줄인 페이지 사진을 서버로 보내 글자를 읽어온다.
   *
   * 읽어온 글은 편집창을 채울 뿐이고, 저장은 사용자가 누른다.
   * (CLAUDE.md 2절 절대 규칙 3 "AI 인식 결과를 자동 저장하지 않는다")
   *
   * Design Ref: §4.3 흐름 2 — 구절 수집
   */
  async function readPage(file) {
    const form = new FormData();
    form.append('image', file);

    const result = await recognize.run((signal) =>
      callApi('/api/recognize-quote', {
        body: form,
        signal,
        // 서버가 OpenAI를 12초까지 기다리므로 그보다 넉넉하게 잡는다.
        timeoutMs: 15000,
        // 약속한 모양인지 여기서도 본다. Design Ref: §6
        validate: (data) => typeof data?.text === 'string',
      }),
    );

    // 실패했으면 사진을 그대로 둔다 — 다시 찍지 않고 재시도할 수 있어야 한다.
    // (PRD M2 "실패해도 다시 찍지 않고 재시도 가능")
    if (!result) return;

    setText(result.text);
    // 쪽 번호도 읽어오면 채운다. (작업 38)
    // 못 읽었으면 비워둔다 — 짐작한 번호를 넣으면 그대로 저장된다.
    // 채워져도 저장은 사람이 누른다. (절대 규칙 3)
    if (result.page) setPage(String(result.page));
    setRecognizedPage(result.page ?? null);
    setJustRecognized(true);

    // 읽어왔으면 사진은 그 자리에서 버린다. Design Ref: §4.2 5단계 "여기서 폐기"
    photo.clear();
  }

  /** 사진을 고르면 줄이고, 곧바로 읽는다. */
  async function handlePickPhoto(file) {
    setPhotoError('');
    setJustRecognized(false);
    setRecognizedPage(null);
    recognize.reset();

    const shrunk = await photo.pick(file);
    if (!shrunk) return; // 줄이기에 실패했거나 그 사이 다른 사진을 골랐다

    // 이미 적어둔 글이 있으면 먼저 묻는다. 구절은 길어서 잃으면 아깝다.
    // (CLAUDE.md 8절 "덮어쓰기 전에는 확인창")
    if (text.trim() !== '') {
      setAskReplace(true);
      return;
    }

    await readPage(shrunk.file);
  }

  /** 사진을 치우고 손으로 적는 쪽으로 넘어간다. */
  function handleManualEntry() {
    recognize.reset();
    setPhotoError('');
    setAskReplace(false);
    photo.clear();
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setSaveError(null);

    try {
      // 페이지는 비워둘 수 있다. 적었으면 숫자로 바꿔 넘긴다.
      const pageNumber = page.trim() === '' ? null : Number(page);

      if (isEditing) {
        updateQuote(quote.id, { text, page: pageNumber, thought, tags });
      } else {
        addQuote({ bookId, text, page: pageNumber, thought, tags });
      }
      // 저장했으면 사진은 그 자리에서 버린다. Design Ref: §4.7 "저장·취소·화면 이탈"
      photo.clear();
      notifyBooksChanged();

      if (onDone) onDone();
      else router.push(`/books/${bookId}`);
    } catch (error) {
      setSaving(false);
      // 원문 오류를 그대로 보여주지 않는다. Design Ref: §8 오류 처리
      setSaveError(
        describeStorageError(error, '저장하지 못했어요. 잠시 후 다시 해주세요.'),
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        isEditing ? 'flex flex-col gap-3' : 'flex flex-1 flex-col gap-4'
      }
    >
      {!isEditing && (
        <>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            『{book.title}』에 담을 구절
          </p>

          {/*
            페이지를 찍으면 읽어서 아래 편집창을 채운다.
            고칠 때는 이미 담은 글을 손보는 일이라 촬영이 필요 없다.
          */}
          <CameraInput
            label="책 페이지 사진으로 채우기"
            hint="찍은 사진은 저장하지 않아요"
            image={photo.image}
            status={photo.status}
            recognizing={recognize.loading}
            recognizingLabel="페이지를 읽는 중…"
            recognizeError={recognize.errorMessage}
            canRetry={recognize.canRetry}
            onPick={handlePickPhoto}
            onClear={handleManualEntry}
            onInvalid={() => setPhotoError('사진 파일만 넣을 수 있어요.')}
            onRetry={recognize.retry}
            onCancelRecognize={recognize.reset}
            errorMessage={photoError || photo.errorMessage}
          />

          {justRecognized ? (
            // 읽어온 글이 맞는지 사람이 확인해야 한다. AI가 잘못 읽었을 수 있다.
            <p className="-mt-1 rounded-lg bg-zinc-100 px-3 py-2 text-center text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              사진에서 읽었어요. <strong>확인하고 고쳐주세요.</strong>
            </p>
          ) : (
            <p className="-mt-1 text-center text-xs text-zinc-400 dark:text-zinc-500">
              또는 아래에 직접 입력
            </p>
          )}
        </>
      )}

      <div>
        <label htmlFor={textId} className={labelClass}>
          구절 <span className="text-rose-600">*</span>
        </label>
        <textarea
          id={textId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="마음에 남은 문장을 적어주세요"
          rows={isEditing ? 4 : 6}
          required
          className={`${fieldClass} resize-y leading-7`}
        />
      </div>

      <div>
        <label htmlFor={pageId} className={labelClass}>
          페이지
        </label>
        <input
          id={pageId}
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={page}
          onChange={(event) => setPage(event.target.value)}
          placeholder="모르면 비워두세요"
          className={fieldClass}
        />
        {/* 사진에서 읽은 번호인지 알려준다. 틀릴 수 있으므로 확인하게 한다 (작업 38) */}
        {recognizedPage !== null && String(recognizedPage) === page.trim() ? (
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            사진에서 읽은 쪽 번호예요. <strong>맞는지 봐주세요.</strong>
          </p>
        ) : justRecognized && recognizedPage === null ? (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            사진에서 쪽 번호를 찾지 못했어요. 직접 적어주세요.
          </p>
        ) : (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            비워두면 모아볼 때 맨 뒤에 놓여요.
          </p>
        )}
      </div>

      {/* 태그 (작업 39) — 나중에 태그로 모아볼 수 있다 */}
      <TagInput value={tags} onChange={setTags} suggestions={tagOptions} />

      <div>
        <label htmlFor={thoughtId} className={labelClass}>
          내 생각
        </label>
        <textarea
          id={thoughtId}
          value={thought}
          onChange={(event) => setThought(event.target.value)}
          placeholder="이 구절에서 든 생각이 있다면"
          rows={3}
          className={`${fieldClass} resize-y leading-7`}
        />
      </div>

      <ErrorNote message={saveError?.message} code={saveError?.code} />

      <div className={isEditing ? 'flex gap-2' : 'mt-auto flex gap-2 pt-4'}>
        <button
          type="submit"
          disabled={!canSave}
          className={`flex-1 rounded-full bg-black font-semibold text-white disabled:bg-zinc-300 disabled:text-zinc-500 dark:bg-zinc-50 dark:text-black dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 ${
            isEditing ? 'px-4 py-2.5 text-sm' : 'px-4 py-3 text-sm'
          }`}
        >
          {saving ? '저장하는 중…' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => {
            // 취소해도 사진은 그 자리에서 버린다. Design Ref: §4.7
            photo.clear();
            if (onDone) onDone();
            else router.push(`/books/${bookId}`);
          }}
          className={`rounded-full border border-black/15 text-sm text-zinc-700 dark:border-white/20 dark:text-zinc-300 ${
            isEditing ? 'px-5 py-2.5' : 'px-6 py-3'
          }`}
        >
          취소
        </button>
      </div>

      {/* 이미 적어둔 글이 있을 때. 지우기 전에 묻는다. */}
      <ConfirmDialog
        open={askReplace}
        title="적어둔 글을 바꿀까요?"
        description="사진에서 읽은 글로 편집창을 채웁니다. 지금 적어둔 글은 사라져요."
        confirmLabel="바꾸기"
        cancelLabel="그대로 두기"
        onConfirm={() => {
          setAskReplace(false);
          // 사진은 useCameraImage가 들고 있다. 여기서 꺼내 쓴다.
          if (photo.image) readPage(photo.image.file);
        }}
        onCancel={() => {
          setAskReplace(false);
          photo.clear();
        }}
      />
    </form>
  );
}
