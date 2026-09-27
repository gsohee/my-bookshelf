// 빈 책꽂이 표시
//
// 책이 한 권도 없을 때 보여주는 그림.
// 점선으로 그린 책등 세 개다 — "여기에 책이 꽂힐 자리"라는 뜻을 글자 없이 전한다.
// 두께와 높이를 조금씩 다르게 해서 실제 책장(작업 11)에서 보게 될 모습과 이어 보이게 했다.
//
// Design Ref: §3.3① 빈 서재 안내

/** 점선 책등의 두께와 높이(px). 얇은 책·두꺼운 책이 섞인 모양. */
const SPINES = [
  { width: 26, height: 72 },
  { width: 40, height: 84 },
  { width: 32, height: 76 },
];

export default function EmptyShelfMark() {
  return (
    <div className="flex items-end justify-center gap-1.5">
      {SPINES.map((spine) => (
        <div
          key={spine.width}
          style={{ width: `${spine.width}px`, height: `${spine.height}px` }}
          className="rounded-sm border-2 border-dashed border-zinc-200 dark:border-zinc-800"
        />
      ))}
    </div>
  );
}
