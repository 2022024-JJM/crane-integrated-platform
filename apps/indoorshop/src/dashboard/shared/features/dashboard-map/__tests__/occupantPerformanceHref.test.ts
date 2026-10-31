import { describe, expect, it } from 'vitest'
import { performanceHrefOfOccupant } from '../lib/occupantViewer'
import type { BayOccupant } from '../lib/bayOccupancy'

const occupant = (patch: Partial<BayOccupant>): BayOccupant => ({
  key: '2540-281',
  projNo: '2540',
  blockNo: '281',
  zone: 'assembly',
  assys: [],
  justArrived: false,
  path: '/indoorshop/zones/assembly?factory=asm-gbs',
  ...patch,
})

/* 야드 맵 작업 카드의 실적 문 — 조립·의장·도장은 제 화면의 [실적], 그 밖은 통합실적 */
describe('performanceHrefOfOccupant', () => {
  it('조립 자리는 조립 화면의 [실적] 갈래로, 공장 드릴다운을 지키며 조건을 싣는다', () => {
    const { href, kind } = performanceHrefOfOccupant(
      occupant({ assys: [{ assyNo: 'S04', tier: 'sub' }] })
    )
    expect(kind).toBe('assembly')
    const [path, query] = href.split('?')
    expect(path).toBe('/indoorshop/zones/assembly')
    const params = new URLSearchParams(query)
    expect(params.get('factory')).toBe('asm-gbs')
    expect(params.get('view')).toBe('performance')
    expect(params.get('vessel')).toBe('2540')
    expect(params.get('block')).toBe('281')
    expect(params.get('assy')).toBe('S04')
  })

  it('의장 자리는 의장 화면의 [실적] 갈래로 — 축 탭은 떼고 블록 조건을 싣는다', () => {
    const { href, kind } = performanceHrefOfOccupant(
      occupant({ zone: 'outfitting', path: '/indoorshop/zones/outfitting/ofit-pos1/ofit-pos1-b1?block=2540-281&tab=viewer' })
    )
    expect(kind).toBe('outfitting')
    const [path, query] = href.split('?')
    expect(path).toBe('/indoorshop/zones/outfitting/ofit-pos1/ofit-pos1-b1')
    const params = new URLSearchParams(query)
    expect(params.get('view')).toBe('performance')
    expect(params.get('tab')).toBeNull()
    expect(params.get('vessel')).toBe('2540')
    expect(params.get('block')).toBe('281')
  })

  it('도장 자리는 도장 화면의 [실적] 갈래로, 공장 드릴다운을 지키며 조건을 싣는다', () => {
    const { href, kind } = performanceHrefOfOccupant(
      occupant({ zone: 'painting', path: '/indoorshop/zones/painting?factory=pnt-1dock' })
    )
    expect(kind).toBe('painting')
    const [path, query] = href.split('?')
    expect(path).toBe('/indoorshop/zones/painting')
    const params = new URLSearchParams(query)
    expect(params.get('factory')).toBe('pnt-1dock')
    expect(params.get('view')).toBe('performance')
    expect(params.get('vessel')).toBe('2540')
    expect(params.get('block')).toBe('281')
  })

  it('가공 자리는 가공 화면(실적 하나)을 같은 조건으로 연다', () => {
    const { href, kind } = performanceHrefOfOccupant(occupant({ zone: 'fabrication', path: '/indoorshop/zones/fabrication' }))
    expect(kind).toBe('fabrication')
    expect(href).toBe('/indoorshop/zones/fabrication?vessel=2540&block=281')
  })
})
