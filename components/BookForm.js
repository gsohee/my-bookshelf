'use client';

// 책 입력 폼 — 새로 등록할 때와 고칠 때를 함께 맡는다
//
// book을 주지 않으면 "등록", 주면 "수정"이다.
// 입력칸이 거의 같아서 두 벌로 나누면 한쪽만 고치는 실수가 생긴다.
// 수정일 때만 상태와 완독일이 더 보인다.
//
// 표지 촬영(작업 6~10)은 아직 없다. 인식이 붙으면 이 폼의 입력칸을 대신 채워줄 뿐,
// 확인하고 저장하는 일은 그대로 사람이 한다. (PRD M1 "인식 결과는 반드시 사용자 확인 후 저장")
//
// Design Ref: §3.3② 새 책
// Design Ref: §3.3③ 책 상세 — 수정
// Design Ref: §3.4 화면 요소 체크리스트

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GENRES,
  DEFAULT_GENRE,
  BOOK_STATUS,
  BOOK_STATUS_ALL,
} from '@/lib/constants';
import {
  addBook,
  updateBook,
  findBooksByTitle,
  describeStorageError,
} from '@/lib/storage';
import { todayKST } from '@/lib/date';
import ConfirmDialog from '@/components/ConfirmDialog';
import ErrorNote from '@/components/ErrorNote';
import CameraInput from '@/components/CameraInput';
import { useCameraImage } from '@/components/useCameraImage';
import { useApiCall } from '@/components/useApiCall';
import { callApi } from '@/lib/api';
import { notifyBooksChanged } from '@/components/BookStore';

const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-zinc-300';
const inputClass =
  'mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-base text-black outline-none focus:border-black dark:border-white/20 dark:bg-black dark:text-zinc-50 dark:focus:border-zinc-300';

/** 책에서 마지막 회차를 꺼낸다. 없으면 빈 회차로 본다. */
function lastRead(book) {
  return book?.reads?.[book.reads.length - 1] ?? {};
}

/**
 * @param book          주면 그 책을 고친다. 없으면 새로 등록한다
 * @param initialTitle  미리 채워둘 제목 (읽을 책에서 "읽기 시작"으로 왔을 때)
 * @param initialAuthor 미리 채워둘 지은이
 * @param onDone        고치기를 마쳤을 때
 */
