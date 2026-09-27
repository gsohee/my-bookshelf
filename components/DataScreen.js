'use client';

// 데이터
//
// 백업 내려받기(작업 26), 백업 파일로 되돌리기(작업 27), 내보내기(작업 28)가 있다.
// 연간 목표(작업 36)가 2단계에 이 화면에 더 들어온다.
//
// 백업과 내보내기는 목적이 다르다. 백업은 **이 앱으로 되돌리기 위한 것**이고,
// 내보내기는 **엑셀·블로그로 옮기기 위한 것**이다. 그래서 칸을 나눠 두었다.
//
// 되돌리기는 **기존 기록을 지우는 일**이라 반드시 확인창을 거친다.
// 파일을 고르는 순간에는 아무것도 바꾸지 않고, 무엇이 어떻게 바뀌는지 먼저 보여준다.
// (Design Ref: §4.6 "모양 검사 → schemaVersion 확인 → 경고 → 사용자 확인 → 반영")
//
// Design Ref: §3.3⑧ 데이터
// Design Ref: §4.6 흐름 5 — 백업과 복원
// Plan SC: S7 백업·복원 시 데이터 손실 0건

import { useId, useRef, useState } from 'react';
import {
  useBooks,
  useQuotes,
  useToRead,
  useHydrated,
  notifyBooksChanged,
} from '@/components/BookStore';
import {
  buildBackup,
  backupFileName,
  downloadJson,
  downloadText,
  inspectBackupFile,
  applyBackup,
  RestoreError,
} from '@/lib/backup';
import {
  booksToCsv,
  booksToMarkdown,
  quotesToCsv,
  quotesToMarkdown,
  exportFileName,
} from '@/lib/exportFile';
import { describeStorageError } from '@/lib/storage';
import ErrorNote from '@/components/ErrorNote';
import ConfirmDialog from '@/components/ConfirmDialog';
import GoalPanel from '@/components/GoalPanel';
import { todayKST } from '@/lib/date';
import { countFinished, countExcluded } from '@/lib/stats';

/**
 * 내보내기 한 줄 — 무엇을 몇 개, 어떤 모양으로.
 * 책과 구절이 같은 모양이라 한 벌만 만들어 두 번 쓴다.
 */
function ExportRow({ label, count, disabled, onExport }) {
  const buttonClass =
    'rounded-full border border-line px-4 py-2 text-xs text-muted disabled:border-line-soft disabled:text-faint';

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm text-ink">
        {label}{' '}
        <span className="text-xs text-faint">
          {count}
        </span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onExport('csv')}
          disabled={disabled}
          className={buttonClass}
        >
          CSV
        </button>
        <button
          type="button"
          onClick={() => onExport('md')}
          disabled={disabled}
          className={buttonClass}
        >
          마크다운
        </button>
      </div>
    </div>
  );
}

