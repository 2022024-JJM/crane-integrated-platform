import { useEffect } from 'react'

/*
 * ESC 의 **우선권 장부** — "ESC 는 한 번에 한 가지만 한다"(UX 감사 G2 후속, W7-6V).
 *
 * ESC 를 듣는 손이 둘이다: 위에 뜬 오버레이(모달·메뉴·드로어 — 닫기)와 그 뒤의 지도
 * (드릴다운 한 단계 위, `useDrilldownEscape`). 오버레이가 열려 있는 동안 ESC 한 번에
 * 둘이 같이 반응하면, 모달을 닫으려던 손이 지도까지 한 단계 물려 버린다.
 *
 * `event.defaultPrevented` 만으로는 못 막는다 — 리스너가 서로 다른 노드(document ·
 * window · 요소)에 걸려 있어 **실행 순서를 약속할 수 없기** 때문이다(버블은
 * 요소→document→window 순이라, document 에 건 드릴다운이 window 에 건 메뉴보다
 * 먼저 돈다). 그래서 순서와 무관한 장부를 둔다: 오버레이는 열려 있는 동안 우선권을
 * 등록하고, 드릴다운 ESC 는 장부가 비어 있을 때만 움직인다.
 *
 * 오버레이 쪽은 등록과 함께 제 핸들러에서 `event.preventDefault()` 도 부른다 —
 * 같은 계층의 다른 청취자(전역 검색처럼 defaultPrevented 를 존중하는 쪽)를 위한
 * 예의이자, 장부를 모르는 소비자에 대한 이중 안전이다.
 */

let claims = 0

/** 오버레이가 열리는 순간 부른다. 반환된 함수로 놓는다(닫힘·언마운트) */
export function claimEscape(): () => void {
  claims += 1
  let released = false
  return () => {
    if (released) return
    released = true
    claims -= 1
  }
}

/** ESC 우선권을 쥔 오버레이가 지금 하나라도 열려 있는가 */
export function hasEscapeClaims(): boolean {
  return claims > 0
}

/** 열림 상태를 그대로 장부에 잇는 훅 — 오버레이 컴포넌트가 한 줄로 쓴다 */
export function useEscapeClaim(active: boolean): void {
  useEffect(() => {
    if (!active) return
    return claimEscape()
  }, [active])
}

/** 테스트 격리용 — 앱 코드는 부르지 않는다 */
export function resetEscapeClaims(): void {
  claims = 0
}
