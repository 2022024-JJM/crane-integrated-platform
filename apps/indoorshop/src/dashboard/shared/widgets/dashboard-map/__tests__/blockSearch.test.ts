import { describe, expect, it } from 'vitest'
import { filterBlockIndex } from '../BlockSearch'
import type { YardBackdropBlock } from '../../../model/yardMapBackdrop'

const block = (id: string, projNo: string, blkNo: string): YardBackdropBlock => ({
  id,
  projNo,
  blkNo,
  lat: 34.87,
  lon: 128.7,
  lot: null,
  lotLabel: null,
  updatedAt: null,
})

const INDEX = [
  block('5510_726_S1', '5510', '726'),
  block('5510_727', '5510', '727'),
  block('2590_194', '2590', '194'),
]

/**
 * 블록 검색 필터 — 사람이 치는 형태(`5510-726`·`5510 726`·부분)가 원문 ID(`_` 구분)와
 * 같은 것으로 걸려야 한다. 구분자 차이로 검색이 안 되면 기능이 없는 것과 같다.
 */
describe('filterBlockIndex', () => {
  it('호선·블록·하이픈/공백 표기 전부 같은 블록을 찾는다', () => {
    for (const q of ['5510-726', '5510_726', '5510 726', '726']) {
      expect(filterBlockIndex(INDEX, q).map((b) => b.id)).toContain('5510_726_S1')
    }
  })

  it('호선만 치면 그 호선의 블록들이 나온다', () => {
    expect(filterBlockIndex(INDEX, '5510')).toHaveLength(2)
  })

  it('빈 질의는 빈 결과 — 색인 전체를 쏟아내지 않는다', () => {
    expect(filterBlockIndex(INDEX, '  ')).toEqual([])
  })

  it('limit 을 넘지 않는다', () => {
    expect(filterBlockIndex(INDEX, '5510', 1)).toHaveLength(1)
  })
})
