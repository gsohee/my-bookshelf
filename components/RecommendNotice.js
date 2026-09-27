// AI 추천 주의 문구
//
// PRD N1이 못박은 문구다. 추천이 나오든 안 나오든, 어느 길로 받든 늘 보인다.
// AI가 없는 책을 지어낼 수 있기 때문이다.
//
// 추천 화면이 셋(완독 뒤·서재·직접 입력)이라 한곳에 두었다 —
// 문구를 빠뜨린 화면이 생기지 않게 하려는 것이다.
//
// Design Ref: §3.3⑥ 추천 결과

export default function RecommendNotice() {
  return (
    <p className="rounded-lg bg-warn-bg px-3 py-2.5 text-xs leading-5 text-warn-text">
      ⚠ AI 추천이므로 실제 도서 여부를 확인하세요.
    </p>
  );
}
