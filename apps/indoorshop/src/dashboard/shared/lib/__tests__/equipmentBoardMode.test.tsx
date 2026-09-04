import { beforeEach, describe, expect, it } from 'vitest'
import {
  EQUIPMENT_BOARD_MODE_DEFAULT,
  getEquipmentBoardMode,
  normalizeBoardMode,
  resetEquipmentBoardModeForTest,
  setEquipmentBoardMode,
  subscribeEquipmentBoardMode,
} from '../equipmentBoardMode'

/*
 * 보기 모드 저장 (R40).
 *
 * 이 값이 새로고침을 못 넘기면 사람은 화면을 열 때마다 같은 선택을 다시 해야 하고,
 * 그러면 설정이 아니라 그냥 버튼이다.
 */
describe('equipmentBoardMode', () => {
  beforeEach(() => {
    resetEquipmentBoardModeForTest()
  })

  it('처음에는 절반절반이다 — 두 층이 함께 일하는 것이 기본', () => {
    expect(getEquipmentBoardMode()).toBe(EQUIPMENT_BOARD_MODE_DEFAULT)
    expect(EQUIPMENT_BOARD_MODE_DEFAULT).toBe('split')
  })

  it('고른 모드가 저장된다 — 창을 닫았다 열어도 같은 자리 배분', () => {
    /* 이 환경엔 실제 localStorage 가 없다(matchTolerance 테스트와 같은 사정) —
       전역을 갈아 끼워 "무엇을 어떤 키로 저장하는가" 만 본다 */
    const store = new Map<string, string>()
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
      configurable: true,
    })

    setEquipmentBoardMode('birdview')
    expect(getEquipmentBoardMode()).toBe('birdview')
    expect(store.get('equipment-board-mode')).toBe('birdview')

    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it('스토리지가 없는 환경에서도 이번 세션은 동작한다 (이 환경이 바로 그 경우다)', () => {
    setEquipmentBoardMode('birdview')
    expect(getEquipmentBoardMode()).toBe('birdview')
  })

  it('모르는 값은 기본값으로 — 손으로 고친 저장소가 화면을 빈 칸으로 만들지 않게', () => {
    expect(normalizeBoardMode('grid-only')).toBe('split')
    expect(normalizeBoardMode(null)).toBe('split')
    expect(normalizeBoardMode(undefined)).toBe('split')
    expect(normalizeBoardMode('birdview')).toBe('birdview')
  })

  it('구독자가 바뀐 값을 받는다 — 설정과 화면이 같은 값을 본다', () => {
    let calls = 0
    const stop = subscribeEquipmentBoardMode(() => {
      calls += 1
    })
    setEquipmentBoardMode('birdview')
    expect(calls).toBe(1)
    /* 같은 값을 다시 넣으면 알리지 않는다 — 헛 렌더를 만들지 않는다 */
    setEquipmentBoardMode('birdview')
    expect(calls).toBe(1)
    stop()
    setEquipmentBoardMode('split')
    expect(calls).toBe(1)
  })
})
