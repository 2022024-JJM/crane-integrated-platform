import { useEffect } from 'react'

/*
 * ESC = 한 단계 위 (베이 → 공장 → 야드).
 *
 * 지도에서 깊이 들어간 뒤 나오는 길이 마우스로 브레드크럼을 정확히 찍는 것뿐이면,
 * 훑어보는 동안 손이 계속 화면 위쪽을 왕복한다. ESC 는 그 왕복을 없앤다 — 뒤로가기와
 * 같은 계단을 쓰되(부모 = `parentDrilldown`) 히스토리를 **앞으로** 쌓으므로, 잘못
 * 나왔으면 뒤로가기로 되돌아간다.
 */

/**
 * 지금 글자를 치고 있는 자리인가.
 *
 * 검색창에 블록 번호를 치다 ESC 를 누르는 것은 "드롭다운을 닫아라"이지 "화면에서
 * 나가라"가 아니다. 그 구분을 못 하면 검색 도중 지도가 통째로 대문으로 튄다.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.closest('[contenteditable="true"], [role="textbox"], [role="combobox"]') != null
}

/** 문서 어디서든 ESC 를 받아 한 단계 위로 올린다. `enabled=false` 면 아무것도 걸지 않는다 */
export function useDrilldownEscape(up: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (isTypingTarget(event.target)) return
      up()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [up, enabled])
}
