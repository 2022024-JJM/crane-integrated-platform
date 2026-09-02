import { describe, expect, it } from 'vitest'
import { areasByBay, blocksOfBay, outfittingFactoryByName, type BaySpanLike } from '../bayBlocks'
import { mockBlocks } from '../../api/mockOutfittingData'

/*
 * 베이 ↔ 블록 지번 연결의 계약을 못박는다.
 *
 * 베이 스팬은 지번 fixture(parcelBaysFixture)의 실데이터를 그대로 옮겨 적은 것이다 —
 * POS 1공장은 본체 구역(POS1-M)의 지번이 베이 2·3·4에 걸쳐 있어, "최대 겹침 하나에만
 * 배정"이라는 규칙이 실제로 시험되는 표본이다.
 */

/** parcelBaysFixture 의 POS 1공장 의장 베이 (BAY078~081) 발췌 */
const POS_BAYS: BaySpanLike[] = [
  { id: 'POS 1공장#1', factory: 'POS 1공장', lotCodes: ['P11B01', 'P11B02', 'P11B03', 'P11B04'] },
  { id: 'POS 1공장#2', factory: 'POS 1공장', lotCodes: ['P12B01', 'P12B02', 'P12B03'] },
  { id: 'POS 1공장#3', factory: 'POS 1공장', lotCodes: ['P11W03', 'P13B01', 'P13B02', 'P13B03'] },
  {
    id: 'POS 1공장#4',
    factory: 'POS 1공장',
    lotCodes: ['P11W04', 'P14B01', 'P14B02', 'P14B03', 'P14B04'],
  },
]

describe('areasByBay', () => {
  it('구역을 지번이 가장 많이 겹치는 베이 하나에만 배정한다', () => {
    const assigned = areasByBay(POS_BAYS)

    expect(assigned.get('POS 1공장#1')).toEqual(['P11B'])
    expect(assigned.get('POS 1공장#2')).toEqual(['P12B'])
    /* 본체(POS1-M)는 베이 2(1장)·3(2장)·4(1장)에 걸친다 — 최대 겹침인 3에만 선다 */
    expect(assigned.get('POS 1공장#3')).toEqual(['P13B', 'POS1-M'])
    expect(assigned.get('POS 1공장#4')).toEqual(['P14B'])
  })

  it('겹치는 베이가 없는 구역은 어디에도 배정하지 않는다', () => {
    const assigned = areasByBay([
      { id: 'POS 1공장#9', factory: 'POS 1공장', lotCodes: ['XXXX01'] },
    ])
    expect(assigned.size).toBe(0)
  })

  it('빈 입력이면 빈 배정을 돌려준다', () => {
    expect(areasByBay([]).size).toBe(0)
  })
})

describe('blocksOfBay', () => {
  it('배정된 구역의 그 공장 블록만 거른다', () => {
    const factory = outfittingFactoryByName('POS 1공장')
    expect(factory?.id).toBe('ofit-pos1')

    const blocks = blocksOfBay(mockBlocks, ['P13B', 'POS1-M'], 'POS 1공장')
    expect(blocks.length).toBeGreaterThan(0)
    for (const block of blocks) {
      expect(block.factoryId).toBe('ofit-pos1')
      expect(['P13B', 'POS1-M']).toContain(block.areaCode)
    }
    /* 같은 코드라도 다른 공장의 블록은 서지 않는다 */
    expect(blocksOfBay(mockBlocks, ['P13B'], '두모 선행의장 2공장').length).toBe(0)
  })

  it('배정이 없으면(미배정 베이) 빈 목록이다', () => {
    expect(blocksOfBay(mockBlocks, undefined, 'POS 1공장')).toEqual([])
    expect(blocksOfBay(mockBlocks, [], 'POS 1공장')).toEqual([])
  })
})
