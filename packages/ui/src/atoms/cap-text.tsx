import { Children, type ReactNode } from 'react';

/**
 * 자식 중 글자 조각만 `text-box-cap` 상자로 감싼다 — 고정 높이 컨트롤(버튼·배지·
 * 토글)의 한 줄 글자를 세로 가운데에 놓기 위해서다(`global.css` 의 `text-box-cap`).
 * 이웃한 글자 조각은 한 상자로 합치고(`{n} 개` 가 플렉스 간격으로 벌어지지 않게),
 * 아이콘 같은 요소와 공백만 있는 조각은 그대로 둔다.
 */
export function CapText({ children }: { children?: ReactNode }) {
  const out: ReactNode[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const text = run.join('');
    out.push(
      text.trim() ? (
        <span key={`cap-${out.length}`} className="text-box-cap">
          {text}
        </span>
      ) : (
        text
      ),
    );
    run = [];
  };
  for (const child of Children.toArray(children)) {
    if (typeof child === 'string' || typeof child === 'number') {
      run.push(String(child));
    } else {
      flush();
      out.push(child);
    }
  }
  flush();
  return out;
}
