import { describe, expect, it } from 'vitest'
import type { Location } from '../../../../shared/entities/location/model/types'
import {
  ASSEMBLY_FACTORY_ID_BY_MAP_KEY,
  fetchAssemblyMapLocations,
  toMapLocation,
} from '../mapDrilldown'

/*
 * 조립 어댑터 — `docs/PRD_전체현황_공정존_베이_드릴다운_개선.md` FR-4 의 변환 표와
 * §11 단위 테스트 요구(매핑 성공/실패, 선택적 필드·yardLots 변환)를 붙잡는다.
 *
 * 여기가 어긋나면 지도에서 고른 공장이 엉뚱한 공장의 정반을 보여 주거나(매핑), 정반을
 * 눌렀을 때 없는 화면으로 들어간다(경로). 둘 다 화면만 봐서는 늦게 발견된다.
 */

const bay = (over: Partial<Location> = {}): Location => ({
  id: 'asm-pbs-b3',
  factoryId: 'asm-pbs',
  name: '3번 베이',
  status: 'occupied',
  workCntr: 'PB3B',
  ...over,
})

describe('ASSEMBLY_FACTORY_ID_BY_MAP_KEY — 지도 공장 키 → 조립 공장 ID 매핑', () => {
  it('지도 공장 이름으로 조립 공장 id 를 찾는다', () => {
    expect(ASSEMBLY_FACTORY_ID_BY_MAP_KEY['PBS']).toBe('asm-pbs')
    /* 2026-09 원본 개편에서 해양제작1공장 → 조립4공장-OFD1 로 개명(데이터 정본 추종) */
    expect(ASSEMBLY_FACTORY_ID_BY_MAP_KEY['조립4공장-OFD1']).toBe('asm-of1')
  })

  it('조립이 아닌 공장은 매핑에 없다 — 공장 이름을 그대로 넘기지 않는 이유', async () => {
    expect(ASSEMBLY_FACTORY_ID_BY_MAP_KEY['1DOCK 도장공장']).toBeUndefined()
    await expect(fetchAssemblyMapLocations('1DOCK 도장공장')).resolves.toEqual({
      kind: 'unmapped',
    })
  })
})

describe('toMapLocation — 조립 Location → 공통 작업 위치 (FR-4 변환 표)', () => {
  it('이름·정반코드·상태·지번·상세 경로를 규칙대로 옮긴다', () => {
    expect(toMapLocation(bay({ yardLots: ['PB3B01'] }), 'PBS')).toEqual({
      id: 'asm-pbs-b3',
      parentFacilityKey: 'PBS',
      displayName: '3번 베이',
      locationCode: 'PB3B',
      statusLabelKey: 'location.status.occupied',
      yardLotCodes: ['PB3B01'],
      detailPath: '/zones/assembly/asm-pbs/asm-pbs-b3',
    })
  })

  it('지번이 없거나 빈 배열이면 지도 연결 키를 만들지 않는다 — 자리 없는 칸이 생기지 않게', () => {
    expect(toMapLocation(bay(), 'PBS').yardLotCodes).toBeUndefined()
    expect(toMapLocation(bay({ yardLots: [] }), 'PBS').yardLotCodes).toBeUndefined()
  })

  it('정반코드가 빈 문자열이면 코드 없음으로 다룬다 — 빈 칩을 만들지 않는다', () => {
    expect(toMapLocation(bay({ workCntr: '' }), 'PBS').locationCode).toBeUndefined()
  })

  it('상태는 기존 enum 의 번역 키로만 옮긴다 — 새 건강 색·위험 판단을 만들지 않는다', () => {
    expect(toMapLocation(bay({ status: 'empty' }), 'PBS').statusLabelKey).toBe(
      'location.status.empty'
    )
    expect(toMapLocation(bay({ status: 'unknown' }), 'PBS').statusLabelKey).toBe(
      'location.status.unknown'
    )
  })

  it('지번 배열을 복사해 내보낸다 — 원본 fixture 가 화면에서 바뀌지 않게', () => {
    const source = bay({ yardLots: ['PB3B01'] })
    const mapped = toMapLocation(source, 'PBS')
    expect(mapped.yardLotCodes).not.toBe(source.yardLots)
  })
})

describe('fetchAssemblyMapLocations — 지도 공장 하나의 베이(정반) 목록', () => {
  it('조립 1공장(PBS)의 8개 베이를 현장 Layout 순서대로 낸다', async () => {
    const result = await fetchAssemblyMapLocations('PBS')
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.locations.map((location) => location.locationCode)).toEqual([
      'PB1B',
      'PB2B',
      'PB3B',
      'PB4B',
      'PB5B',
      'PB6B',
      'PB7B',
      'PB8B',
    ])
  })

  it('공장 현황 경로를 함께 낸다 — 대시보드가 URL 을 조합하지 않도록 (FR-3)', async () => {
    const result = await fetchAssemblyMapLocations('PBS')
    expect(result.kind === 'ok' && result.facilityPath).toBe('/zones/assembly/asm-pbs')
  })

  it('모든 위치가 부모 공장 키와 자기 상세 경로를 들고 온다', async () => {
    const result = await fetchAssemblyMapLocations('NPS')
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    for (const location of result.locations) {
      expect(location.parentFacilityKey).toBe('NPS')
      expect(location.detailPath).toBe(`/zones/assembly/asm-nps/${location.id}`)
    }
  })
})
