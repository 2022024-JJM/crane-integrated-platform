/*
 * 지도·3D 화면의 **드래그 문법 단일 소스** (UX 감사 A4).
 *
 * 회전이 화면마다 달랐다 — 조립 맵 안내 "우클릭 드래그", 의장·도장 맵 "Shift 또는
 * 오른쪽 버튼", 3D 뷰어는 실제로 **왼쪽** 드래그가 회전. 같은 야드를 보는 화면들
 * 사이에서 손이 배운 것이 다음 화면에서 배신당했다.
 *
 * 이제 모든 화면이 한 문법을 쓴다:
 *
 *   왼쪽 드래그              이동(pan)
 *   오른쪽 드래그            회전(rotate)
 *   Shift + 드래그           회전  (트랙패드·2버튼 마우스 대응)
 *   Alt + 왼쪽 드래그        회전  (Blender 3버튼 에뮬레이션 습관 보존)
 *   가운데 드래그            회전  (Shift+가운데 = 이동, Ctrl+가운데 = 줌 — Blender)
 *   휠                       줌
 *
 * 기준은 지도 화면의 기존 학습(왼쪽 = 이동, 오른쪽/Shift = 회전)이다 — 지도는 "끌어서
 * 이동"이 1차 동작이라 왼쪽을 빼앗을 수 없고, 뷰어가 지도에 맞추는 쪽이 화면 수가 적다.
 *
 * 이 함수를 소비하는 곳: YardMap(캔버스 지도), blenderControls(three.js 뷰어).
 * 새 화면이 드래그를 해석해야 하면 여기의 답을 쓴다 — 조건식을 다시 적지 않는다.
 */

export type DragAction = 'pan' | 'rotate' | 'zoom'

export interface DragModifiers {
  shiftKey?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
}

/** 이 버튼·수식 키 조합의 드래그가 뜻하는 동작 */
export function dragActionOf(button: number, modifiers: DragModifiers = {}): DragAction {
  /* 가운데 버튼 — Blender 문법을 보존한다 (Shift=이동, Ctrl/⌘=줌, 기본=회전) */
  if (button === 1) {
    if (modifiers.shiftKey) return 'pan'
    if (modifiers.ctrlKey || modifiers.metaKey) return 'zoom'
    return 'rotate'
  }
  if (button === 2) return 'rotate'
  /* 왼쪽 — 기본은 이동, Shift·Alt 를 얹으면 회전 */
  if (modifiers.shiftKey || modifiers.altKey) return 'rotate'
  return 'pan'
}
