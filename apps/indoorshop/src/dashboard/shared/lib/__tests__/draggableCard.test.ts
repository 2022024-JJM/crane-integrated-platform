import { describe, expect, it } from 'vitest'
import {
  clampBetween,
  clampCardOffset,
  clearCardOffset,
  dragCardStorageKey,
  isZeroOffset,
  readCardOffset,
  writeCardOffset,
  ZERO_OFFSET,
  type CardOffsetStorage,
} from '../draggableCard'

/*
 * 카드 옮기기의 순수 부분 — 화면 없이 여기서 다 검증한다. jsdom 테스트
 * (`DraggableCard.test.tsx`)는 "이 계산이 실제 포인터 사건에 물려 있는가"만 본다.
 */

/** 720p 안팎의 흔한 창 — 가두기 검증의 테두리 */
const VIEWPORT = { left: 0, top: 0, right: 1280, bottom: 720 }

/** 좌상단 여백 12px 자리에 선 360×300 카드 (지도 상세 카드의 실제 치수에 가깝다) */
const CARD = { left: 12, top: 12, width: 360, height: 300 }

function fakeStorage(seed: Record<string, string> = {}): CardOffsetStorage & {
  data: Map<string, string>
} {
  const data = new Map(Object.entries(seed))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

describe('clampBetween', () => {
  it('두 끝 사이로 가둔다', () => {
    expect(clampBetween(5, 0, 10)).toBe(5)
    expect(clampBetween(-3, 0, 10)).toBe(0)
    expect(clampBetween(42, 0, 10)).toBe(10)
  })

  it('끝의 순서를 묻지 않는다 — 하한이 상한보다 커도 같은 구간으로 읽는다', () => {
    /* 카드가 창보다 클 때 실제로 이런 범위가 나온다. 순서를 따지면 값이 한쪽 끝에
       붙어 카드가 아예 안 움직인다 */
    expect(clampBetween(5, 10, 0)).toBe(5)
    expect(clampBetween(-3, 10, 0)).toBe(0)
  })
})

describe('clampCardOffset', () => {
  it('창 안에 있는 이동량은 그대로 둔다', () => {
    expect(clampCardOffset({ x: 100, y: 80 }, CARD, VIEWPORT)).toEqual({ x: 100, y: 80 })
  })

  it('왼쪽·위로 밀어내도 여백만큼은 남긴다', () => {
    /* 카드가 12px 자리에 있고 여백이 8px 이면 왼쪽으로는 4px 까지만 갈 수 있다 */
    expect(clampCardOffset({ x: -9999, y: -9999 }, CARD, VIEWPORT, 8)).toEqual({ x: -4, y: -4 })
  })

  it('오른쪽·아래로 밀어내도 카드가 창 밖으로 나가지 않는다', () => {
    const moved = clampCardOffset({ x: 9999, y: 9999 }, CARD, VIEWPORT, 8)
    /* 카드 오른쪽 끝 = 12 + 360 + x 가 1280 - 8 이 되는 지점 */
    expect(moved).toEqual({ x: 1280 - 8 - 360 - 12, y: 720 - 8 - 300 - 12 })
    expect(CARD.left + moved.x + CARD.width).toBeLessThanOrEqual(1280)
    expect(CARD.top + moved.y + CARD.height).toBeLessThanOrEqual(720)
  })

  it('여백을 0 으로 주면 가장자리에 딱 붙는다', () => {
    expect(clampCardOffset({ x: -9999, y: -9999 }, CARD, VIEWPORT, 0)).toEqual({
      x: -12,
      y: -12,
    })
  })

  it('창보다 큰 카드도 움직인다 — 다만 창을 늘 덮은 채로', () => {
    /* 세로가 창보다 긴 패널(우측 공장 목록이 길어졌을 때). 범위가 뒤집히는 경우다 */
    const tall = { left: 12, top: 12, width: 360, height: 900 }
    /* 위로 100 은 그대로 — 아직 카드가 창을 덮고 있다 */
    expect(clampCardOffset({ x: 0, y: -100 }, tall, VIEWPORT, 8).y).toBe(-100)
    /* 끝까지 밀면 카드 **아래쪽 끝**이 창 아래 여백에 걸려 선다 (위쪽이 아니라) */
    const tooFarUp = clampCardOffset({ x: 0, y: -9999 }, tall, VIEWPORT, 8)
    expect(tall.top + tooFarUp.y + tall.height).toBe(720 - 8)
    /* 반대로 끝까지 내리면 카드 **위쪽 끝**이 창 위 여백에 걸린다 */
    const tooFarDown = clampCardOffset({ x: 0, y: 9999 }, tall, VIEWPORT, 8)
    expect(tall.top + tooFarDown.y).toBe(8)
  })

  it('소수점을 남기지 않는다 — 반픽셀 transform 은 글자를 흐리게 만든다', () => {
    const moved = clampCardOffset({ x: 10.4, y: -3.7 }, CARD, VIEWPORT)
    expect(moved).toEqual({ x: 10, y: -4 })
  })
})

describe('저장', () => {
  it('키는 경로 × 카드 이름 — 같은 카드라도 화면이 다르면 자리를 따로 기억한다', () => {
    expect(dragCardStorageKey('/assembly/map', 'detail')).not.toBe(
      dragCardStorageKey('/outfitting/map', 'detail'),
    )
    expect(dragCardStorageKey('/assembly/map', 'detail')).toContain('/assembly/map')
  })

  it('적은 자리를 그대로 읽어 온다', () => {
    const storage = fakeStorage()
    const key = dragCardStorageKey('/', 'detail')
    writeCardOffset(storage, key, { x: 40, y: -20 })
    expect(readCardOffset(storage, key)).toEqual({ x: 40, y: -20 })
  })

  it('원위치는 저장하지 않는다 — 기본값을 굳이 남겨 두지 않는다', () => {
    const storage = fakeStorage()
    const key = dragCardStorageKey('/', 'detail')
    writeCardOffset(storage, key, { x: 40, y: -20 })
    writeCardOffset(storage, key, ZERO_OFFSET)
    expect(storage.data.has(key)).toBe(false)
    expect(readCardOffset(storage, key)).toBeNull()
  })

  it('되돌리기는 키를 지운다', () => {
    const storage = fakeStorage()
    const key = dragCardStorageKey('/', 'detail')
    writeCardOffset(storage, key, { x: 5, y: 5 })
    clearCardOffset(storage, key)
    expect(readCardOffset(storage, key)).toBeNull()
  })

  it('깨진 값은 없는 것으로 친다 — 카드가 사라지거나 터지지 않게', () => {
    const key = dragCardStorageKey('/', 'detail')
    expect(readCardOffset(fakeStorage({ [key]: 'not json' }), key)).toBeNull()
    expect(readCardOffset(fakeStorage({ [key]: '{"x":1}' }), key)).toBeNull()
    expect(readCardOffset(fakeStorage({ [key]: '{"x":null,"y":2}' }), key)).toBeNull()
    expect(readCardOffset(fakeStorage({ [key]: 'null' }), key)).toBeNull()
  })

  it('저장소가 없거나 막혀 있어도 조용히 넘어간다 (사생활 보호 모드)', () => {
    const blocked: CardOffsetStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readCardOffset(blocked, 'k')).toBeNull()
    expect(readCardOffset(null, 'k')).toBeNull()
    expect(() => writeCardOffset(blocked, 'k', { x: 1, y: 1 })).not.toThrow()
    expect(() => writeCardOffset(null, 'k', { x: 1, y: 1 })).not.toThrow()
  })
})

describe('isZeroOffset', () => {
  it('원위치만 참', () => {
    expect(isZeroOffset(ZERO_OFFSET)).toBe(true)
    expect(isZeroOffset({ x: 0, y: 1 })).toBe(false)
  })
})
