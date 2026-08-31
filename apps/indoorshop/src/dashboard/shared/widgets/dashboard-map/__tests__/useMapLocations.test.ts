import { describe, expect, it } from 'vitest'
import { latestRequestGate, locationsOf } from '../useMapLocations'

/*
 * PRD 수용 기준 12 — "빠른 공장 전환 테스트에서 늦게 도착한 이전 공장의 응답이 현재
 * 베이 목록을 덮어쓰지 않는다." 화면에서는 목록이 잠깐 다른 공장 것으로 바뀌었다가
 * 돌아오는 식으로 나타나 재현이 어렵다 — 문지기만 떼어 여기서 붙잡는다.
 */
describe('latestRequestGate — 마지막 요청만 반영', () => {
  it('마지막에 띄운 요청만 통과시킨다', () => {
    const gate = latestRequestGate()
    const first = gate.begin()
    const second = gate.begin()
    expect(gate.isCurrent(first)).toBe(false)
    expect(gate.isCurrent(second)).toBe(true)
  })

  it('요청 하나뿐이면 그것이 곧 최신이다', () => {
    const gate = latestRequestGate()
    expect(gate.isCurrent(gate.begin())).toBe(true)
  })

  it('늦게 도착한 앞 공장의 응답은 순서와 무관하게 버려진다', async () => {
    const gate = latestRequestGate()
    const applied: string[] = []

    /* 공장 A 를 띄우고(느림), 곧바로 공장 B 로 옮긴다(빠름) */
    const slow = gate.begin()
    const fast = gate.begin()
    await Promise.all([
      new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
        if (gate.isCurrent(slow)) applied.push('A')
      }),
      Promise.resolve().then(() => {
        if (gate.isCurrent(fast)) applied.push('B')
      }),
    ])

    expect(applied).toEqual(['B'])
  })

  it('문지기는 훅마다 독립이다 — 한 화면의 조회가 다른 화면을 막지 않는다', () => {
    const a = latestRequestGate()
    const b = latestRequestGate()
    const tokenA = a.begin()
    b.begin()
    expect(a.isCurrent(tokenA)).toBe(true)
  })
})

describe('locationsOf — 조회가 끝났을 때만 목록', () => {
  it('로딩·오류·매핑 없음·미제공은 빈 목록이다 — 앞 공장 목록이 남지 않게', () => {
    expect(locationsOf({ kind: 'loading' })).toEqual([])
    expect(locationsOf({ kind: 'error' })).toEqual([])
    expect(locationsOf({ kind: 'unmapped' })).toEqual([])
    expect(locationsOf({ kind: 'unsupported' })).toEqual([])
    expect(locationsOf({ kind: 'idle' })).toEqual([])
  })

  it('ready 면 그 목록을 그대로 낸다', () => {
    const locations = [
      {
        id: 'asm-pbs-b3',
        parentFacilityKey: 'PBS',
        displayName: '3번 베이',
        detailPath: '/zones/assembly/asm-pbs/asm-pbs-b3',
      },
    ]
    expect(locationsOf({ kind: 'ready', facilityPath: null, locations })).toBe(locations)
  })
})
