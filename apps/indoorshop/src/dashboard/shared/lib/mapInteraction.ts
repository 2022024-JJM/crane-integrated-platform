/*
 * 지도·3D 화면의 **드래그 문법 단일 소스** (UX 감사 A4 · P3 재통일).
 *
 * 한때 두 화면을 같은 문법으로 묶었다 — 어디서나 왼쪽=이동, 오른쪽=회전. 그런데 3D
 * 뷰어에서 그 배치는 손에 붙지 않았다(사용자 피드백): 점군을 볼 때 1차 동작은 이동이
 * 아니라 **돌려 보기**이고, 뷰어 계열(CAD·점군·Blender·Sketchfab)이 전부 왼쪽 드래그를
 * 궤도 회전에 쓴다. 반대로 2D 지도의 1차 동작은 여전히 "끌어서 이동"이라 왼쪽을 뺏을 수 없다.
 *
 * 그래서 문법을 **면(surface)별로** 둘 둔다. 하나의 표에서 갈라지므로 화면이 제 조건식을
 * 다시 적는 일은 여전히 없다.
 *
 *                     2D 지도(map)        3D 뷰어(viewer)
 *   왼쪽 드래그        이동(pan)           회전(orbit)
 *   오른쪽 드래그      회전                이동
 *   Shift + 왼쪽       회전                이동      ← 트랙패드·2버튼 마우스의 두 번째 손
 *   Alt + 왼쪽         회전                이동
 *   가운데 드래그      회전 (Shift=이동 · Ctrl/⌘=줌 — Blender 문법 보존)
 *   휠                 줌
 *
 * 두 면의 공통점: **오른쪽·Shift 는 언제나 왼쪽의 반대 동작**이다. 화면을 옮겨도 "다른
 * 손가락을 쓰면 다른 축"이라는 규칙 자체는 같아서, 배워야 할 것은 면마다 하나뿐이다.
 *
 * 이 함수를 소비하는 곳: YardMap(캔버스 지도, `map`), blenderControls(three.js 뷰어,
 * `viewer`), ViewportHelp(뷰어 조작 안내 표 — 표도 이 함수에서 만든다).
 */

export type DragAction = 'pan' | 'rotate' | 'zoom'

/**
 * 어느 면에서의 드래그인가.
 *  `map`    2D/2.5D 캔버스 지도 — 1차 동작이 이동
 *  `viewer` 3D 점군 뷰어 — 1차 동작이 회전
 */
export type DragSurface = 'map' | 'viewer'

export interface DragModifiers {
  shiftKey?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
}

/** 그 면에서 왼쪽 드래그가 뜻하는 것 — 나머지는 전부 이 값에서 파생된다 */
function primaryOf(surface: DragSurface): DragAction {
  return surface === 'viewer' ? 'rotate' : 'pan'
}

/** 왼쪽의 반대 축 — 오른쪽·Shift·Alt 가 집는 동작 */
function secondaryOf(surface: DragSurface): DragAction {
  return surface === 'viewer' ? 'pan' : 'rotate'
}

/** 이 버튼·수식 키 조합의 드래그가 뜻하는 동작 */
export function dragActionOf(
  button: number,
  modifiers: DragModifiers = {},
  surface: DragSurface = 'map'
): DragAction {
  /* 가운데 버튼 — 면과 무관하게 Blender 문법을 보존한다 (Shift=이동, Ctrl/⌘=줌, 기본=회전) */
  if (button === 1) {
    if (modifiers.shiftKey) return 'pan'
    if (modifiers.ctrlKey || modifiers.metaKey) return 'zoom'
    return 'rotate'
  }
  if (button === 2) return secondaryOf(surface)
  /* 왼쪽 — 그 면의 1차 동작, Shift·Alt 를 얹으면 반대 축 */
  if (modifiers.shiftKey || modifiers.altKey) return secondaryOf(surface)
  return primaryOf(surface)
}
