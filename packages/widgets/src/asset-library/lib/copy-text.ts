/**
 * 글자를 클립보드에 넣는다. 운영 서버는 폐쇄망의 http 라 `navigator.clipboard`
 * 가 없을 수 있다(보안 컨텍스트 전용) — 그때는 임시 입력칸을 골라 복사한다.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 권한 거부 등 — 아래 방법으로 다시 해 본다.
  }
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  } catch {
    return false;
  }
}
