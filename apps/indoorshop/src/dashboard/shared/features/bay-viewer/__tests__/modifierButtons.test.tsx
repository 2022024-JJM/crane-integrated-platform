import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { assignedFor, bindModifierAwareButtons } from '../lib/blenderControls'

/*
 * Shift+드래그 이동 — 한 번 이동한 뒤 Shift 없이 끌어도 이동하던 문제(사용자 지적).
 *
 * OrbitControls 는 같은 요소의 pointerdown 에서 그 자리의 버튼 배치를 읽는다. 배치를 갈아끼우는
 * 쪽이 그보다 **먼저** 돌아야 이번 드래그에 먹는다 — 그래서 캡처 단계로 건다. 그리고 OrbitControls 는
 * Ctrl·Meta·Shift 가 눌려 있으면 회전과 이동을 스스로 맞바꾸므로, 그만큼 반대로 넣어 둔다.
 */
type Buttons = OrbitControls['mouseButtons']

function harness() {
  const el = document.createElement('div')
  const controls = { mouseButtons: { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN } as Buttons }
  /* OrbitControls 자리 — 먼저 걸린 버블 단계 리스너가 그 순간의 배치를 읽는다 */
  const seen: (THREE.MOUSE | null | undefined)[] = []
  el.addEventListener('pointerdown', () => seen.push(controls.mouseButtons.LEFT))
  bindModifierAwareButtons(controls as unknown as OrbitControls, el)
  const press = (init: MouseEventInit) => el.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true, ...init }))
  return { controls, seen, press }
}

describe('bindModifierAwareButtons', () => {
  it('배치는 이번 드래그에 먹는다 — Shift 드래그 다음의 맨 드래그는 회전이다', () => {
    const { seen, press } = harness()
    press({ shiftKey: true })
    press({})
    /* Shift: 이동을 원하므로 내장 규칙이 뒤집을 ROTATE 를 넣는다 / 맨 드래그: 회전 그대로 */
    expect(seen).toEqual([THREE.MOUSE.ROTATE, THREE.MOUSE.ROTATE])
  })

  it('Alt 드래그는 내장 규칙이 뒤집지 않으므로 이동을 그대로 넣는다', () => {
    const { seen, press } = harness()
    press({ altKey: true })
    expect(seen).toEqual([THREE.MOUSE.PAN])
  })
})

describe('assignedFor', () => {
  const none = { ctrlKey: false, metaKey: false, shiftKey: false }
  it('수식 키가 없으면 그대로, Ctrl·Meta·Shift 면 회전↔이동을 맞바꿔 넣는다(줌은 그대로)', () => {
    expect(assignedFor(THREE.MOUSE.ROTATE, none)).toBe(THREE.MOUSE.ROTATE)
    expect(assignedFor(THREE.MOUSE.PAN, { ...none, shiftKey: true })).toBe(THREE.MOUSE.ROTATE)
    expect(assignedFor(THREE.MOUSE.ROTATE, { ...none, ctrlKey: true })).toBe(THREE.MOUSE.PAN)
    expect(assignedFor(THREE.MOUSE.DOLLY, { ...none, ctrlKey: true })).toBe(THREE.MOUSE.DOLLY)
  })
})