export default function DataScreen() {
  const books = useBooks();
  const quotes = useQuotes();
  const toRead = useToRead();
  const hydrated = useHydrated();

  const [done, setDone] = useState('');
  const [saveError, setSaveError] = useState(null);

  // 내보내기 — 백업과 따로 알린다. 두 칸이 서로의 결과를 보여주면 헷갈린다.
  const [exportDone, setExportDone] = useState('');
  const [exportError, setExportError] = useState(null);

  // 되돌리기 — 고른 파일을 살펴본 결과를 확인창이 뜨는 동안 들고 있는다.
  // 확인을 받기 전에는 저장소를 건드리지 않는다.
  const [pending, setPending] = useState(null);
  const [restoreError, setRestoreError] = useState(null);
  const [restoreDone, setRestoreDone] = useState(null);
  const fileInputId = useId();
  const fileInputRef = useRef(null);

  // 서버에서 그리는 동안에는 저장소가 없어 모두 비어 보인다.
  if (!hydrated) return null;

  const isEmpty =
    books.length === 0 && quotes.length === 0 && toRead.length === 0;

  function handleBackup() {
    try {
      const fileName = backupFileName(todayKST());
      downloadJson(buildBackup(), fileName);
      setDone(fileName);
      setSaveError(null);
    } catch (error) {
      setDone('');
      // 원문 오류를 그대로 보여주지 않는다. Design Ref: §8 오류 처리
      setSaveError(
        describeStorageError(
          error,
          '백업 파일을 만들지 못했어요. 잠시 후 다시 해주세요.',
        ),
      );
    }
  }

  /**
   * 내보내기. 고른 모양대로 글자를 만들어 파일로 내려받는다.
   *
   * 저장소를 건드리지 않고 읽기만 하는 일이라 확인창이 없다.
   * Design Ref: §3.3⑧ 데이터 — CSV·마크다운 내보내기
   */
  function handleExport(what, extension) {
    const today = todayKST();
    const fileName = exportFileName(what, extension, today);

    const text =
      what === '책'
        ? extension === 'csv'
          ? booksToCsv(books)
          : booksToMarkdown(books, today)
        : extension === 'csv'
          ? quotesToCsv(quotes, books)
          : quotesToMarkdown(quotes, books, today);

    const type =
      extension === 'csv'
        ? 'text/csv;charset=utf-8'
        : 'text/markdown;charset=utf-8';

    try {
      downloadText(text, fileName, type);
      setExportDone(fileName);
      setExportError(null);
    } catch (error) {
      setExportDone('');
      setExportError(
        describeStorageError(
          error,
          '파일을 만들지 못했어요. 잠시 후 다시 해주세요.',
        ),
      );
    }
  }

  /**
   * 파일을 골랐을 때. 읽어서 살펴보기만 하고 확인창을 띄운다.
   * 이 시점에는 기존 기록을 건드리지 않는다.
   */
  async function handlePickFile(event) {
    const file = event.target.files?.[0] ?? null;

    // 같은 파일을 다시 고를 수도 있어야 하므로 입력칸을 비워 둔다.
    event.target.value = '';
    if (!file) return;

    setRestoreError(null);
    setRestoreDone(null);

    try {
      setPending(await inspectBackupFile(file));
    } catch (error) {
      setPending(null);
      // 원문 오류를 그대로 보여주지 않는다. Design Ref: §8 오류 처리
      setRestoreError({
        message:
          error instanceof RestoreError
            ? error.message
            : '파일을 읽지 못했어요. 다시 골라주세요.',
      });
    }
  }

  /** 확인창에서 "되돌리기"를 눌렀을 때. 여기서부터 덮어쓴다. */
  function handleRestore() {
    const target = pending;
    setPending(null);
    if (!target) return;

    try {
      const counts = applyBackup(target.data);
      setRestoreDone(counts);
      setRestoreError(null);
      // 서재·읽을 책 화면이 바뀐 내용을 바로 보게 한다.
      notifyBooksChanged();
    } catch (error) {
      setRestoreDone(null);
      setRestoreError(
        error instanceof RestoreError
          ? { message: error.message }
          : describeStorageError(
              error,
              '되돌리지 못했어요. 잠시 후 다시 해주세요.',
            ),
      );
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <section>
        <h2 className="text-sm font-medium text-muted">
          지금 담긴 기록
        </h2>
        <dl className="mt-2 flex gap-5 text-sm">
          <div>
            <dt className="text-xs text-muted">책</dt>
            <dd className="mt-0.5 text-ink">
              {books.length}권
            </dd>
          </div>
          {/*
            완독 수는 중단한 책을 뺀 숫자다. (작업 29 / S12)
            여기 적어 두면 "합계에서 중단이 빠졌는가"를 화면에서 바로 볼 수 있다.
          */}
          <div>
            <dt className="text-xs text-muted">완독</dt>
            <dd className="mt-0.5 text-ink">
              {countFinished(books)}권
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">구절</dt>
            <dd className="mt-0.5 text-ink">
              {quotes.length}개
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">읽을 책</dt>
            <dd className="mt-0.5 text-ink">
              {toRead.length}권
            </dd>
          </div>
        </dl>

        {/* 숫자가 안 맞아 보일 때를 대비해 이유를 적어 둔다 */}
        {countExcluded(books) > 0 && (
          <p className="mt-2 text-xs text-faint">
            중단한 책 {countExcluded(books)}권은 완독 합계에서 뺐어요.
          </p>
        )}
      </section>

      {/* 연간 목표 (작업 36) */}
      <GoalPanel />

      <section className="rounded-xl border border-line-soft p-4">
        <h2 className="text-sm font-medium text-ink">
          백업 파일 내려받기
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          기록은 이 브라우저 안에만 있어요. 저장소를 지우거나 기기를 바꾸면
          사라지니, 가끔 파일로 받아두면 안심할 수 있어요.
        </p>
        <p className="mt-2 text-xs leading-5 text-faint">
          책·구절·읽을 책이 담깁니다. 사진과 설정값은 들어가지 않아요.
        </p>

        <button
          type="button"
          onClick={handleBackup}
          disabled={isEmpty}
          className="mt-4 w-full rounded-full bg-brand px-4 py-3 text-sm font-semibold text-brand-ink disabled:bg-line disabled:text-faint"
        >
          백업 파일 받기
        </button>

        {isEmpty && (
          <p className="mt-2 text-center text-xs text-faint">
            받을 기록이 아직 없어요.
          </p>
        )}

        {done && (
          <p className="mt-3 rounded-lg bg-surface-soft px-3 py-2 text-center text-xs text-muted">
            {done} 파일을 받았어요.
          </p>
        )}

        <ErrorNote
          message={saveError?.message}
          code={saveError?.code}
          className="mt-3"
        />
      </section>

      <section className="rounded-xl border border-line-soft p-4">
        <h2 className="text-sm font-medium text-ink">
          다른 곳으로 옮기기
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          <b className="font-medium">CSV</b>는 엑셀·구글 시트에서 열 수 있고,{' '}
          <b className="font-medium">마크다운</b>은 블로그·노션에 그대로
          붙여넣을 수 있어요.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <ExportRow
            label="책 목록"
            count={`${books.length}권`}
            disabled={books.length === 0}
            onExport={(extension) => handleExport('책', extension)}
          />
          <ExportRow
            label="구절 모음"
            count={`${quotes.length}개`}
            disabled={quotes.length === 0}
            onExport={(extension) => handleExport('구절', extension)}
          />
        </div>

        {exportDone && (
          <p className="mt-3 rounded-lg bg-surface-soft px-3 py-2 text-center text-xs text-muted">
            {exportDone} 파일을 받았어요.
          </p>
        )}

        <ErrorNote
          message={exportError?.message}
          code={exportError?.code}
          className="mt-3"
        />
      </section>

      <section className="rounded-xl border border-line-soft p-4">
        <h2 className="text-sm font-medium text-ink">
          백업 파일로 되돌리기
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          받아둔 파일을 고르면 그때의 기록으로 되돌립니다.
        </p>
        <p className="mt-2 text-xs leading-5 text-warn-text">
          지금 있는 기록은 파일의 내용으로 바뀌어요. 되돌리기 전에 한 번 더 물어봅니다.
        </p>

        {/* 실제 입력칸은 감춰두고 아래 버튼으로 연다 */}
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          accept="application/json,.json"
          onChange={handlePickFile}
          className="sr-only"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 w-full rounded-full border border-line px-4 py-3 text-sm font-medium text-muted"
        >
          백업 파일 고르기
        </button>

        {restoreDone && (
          <p className="mt-3 rounded-lg bg-surface-soft px-3 py-2 text-center text-xs leading-5 text-muted">
            되돌렸어요. 책 {restoreDone.books}권 · 구절 {restoreDone.quotes}개 ·
            읽을 책 {restoreDone.toRead}권
          </p>
        )}

        <ErrorNote
          message={restoreError?.message}
          code={restoreError?.code}
          className="mt-3"
        />
      </section>

      {/*
        덮어쓰기 전에 반드시 묻는다. 무엇이 사라지고 무엇이 들어오는지 숫자로 보여준다.
        Design Ref: §4.6 "기존 기록을 덮어씁니다" 경고 → 사용자 확인 → 반영
      */}
      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.needsMigrate
            ? '예전 형식이에요. 바꿔서 불러올까요?'
            : '지금 기록을 덮어쓸까요?'
        }
        description={
          pending
            ? `지금 있는 책 ${books.length}권 · 구절 ${quotes.length}개 · 읽을 책 ${toRead.length}권이` +
              ` 파일에 담긴 책 ${pending.counts.books}권 · 구절 ${pending.counts.quotes}개 · 읽을 책 ${pending.counts.toRead}권으로 바뀝니다.` +
              ' 되돌릴 수 없어요.'
            : ''
        }
        confirmLabel="되돌리기"
        cancelLabel="그대로 두기"
        onConfirm={handleRestore}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
