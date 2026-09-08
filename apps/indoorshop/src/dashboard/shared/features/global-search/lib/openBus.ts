/*
 * 팔레트 열기 신호 — 헤더 버튼과 전역 단축키가 **같은 문**을 두드리게 한다.
 *
 * 열림 상태 자체는 `GlobalSearch` 컴포넌트(레이아웃에 한 번 마운트)가 들고, 여기는
 * "열어 달라"는 신호만 나른다. Context 로 만들면 헤더가 레이아웃의 상태를 prop 으로
 * 받아야 해서 헤더 파일 변경이 커진다 — 다른 워커들이 헤더 근처에서 작업 중이라
 * 헤더 쪽 손대는 양을 아이콘 버튼 하나로 눌러 두려는 선택이다.
 */

type Listener = () => void

const listeners = new Set<Listener>()

/** 통합 검색 팔레트를 연다 — 어디서 부르든 레이아웃의 한 팔레트가 뜬다 */
export function openGlobalSearch(): void {
  for (const listener of listeners) listener()
}

/** 팔레트 마운트가 신호를 받는 자리. 해제 함수를 돌려준다 */
export function onGlobalSearchOpen(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
