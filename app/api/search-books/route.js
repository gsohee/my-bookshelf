// 도서 검색 (작업 43)
//
// 제목 몇 글자로 책을 찾아 **제목·지은이·총 페이지**를 돌려준다.
// 사진을 찍어 읽히는 것보다 빠르고 정확하다.
//
// ★ 표지 이미지는 돌려주지 않는다. ★
// 표지를 화면에 띄우려면 브라우저가 그쪽 서버에 직접 그림을 받으러 가야 하고,
// 그러면 **그 서버가 "이 사람이 어떤 책을 보는지"를 알게 된다.**
// "기록은 내 브라우저에만"이라는 약속이 헐거워지므로 주소조차 넘기지 않는다.
// (PRD 6절 — 표지 이미지 불러오기는 비범위)
//
// 검색어는 나간다. 그것 없이는 검색이 안 된다. 대신 검색어만 나가고,
// 서재에 무엇이 있는지·무엇을 읽었는지는 함께 보내지 않는다.
//
// ── 어디에 물어보나 ─────────────────────────────────
//
//   ① 카카오 책 검색  — .env에 KAKAO_REST_API_KEY가 있으면 이쪽. 한국 책에 강하다
//   ② Google Books   — 키가 없으면 이쪽. 등록 없이 바로 쓸 수 있다
//
// 키를 나중에 넣어도 코드를 고칠 필요가 없게 두 곳을 모두 받아둔다.
//
// Design Ref: §6 서버 API
// Design Ref: §3.3② 새 책 — 제목으로 찾기

export const runtime = 'nodejs';

/** 한 번에 돌려줄 결과 수. 380px 화면에서 고르기 좋은 만큼만. */
const LIMIT = 8;

/** 기다려 줄 시간. 검색은 인식보다 가벼우므로 짧게 잡는다. */
const TIMEOUT_MS = 6000;

/** 실패를 정해진 모양으로 돌려준다. Design Ref: §6 */
function fail(status, code, message) {
  return Response.json({ error: { code, message } }, { status });
}

/** 총 페이지로 받아들일 수 있는 값인지. 터무니없는 값은 버린다. */
function cleanPages(value) {
  const pages = Number(value);
  if (!Number.isInteger(pages) || pages <= 0 || pages > 20000) return null;
  return pages;
}

/** 여러 지은이를 한 줄로. 너무 길면 화면에서 넘친다. */
function joinAuthors(list) {
  if (!Array.isArray(list)) return '';
  return list.filter(Boolean).slice(0, 3).join(', ');
}

/** `<b>` 같은 강조 표시를 떼어낸다. 카카오·네이버가 검색어에 붙여 보낸다. */
function stripTags(text) {
  return String(text ?? '').replace(/<[^>]*>/g, '').trim();
}

/** 카카오 책 검색. 한국 책 결과가 가장 낫다. */
async function askKakao(query, signal, apiKey) {
  const url = new URL('https://dapi.kakao.com/v3/search/book');
  url.searchParams.set('query', query);
  url.searchParams.set('size', String(LIMIT));

  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
    signal,
  });
  if (!response.ok) return null;

  const data = await response.json();
  if (!Array.isArray(data?.documents)) return null;

  return data.documents.map((item) => ({
    title: stripTags(item.title),
    author: joinAuthors(item.authors),
    publisher: stripTags(item.publisher),
    // 카카오는 쪽수를 주지 않는다. 사용자가 손으로 적는다.
    totalPages: null,
  }));
}

/**
 * Google Books. 키가 없어도 되고 쪽수(pageCount)를 준다.
 *
 * **키 없이 쓰면 자주 막힌다.** 키를 안 낸 요청은 전 세계가 나눠 쓰는 하루 한도를
 * 함께 쓰는데, 그게 이미 바닥나 429가 오는 일이 흔하다. (실제로 확인했다)
 * 그래서 막히면 null을 돌려주고 다음 곳으로 넘어간다.
 */
async function askGoogle(query, signal) {
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', String(LIMIT));
  url.searchParams.set('printType', 'books');
  // 결과를 가볍게 — 표지 주소(imageLinks)는 아예 받지 않는다.
  url.searchParams.set(
    'fields',
    'items(volumeInfo(title,subtitle,authors,publisher,pageCount))',
  );

  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const data = await response.json();
  if (!Array.isArray(data?.items)) return null;

  return data.items.map((item) => {
    const info = item.volumeInfo ?? {};
    return {
      title: stripTags(info.title),
      author: joinAuthors(info.authors),
      publisher: stripTags(info.publisher),
      totalPages: cleanPages(info.pageCount),
    };
  });
}

/**
 * Open Library. 마지막 대비책이다.
 *
 * 키도 한도도 없어 늘 답하지만 **한국 책은 많이 빠져 있다.**
 * 앞의 두 곳이 모두 막혔을 때 빈손으로 돌아가는 것보다는 낫다는 정도다.
 */
async function askOpenLibrary(query, signal) {
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(LIMIT));
  url.searchParams.set(
    'fields',
    'title,author_name,publisher,number_of_pages_median',
  );

  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const data = await response.json();
  if (!Array.isArray(data?.docs)) return null;

  return data.docs.map((item) => ({
    title: stripTags(item.title),
    author: joinAuthors(item.author_name),
    publisher: joinAuthors(item.publisher),
    totalPages: cleanPages(item.number_of_pages_median),
  }));
}

export async function POST(request) {
  let body = null;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'BAD_REQUEST', '검색어를 받지 못했습니다.');
  }

  const query = String(body?.query ?? '').trim();
  if (query === '') {
    return fail(400, 'BAD_REQUEST', '검색어가 비어 있습니다.');
  }

  // 너무 오래 걸리면 끊는다. 화면은 이보다 넉넉히 기다린다.
  const stopper = new AbortController();
  const timeoutId = setTimeout(() => stopper.abort(), TIMEOUT_MS);

  try {
    /*
      물어볼 곳을 차례로 놓는다. 앞에서 막히면 다음으로 넘어간다.
      카카오 키가 있으면 그것만으로 충분해서 뒤는 부르지 않는다.
    */
    const kakaoKey = process.env.KAKAO_REST_API_KEY;
    const sources = kakaoKey
      ? [(signal) => askKakao(query, signal, kakaoKey)]
      : [
          (signal) => askGoogle(query, signal),
          (signal) => askOpenLibrary(query, signal),
        ];

    let found = null;
    for (const ask of sources) {
      try {
        found = await ask(stopper.signal);
      } catch (error) {
        // 시간이 다 됐으면 다음 곳을 불러도 똑같이 막힌다.
        if (stopper.signal.aborted) throw error;
        found = null;
      }
      if (found !== null) break;
    }

    if (found === null) {
      return fail(502, 'SEARCH_FAILED', '책을 찾지 못했습니다.');
    }

    // 제목이 없는 결과는 고를 수 없으므로 버린다.
    return Response.json({ books: found.filter((item) => item.title !== '') });
  } catch {
    if (stopper.signal.aborted) {
      return fail(504, 'TIMEOUT', '시간이 오래 걸렸습니다.');
    }
    return fail(502, 'SEARCH_FAILED', '책을 찾지 못했습니다.');
  } finally {
    clearTimeout(timeoutId);
  }
}