export default function BookForm({
  book = null,
  initialTitle = '',
  initialAuthor = '',
  onDone,
}) {
  const router = useRouter();
  const isEditing = book !== null;

  const [title, setTitle] = useState(book?.title ?? initialTitle);
  const [author, setAuthor] = useState(book?.author ?? initialAuthor);
  const [genre, setGenre] = useState(book?.genre ?? DEFAULT_GENRE);
  const [totalPages, setTotalPages] = useState(
    book?.totalPages ? String(book.totalPages) : '',
  );
  const [startedAt, setStartedAt] = useState(
    () => lastRead(book).startedAt ?? todayKST(),
  );

  // 수정할 때만 쓰는 두 가지
  const [status, setStatus] = useState(book?.status ?? BOOK_STATUS.READING);
  const [finishedAt, setFinishedAt] = useState(lastRead(book).finishedAt ?? '');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [duplicateCount, setDuplicateCount] = useState(0);

  // 표지 사진. 메모리에만 있고 저장하지 않는다. Design Ref: §4.7 사진의 수명
  const cover = useCameraImage();
  const [coverError, setCoverError] = useState('');

  // 표지 읽기. 부르는 동안의 상태와 실패 문구를 맡는다. (작업 8)
  const recognize = useApiCall();
  // 방금 읽어서 채웠는지. 사용자에게 "확인하고 고쳐주세요"를 알리는 데만 쓴다.
  const [justRecognized, setJustRecognized] = useState(false);

  // 제목이 없으면 저장할 수 없다. (PRD M1 "제목 없으면 저장 금지")
  const canSave = title.trim().length > 0 && !saving;

  // 재독한 책(작업 30)은 회차가 여럿이다. 이 폼이 고치는 것은 **마지막 회차**이므로
  // 그냥 "시작일"이라고만 적으면 1회차 날짜를 고치는 줄 알 수 있다.
  const roundLabel = (book?.reads?.length ?? 0) > 1 ? '이번 회차 ' : '';

  /**
   * 줄인 표지 사진을 서버로 보내 제목·저자를 읽어온다.
   *
   * 읽어온 값은 입력칸을 채울 뿐이고, 저장은 사용자가 누른다.
   * (CLAUDE.md 2절 절대 규칙 3 "AI 인식 결과를 자동 저장하지 않는다")
   *
   * Design Ref: §4.2 흐름 1 — 책 등록
   */
  async function readCover(file) {
    const form = new FormData();
    form.append('image', file);

    const result = await recognize.run((signal) =>
      callApi('/api/recognize-cover', {
        body: form,
        signal,
        // 서버가 OpenAI를 12초까지 기다리므로 그보다 넉넉하게 잡는다.
        timeoutMs: 15000,
        // 약속한 모양인지 여기서도 본다. Design Ref: §6
        validate: (data) =>
          typeof data?.title === 'string' && typeof data?.author === 'string',
      }),
    );

    // 실패했으면 사진을 그대로 둔다 — 다시 찍지 않고 재시도할 수 있어야 한다.
    // (PRD M1 "인식이 실패해도 다시 찍지 않고 재시도할 수 있게 할 것")
    if (!result) return;

    setTitle(result.title);
    // 저자를 못 읽었으면 이미 적어둔 값을 지우지 않는다.
    if (result.author) setAuthor(result.author);
    setJustRecognized(true);

    // 읽어왔으면 사진은 그 자리에서 버린다. Design Ref: §4.2 5단계 "여기서 폐기"
    cover.clear();
  }

  /** 사진을 고르면 줄이고, 곧바로 읽는다. 누르는 횟수를 줄여야 30초 안에 끝난다(S1). */
  async function handlePickCover(file) {
    setCoverError('');
    setJustRecognized(false);
    recognize.reset();

    const shrunk = await cover.pick(file);
    if (!shrunk) return; // 줄이기에 실패했거나 그 사이 다른 사진을 골랐다

    await readCover(shrunk.file);
  }

  /** 사진을 치우고 손으로 적는 쪽으로 넘어간다. */
  function handleManualEntry() {
    recognize.reset();
    setCoverError('');
    cover.clear();
  }

  /**
   * 저장 버튼을 눌렀을 때.
   * 같은 제목이 이미 있으면 바로 저장하지 않고 먼저 물어본다.
   * Design Ref: §3.3② 제목 중복
   */
  function handleSubmit(event) {
    event.preventDefault();
    if (!canSave) return;

    setSaveError(null);

    let duplicates = [];
    try {
      // 고치는 중이라면 자기 자신은 중복이 아니다.
      duplicates = findBooksByTitle(title).filter((item) => item.id !== book?.id);
    } catch {
      // 저장소를 못 읽으면 중복 검사는 건너뛴다.
      // 어차피 아래 저장에서 같은 이유로 막히고, 그때 안내 문구가 뜬다.
    }

    if (duplicates.length > 0) {
      setDuplicateCount(duplicates.length);
      return;
    }

    save();
  }

  /** 실제로 저장한다. 중복을 알고도 등록하겠다고 하면 여기로 바로 온다. */
  function save() {
    setDuplicateCount(0);
    setSaving(true);
    setSaveError(null);

    try {
      // 총 페이지는 비워둘 수 있다. 적었으면 숫자로 바꿔 넘긴다.
      const pages = totalPages.trim() === '' ? null : Number(totalPages);

      if (isEditing) {
        // 완독일은 '완독'일 때만 남긴다.
        // 완독으로 바꿨는데 날짜를 비워뒀으면 오늘로 채운다 —
        // '완독인데 완독일이 없는 책'이 생기면 나중에 통계가 어긋난다.
        // 반대로 일시정지·중단으로 바꾸면 완독일을 비운다(작업 29) —
        // 다 읽지 않은 책에 완독일이 남아 있으면 연도별 집계에 섞여 들어간다.
        const nextFinishedAt =
          status === BOOK_STATUS.FINISHED ? finishedAt || todayKST() : null;

        // 회차가 하나도 없는 책은 정상적으로는 생기지 않지만,
        // 그런 값이 들어와도 reads[-1]에 쓰지 않도록 1회차를 만들어 준다.
        const reads = [...(book.reads ?? [])];
        if (reads.length === 0) {
          reads.push({ round: 1, startedAt, finishedAt: null, review: null });
        }

        const lastIndex = reads.length - 1;
        reads[lastIndex] = {
          ...reads[lastIndex],
          startedAt,
          finishedAt: nextFinishedAt,
        };

        updateBook(book.id, {
          title,
          author,
          genre,
          totalPages: pages,
          status,
          reads,
        });
      } else {
        addBook({ title, author, genre, totalPages: pages, startedAt });
      }

      // 저장했으면 사진은 그 자리에서 버린다. Design Ref: §4.7 "저장·취소·화면 이탈"
      cover.clear();

      // 서재 화면이 바뀐 내용을 바로 보게 한다.
      notifyBooksChanged();

      if (onDone) {
        onDone();
      } else {
        // 저장하면 서재로 돌아간다. Design Ref: §3.1 화면 지도
        router.push('/');
      }
    } catch (error) {
      setSaving(false);
      // 원문 오류를 그대로 보여주지 않는다. Design Ref: §8 오류 처리
      setSaveError(
        describeStorageError(error, '저장하지 못했어요. 잠시 후 다시 해주세요.'),
      );
    }
  }

  function handleCancel() {
    // 취소해도 사진은 그 자리에서 버린다. Design Ref: §4.7
    cover.clear();

    if (onDone) {
      onDone();
    } else {
      router.push('/');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
      {/*
        표지 촬영은 새로 등록할 때만 있다. 고칠 때는 이미 넣은 정보를 손보는 일이라 촬영이 필요 없다.
        지금은 찍어서 보여주는 데까지다 — 찍은 사진으로 제목을 채우는 일은 작업 9에서 붙는다.
      */}
      {!isEditing && (
        <>
          <CameraInput
            label="책 표지 사진으로 채우기"
            hint="찍은 사진은 저장하지 않아요"
            image={cover.image}
            status={cover.status}
            recognizing={recognize.loading}
            recognizingLabel="표지를 읽는 중…"
            recognizeError={recognize.errorMessage}
            canRetry={recognize.canRetry}
            onPick={handlePickCover}
            onClear={handleManualEntry}
            onInvalid={() => setCoverError('사진 파일만 넣을 수 있어요.')}
            onRetry={recognize.retry}
            onCancelRecognize={recognize.reset}
            errorMessage={coverError || cover.errorMessage}
          />

          {justRecognized ? (
            // 읽어온 값이 맞는지 사람이 확인해야 한다. AI가 잘못 읽었을 수 있다.
            <p className="-mt-2 rounded-lg bg-zinc-100 px-3 py-2 text-center text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              표지에서 읽었어요. <strong>확인하고 고쳐주세요.</strong>
            </p>
          ) : (
            <p className="-mt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
              또는 아래에 직접 입력
            </p>
          )}
        </>
      )}

      <div>
        <label htmlFor="title" className={labelClass}>
          제목 <span className="text-rose-600">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="책 제목을 적어주세요"
          autoComplete="off"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="author" className={labelClass}>
          저자
        </label>
        <input
          id="author"
          type="text"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          autoComplete="off"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="genre" className={labelClass}>
          장르
        </label>
        <select
          id="genre"
          value={genre}
          onChange={(event) => setGenre(event.target.value)}
          className={inputClass}
        >
          {GENRES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="totalPages" className={labelClass}>
          총 페이지
        </label>
        <input
          id="totalPages"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={totalPages}
          onChange={(event) => setTotalPages(event.target.value)}
          placeholder="모르면 비워두세요"
          className={inputClass}
        />
      </div>

      {isEditing && (
        <div>
          <label htmlFor="status" className={labelClass}>
            상태
          </label>
          <select
            id="status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={inputClass}
          >
            {BOOK_STATUS_ALL.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {/* 새로 생긴 두 상태의 뜻을 한 줄로 알려준다. 골라야 하는 사람이 알아야 한다 */}
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            일시정지는 나중에 마저 읽을 책, 중단은 그만 읽기로 한 책이에요.
            중단한 책은 완독 합계에 넣지 않아요.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="startedAt" className={labelClass}>
          {roundLabel}시작일
        </label>
        <input
          id="startedAt"
          type="date"
          value={startedAt}
          onChange={(event) => setStartedAt(event.target.value)}
          className={inputClass}
        />
        {!isEditing && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            오늘 날짜로 넣어뒀어요. 다르면 고쳐주세요.
          </p>
        )}
      </div>

      {isEditing && status === BOOK_STATUS.FINISHED && (
        <div>
          <label htmlFor="finishedAt" className={labelClass}>
            {roundLabel}완독일
          </label>
          <input
            id="finishedAt"
            type="date"
            value={finishedAt}
            onChange={(event) => setFinishedAt(event.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            비워두면 오늘 날짜로 넣어요.
          </p>
        </div>
      )}

      <ErrorNote message={saveError?.message} code={saveError?.code} />

      <div className="mt-auto flex gap-2 pt-4">
        <button
          type="submit"
          disabled={!canSave}
          className="flex-1 rounded-full bg-black px-4 py-3 text-sm font-semibold text-white disabled:bg-zinc-300 disabled:text-zinc-500 dark:bg-zinc-50 dark:text-black dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
        >
          {saving ? '저장하는 중…' : '저장'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-full border border-black/15 px-6 py-3 text-sm text-zinc-700 dark:border-white/20 dark:text-zinc-300"
        >
          취소
        </button>
      </div>

      {/* 같은 제목이 이미 있을 때. 막지 않고 물어본다. */}
      <ConfirmDialog
        open={duplicateCount > 0}
        title="이미 서재에 있습니다"
        description={
          duplicateCount > 1
            ? `『${title.trim()}』(이)라는 제목의 책이 서재에 ${duplicateCount}권 있어요. 그래도 등록할까요?`
            : `『${title.trim()}』(은)는 이미 서재에 있어요. 그래도 등록할까요?`
        }
        confirmLabel={isEditing ? '그래도 저장' : '그래도 등록'}
        cancelLabel="취소"
        onConfirm={save}
        onCancel={() => setDuplicateCount(0)}
      />
    </form>
  );
}
