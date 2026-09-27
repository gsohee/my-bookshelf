// 구절 줄 세우기
//
// 책을 앞에서부터 읽어 내려간 차례대로 보이게 한다.
// 페이지를 적지 않은 구절은 어디에 끼울지 알 수 없으므로 맨 뒤로 보낸다.
//
// Design Ref: §3.3③ "구절 목록 — 페이지 순, 페이지 없는 건 맨 뒤"
// PRD M2 "책별 구절 모아보기(페이지 순 — 페이지를 비운 구절은 맨 뒤)"

/** 같은 페이지이거나 둘 다 페이지가 없으면 먼저 적은 것이 앞에 온다. */
function byCreatedAt(a, b) {
  return String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));
}

/**
 * 정렬한 새 목록을 돌려준다. 받은 목록은 건드리지 않는다.
 */
export function sortQuotes(quotes) {
  return [...quotes].sort((a, b) => {
    const ap = a.page;
    const bp = b.page;

    const aNone = ap === null || ap === undefined;
    const bNone = bp === null || bp === undefined;

    // 페이지 없는 것끼리는 적은 차례대로
    if (aNone && bNone) return byCreatedAt(a, b);
    // 페이지 없는 쪽이 뒤로
    if (aNone) return 1;
    if (bNone) return -1;

    if (ap !== bp) return ap - bp;
    return byCreatedAt(a, b);
  });
}
