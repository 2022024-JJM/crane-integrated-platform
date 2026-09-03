import { useCallback } from 'react'
import { useEscapeKey } from './useEscapeKey'

/*
 * ESC = 한 단계 위 (베이 → 공장 → 야드).
 *
 * 지도에서 깊이 들어간 뒤 나오는 길이 마우스로 브레드크럼을 정확히 찍는 것뿐이면,
 * 훑어보는 동안 손이 계속 화면 위쪽을 왕복한다. ESC 는 그 왕복을 없앤다 — 뒤로가기와
 * 같은 계단을 쓰되(부모 = `parentDrilldown`) 히스토리를 **앞으로** 쌓으므로, 잘못
 * 나왔으면 뒤로가기로 되돌아간다.
 *
 * 청취는 `useEscapeKey` 가 문서 레벨에서 한다 — 커서 위치·포커스와 무관하게, 딥링크로
 * 막 연 화면에서도 첫 ESC 가 먹도록.
 */

/** 지금 글자를 치고 있는 자리인가 — 판정은 공용 훅과 한 자리에 있다 */
export { isTypingTarget } from './useEscapeKey'

/** 문서 어디서든 ESC 를 받아 한 단계 위로 올린다. `enabled=false` 면 아무것도 걸지 않는다 */
export function useDrilldownEscape(up: () => void, enabled = true): void {
  useEscapeKey(
    useCallback(() => {
      up()
    }, [up]),
    { enabled }
  )
}
