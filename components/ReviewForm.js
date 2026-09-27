'use client';

// 완독 감상 선택
//
// 타이핑 없이 버튼으로 고른다. 다 읽은 직후에 길게 쓰라고 하면 그냥 건너뛰게 된다.
// 메모만 자유롭게 적을 수 있다.
//
// 여기서 고른 것이 나중에 두 곳에 쓰인다.
//   · AI 추천(작업 22) — 감상 항목과 제목·장르만 보낸다. 메모는 보내지 않는다
//   · 분위기 비율 통계(작업 33)
//
// Design Ref: §3.3⑤ 완독 감상
// Design Ref: §4.4 흐름 3
// Design Ref: §5 회차 구조 — reads[].review

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBooks, useHydrated, notifyBooksChanged } from '@/components/BookStore';
import { saveReview, describeStorageError } from '@/lib/storage';
import ErrorNote from '@/components/ErrorNote';
import {
  MOODS,
  LIKED_POINTS,
  DIFFICULTIES,
  RATING,
  formatRating,
} from '@/lib/constants';

const sectionLabel =
  'text-sm font-medium text-muted';

/** 골랐는지 아닌지를 색으로 보여주는 버튼. */
function Chip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
        selected
          ? 'border-brand bg-brand font-medium text-brand-ink'
          : 'border-line text-muted hover:border-brand'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * 별 하나. 채워진 만큼만 금색으로 보인다.
 *
 * 반쪽을 그리려고 그림을 새로 만들지 않는다. **같은 별을 두 번 겹쳐** 놓고
 * 위쪽 금색 별만 폭을 잘라 보여준다 — 반쪽이면 50%, 꽉 차면 100%.
 */
function Star({ fill }) {
  return (
    <span
      aria-hidden="true"
      className="relative block h-full w-full text-3xl leading-none"
    >
      <span className="absolute inset-0 flex items-center justify-center text-faint">
        ★
      </span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden text-brand"
        style={{ width: `${fill * 100}%` }}
      >
        {/* 잘려도 별이 제자리에 있도록, 안쪽은 칸 전체 너비를 유지한다 */}
        <span className="absolute inset-y-0 left-0 flex w-14 items-center justify-center">
          ★
        </span>
      </span>
    </span>
  );
}

/**
 * 별점. 작업 31에서 **0.5 단위**가 됐다.
 *
 * 별 하나를 왼쪽·오른쪽 두 칸으로 나눠, 왼쪽을 누르면 0.5 오른쪽을 누르면 1이다.
 * 여전히 **한 번만 누르면 정해진다** — 0.5를 고르려고 두 번 누르게 하지 않는다.
 * 지금 값과 같은 칸을 다시 누르면 선택이 풀린다.
 */
function Stars({ value, onChange }) {
  const stars = Array.from({ length: RATING.stars }, (_, index) => index + 1);

  /** 이 별이 얼마나 채워지는가. 1 = 꽉, 0.5 = 반쪽, 0 = 빈 별 */
  function fillOf(star) {
    if (value >= star) return 1;
    if (value >= star - 0.5) return 0.5;
    return 0;
  }

  return (
    <div>
      {/*
        별 하나를 넉넉한 정사각형으로 둔다. 반쪽 버튼이 손가락으로 누를 만해야 하는데,
        별 글자 크기에 맞추면 한 칸이 16px밖에 안 돼 옆 칸을 잘못 누르게 된다.
        (CLAUDE.md 8절 — 기준 화면 폭 380px, 모바일 우선)
      */}
      <div className="flex items-center">
        {stars.map((star) => (
          <span key={star} className="relative block h-14 w-14">
            <Star fill={fillOf(star)} />

            {/* 별 위에 반쪽짜리 투명 버튼 둘을 겹쳐 둔다 */}
            {[star - 0.5, star].map((score, index) => (
              <button
                key={score}
                type="button"
                onClick={() => onChange(value === score ? 0 : score)}
                aria-label={`${score}점`}
                aria-pressed={value === score}
                className={`absolute inset-y-0 w-1/2 ${
                  index === 0 ? 'left-0' : 'right-0'
                }`}
              />
            ))}
          </span>
        ))}
      </div>
      <p className="mt-1 text-sm text-muted">
        {formatRating(value) ?? '고르지 않음'}
        {value > 0 && (
          <span className="ml-2 text-xs text-faint">
            별의 왼쪽 절반을 누르면 반 점이에요
          </span>
        )}
      </p>
    </div>
  );
}

