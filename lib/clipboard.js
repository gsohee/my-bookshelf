// 클립보드에 담기
//
// 요즘 방법(navigator.clipboard)이 늘 되는 것은 아니다.
// 브라우저 설정이나 권한에 따라 "쓰기 권한 없음"으로 막히는 경우가 실제로 있다.
// 그때 그냥 실패하면 **클릭 1회로 복사**(S8)가 되지 않으므로, 옛 방법으로 한 번 더 시도한다.
//
//   ① navigator.clipboard.writeText — 요즘 방법. 권한이 있으면 이걸로 끝난다
//   ② document.execCommand('copy')  — 옛 방법. 권한 설정과 무관하게 동작한다
//
// ②는 더 이상 권장되지 않는 기능이지만 모든 브라우저가 아직 지원하고,
// ①이 막혔을 때 사용자가 손으로 긁어 복사하지 않아도 되게 해주는 유일한 길이다.
//
// Plan SC: S8 블로그용 구절 복사 클릭 1회

/** 화면 밖 입력칸에 담아 브라우저에 복사를 시킨다. 끝나면 바로 치운다. */
function copyWithTextarea(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  // 화면에 보이지 않게, 그러나 선택은 되게 둔다.
  // display:none이면 선택이 되지 않아 복사도 되지 않는다.
  area.style.position = 'fixed';
  area.style.top = '-1000px';
  area.style.opacity = '0';

  document.body.appendChild(area);
  area.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  area.remove();
  return copied;
}

/**
 * 글자를 붙여넣을 수 있는 자리에 담는다.
 *
 * **반드시 버튼을 누른 그 자리에서 불러야 한다.** 두 방법 모두 "사용자가 방금 눌렀다"는
 * 사실이 있어야 동작하기 때문이다.
 *
 * @returns 담겼으면 true
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 요즘 방법이 막혔다. 옛 방법으로 한 번 더 해본다.
    return copyWithTextarea(text);
  }
}
