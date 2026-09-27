'use client';

// 통계 (작업 33)
//
// 숫자는 하나도 여기서 세지 않는다. 전부 `lib/stats.js`가 낸 값을 받아 그리기만 한다.
// (Design Ref: §4.5 "lib/stats.js가 하나인 이유")
//
// 그래프는 Recharts로 그린다 — 막대·원·꺾은선을 직접 그리려면 좌표 계산을 손으로 해야 한다.
//
// Design Ref: §3.3⑨ 돌아보기 — 통계
// Design Ref: §4.5 흐름 4 — 통계
// Plan SC: S10 통계 확인 / S12 중단 분리

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useBooks, useHydrated } from '@/components/BookStore';
import EmptyState from '@/components/EmptyState';
import { getGenreColor, MOODS } from '@/lib/constants';
import { summarize, countByYear } from '@/lib/stats';

/** 분위기 5종의 색. 장르와 달리 정해진 색이 없어 여기서 한 번만 정한다. */
const MOOD_COLORS = ['#F8CBA6', '#AFD6F0', '#DDBCE8', '#BFC4D4', '#D7E4A6'];

/** 한 덩어리. 제목과 그래프를 같은 모양으로 감싼다. */
function Block({ title, hint, children }) {
  return (
    <section className="rounded-xl border border-line-soft p-4">
      <h3 className="text-sm font-medium text-ink">
        {title}
      </h3>
      {hint && (
        <p className="mt-1 text-xs text-faint">{hint}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const axisStyle = { fontSize: 11, fill: 'currentColor' };

export default function StatsPanel() {
  const books = useBooks();
  const hydrated = useHydrated();

  // 연도 고르기. 기록이 있는 해만 고를 수 있게 한다.
  const years = useMemo(
    () => countByYear(books).map((item) => item.year),
    [books],
  );
  const [picked, setPicked] = useState(null);
  const year = picked ?? years[0] ?? null;

  const stat = useMemo(
    () => summarize(books, year === null ? {} : { year }),
    [books, year],
  );

  if (!hydrated) return null;

  // 데이터가 0건인 화면에는 안내 문구를 둔다. (CLAUDE.md 8절)
  if (stat.finishedRounds === 0 && stat.byYear.length === 0) {
    return (
      <EmptyState
        title="아직 다 읽은 책이 없어요."
        description="한 권을 끝내면 여기에 기록이 쌓여요."
        actionLabel="서재로 가기"
        actionHref="/"
      />
    );
  }

  const genreData = stat.byGenre.map((item) => ({
    name: item.genre,
    value: item.count,
    color: getGenreColor(item.genre).bg,
  }));

  const moodData = stat.byMood.map((item) => ({
    name: item.mood,
    value: item.count,
    color: MOOD_COLORS[MOODS.indexOf(item.mood)] ?? MOOD_COLORS[0],
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* 연도 고르기 */}
      <div className="flex items-center gap-2">
        <label htmlFor="statYear" className="sr-only">
          연도 고르기
        </label>
        <select
          id="statYear"
          value={year ?? ''}
          onChange={(event) => setPicked(Number(event.target.value))}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted outline-none focus:border-brand"
        >
          {years.map((item) => (
            <option key={item} value={item}>
              {item}년
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">
          {year}년에 {stat.finishedRounds}번 읽었어요
        </p>
      </div>

      {/* 총 페이지 — 그래프보다 숫자 하나가 더 잘 읽힌다 */}
      <Block
        title="읽은 쪽수"
        hint={
          stat.pages.unknown > 0
            ? `총 페이지를 적지 않은 ${stat.pages.unknown}번은 빼고 더했어요`
            : null
        }
      >
        <p className="text-2xl font-semibold tracking-tight text-ink">
          {stat.pages.pages.toLocaleString('ko-KR')}쪽
        </p>
      </Block>

      {/* 연도별 권수 — 해마다 얼마나 읽었나 */}
      <Block title="연도별" hint="다 읽은 횟수. 같은 책을 다시 읽으면 따로 셉니다">
        <ResponsiveContainer width="100%" height={Math.max(120, stat.byYear.length * 36)}>
          <BarChart
            data={[...stat.byYear].reverse()}
            layout="vertical"
            margin={{ left: 8, right: 16 }}
          >
            <XAxis type="number" allowDecimals={false} tick={axisStyle} />
            <YAxis
              type="category"
              dataKey="year"
              width={44}
              tick={axisStyle}
              tickFormatter={(value) => `${value}년`}
            />
            <Tooltip formatter={(value) => [`${value}번`, '읽음']} />
            <Bar dataKey="count" fill="var(--brand)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Block>

      {/* 월별 추이 — 12칸을 빠짐없이 그린다 */}
      <Block title={`${year}년 월별 추이`}>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={stat.byMonth ?? []} margin={{ left: -20, right: 8 }}>
            <XAxis
              dataKey="month"
              tick={axisStyle}
              tickFormatter={(value) => `${value}`}
            />
            <YAxis allowDecimals={false} tick={axisStyle} />
            <Tooltip
              labelFormatter={(value) => `${value}월`}
              formatter={(value) => [`${value}번`, '읽음']}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="var(--brand)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Block>

      {/* 장르 비율 — 색은 서재의 책등과 같은 색을 쓴다 */}
      <Block title={`${year}년 장르`}>
        {genreData.length === 0 ? (
          <p className="text-sm text-muted">
            이 해에 다 읽은 책이 없어요.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={genreData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={36}
                  outerRadius={64}
                >
                  {genreData.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}번`, '읽음']} />
              </PieChart>
            </ResponsiveContainer>
            <Legend items={genreData} />
          </>
        )}
      </Block>

      {/* 분위기 비율 — 감상을 적은 것만 들어간다 */}
      <Block title={`${year}년 분위기`} hint="감상에서 분위기를 고른 것만 셉니다">
        {moodData.length === 0 ? (
          <p className="text-sm text-muted">
            아직 고른 분위기가 없어요.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={moodData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={36}
                  outerRadius={64}
                >
                  {moodData.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}번`, '읽음']} />
              </PieChart>
            </ResponsiveContainer>
            <Legend items={moodData} />
          </>
        )}
      </Block>

      {/* 중단한 책이 빠졌다는 사실을 숨기지 않는다 (S12) */}
      {stat.excluded > 0 && (
        <p className="text-xs text-faint">
          중단한 책 {stat.excluded}권은 모든 숫자에서 뺐어요.
        </p>
      )}
    </div>
  );
}

/** 원 그래프 옆 이름표. 380px에서는 그래프 안에 글자를 넣으면 겹친다. */
function Legend({ items }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {items.map((item) => (
        <li key={item.name} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            style={{ backgroundColor: item.color }}
            className="h-2.5 w-2.5 rounded-full"
          />
          <span className="text-muted">
            {item.name} {item.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