export default function ReviewForm({ bookId }) {
  const router = useRouter();
  const books = useBooks();
  const hydrated = useHydrated();

  const [mood, setMood] = useState(null);
  const [likedPoints, setLikedPoints] = useState([]);
  const [difficulty, setDifficulty] = useState(null);
  const [rating, setRating] = useState(0);
  const [memo, setMemo] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // 서버에서 그리는 동안에는 저장소가 없어 서재가 비어 보인다.
  if (!hydrated) return null;

  const book = books.find((item) => item.id === bookId);

  if (!book) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted">
          그런 책을 찾지 못했어요.
        </p>
        <Link
          href="/"
          className="rounded-full border border-line px-5 py-2 text-sm text-muted"
        >
          서재로 가기
        </Link>
      </div>
    );
  }

  // 이미 적어둔 감상이 있으면 그 값에서 시작한다. 고치러 다시 올 수 있기 때문이다.
  // 화면을 그린 뒤에 값을 넣는 방식은 쓰지 않는다 — 첫 렌더에 한 번만 옮겨 담는다.
  const saved = book.reads?.[book.reads.length - 1]?.review;
  if (!ready) {
    if (saved) {
      setMood(saved.mood ?? null);
      setLikedPoints(saved.likedPoints ?? []);
      setDifficulty(saved.difficulty ?? null);
      setRating(saved.rating ?? 0);
      setMemo(saved.memo ?? '');
    }
    setReady(true);
  }

  /** 좋았던 점은 여러 개 고를 수 있다. 누르면 켜지고 다시 누르면 꺼진다. */
  function toggleLiked(point) {
    setLikedPoints((current) =>
      current.includes(point)
        ? current.filter((item) => item !== point)
        : [...current, point],
    );
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      saveReview(bookId, { mood, likedPoints, difficulty, rating, memo });
      notifyBooksChanged();
      // 감상을 담고 나서 추천 결과 화면으로 넘어간다. Design Ref: §4.4 흐름 3
      router.push(`/books/${bookId}/finish/result`);
    } catch (error) {
      setSaving(false);
      // 원문 오류를 그대로 보여주지 않는다. Design Ref: §8 오류 처리
      setSaveError(
        describeStorageError(error, '저장하지 못했어요. 잠시 후 다시 해주세요.'),
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6">
      <p className="text-xs text-muted">
        『{book.title}』을(를) 다 읽었어요
      </p>

      <fieldset>
        <legend className={sectionLabel}>
          분위기 <span className="text-faint">(하나)</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {MOODS.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={mood === item}
              onClick={() => setMood(mood === item ? null : item)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={sectionLabel}>
          좋았던 점 <span className="text-faint">(여러 개)</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LIKED_POINTS.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={likedPoints.includes(item)}
              onClick={() => toggleLiked(item)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={sectionLabel}>난이도</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIFFICULTIES.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={difficulty === item}
              onClick={() => setDifficulty(difficulty === item ? null : item)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={sectionLabel}>별점</legend>
        <div className="mt-2">
          <Stars value={rating} onChange={setRating} />
        </div>
      </fieldset>

      <div>
        <label htmlFor="reviewMemo" className={sectionLabel}>
          메모
        </label>
        <textarea
          id="reviewMemo"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          placeholder="남기고 싶은 말이 있다면"
          rows={3}
          className="mt-2 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-base leading-7 text-ink outline-none focus:border-brand"
        />
        <p className="mt-1 text-xs text-muted">
          메모는 나만 봅니다. AI 추천에 보내지 않아요.
        </p>
      </div>

      <ErrorNote message={saveError?.message} code={saveError?.code} />

      <div className="mt-auto flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-brand-ink disabled:bg-line disabled:text-muted"
        >
          {saving ? '저장하는 중…' : '추천 받기'}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/books/${bookId}`)}
          className="rounded-full border border-line px-6 py-3 text-sm text-muted"
        >
          나중에
        </button>
      </div>
    </form>
  );
}
