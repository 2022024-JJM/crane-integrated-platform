import { describe, expect, it } from 'vitest'
import {
  REAL_FACTORY_ID,
  REAL_LOCATION,
  REAL_LOCATION_ID,
  isRealLocation,
} from '../realScanData'
import { ASSEMBLY_FACTORIES } from '../assemblyFactoryFixture'
import { fetchFactories, fetchLocations } from '../assemblyApi'

/**
 * 실측 데이터셋의 소속 — **PBS 5BAY 에 베이 단위로** 붙는다.
 *
 * 한때 실측이 GBS 공장을 통째 차지했는데(2fad1e9), GBS 에는 5베이가 존재하지 않는다
 * (1~3뿐) — 조립 공장 중 5베이를 가진 곳은 PBS(1~8)뿐이다. 그 오배치가 되돌아오지
 * 않도록 소속과 병합 방식(같은 자리 교체)을 여기서 고정한다.
 */
describe('실측 데이터셋(PBS 5BAY)의 소속', () => {
  it('실측 정반은 PBS 의 5BAY 다 — workCntr·yardLots 는 fixture 의 5BAY 것', () => {
    expect(REAL_FACTORY_ID).toBe('asm-pbs')
    expect(REAL_LOCATION_ID).toBe('asm-pbs-b5')
    const pbsBay5 = ASSEMBLY_FACTORIES.find((f) => f.id === 'asm-pbs')?.bays.find(
      (b) => b.bayNo === 5
    )
    expect(pbsBay5).toBeDefined()
    expect(REAL_LOCATION.workCntr).toBe(pbsBay5!.code)
    expect(REAL_LOCATION.yardLots).toEqual(pbsBay5!.yardLots)
  })

  it('isRealLocation 은 그 한 정반만 참이다', () => {
    expect(isRealLocation('asm-pbs-b5')).toBe(true)
    expect(isRealLocation('asm-pbs-b4')).toBe(false)
    expect(isRealLocation('asm-gbs-b1')).toBe(false)
    expect(isRealLocation(undefined)).toBe(false)
  })

  it('공장 목록에 독립 실측 공장 카드가 없고, GBS 는 목업 공장으로 선다', async () => {
    const factories = await fetchFactories()
    expect(factories).toHaveLength(ASSEMBLY_FACTORIES.length)
    const gbs = factories.find((f) => f.id === 'asm-gbs')
    expect(gbs?.displayName).toBe('GBS')
  })

  it('PBS 정반 목록은 8면이고 5BAY 가 제자리(4 와 6 사이)에 실측으로 끼워진다', async () => {
    const locations = await fetchLocations('asm-pbs')
    expect(locations).toHaveLength(8)
    const ids = locations.map((l) => l.id)
    expect(ids.indexOf('asm-pbs-b5')).toBe(ids.indexOf('asm-pbs-b4') + 1)
    expect(ids.indexOf('asm-pbs-b6')).toBe(ids.indexOf('asm-pbs-b5') + 1)
    const bay5 = locations.find((l) => l.id === REAL_LOCATION_ID)
    expect(bay5?.name).toBe('5번 베이')
  })

  it('GBS 정반 목록은 목업 3면(G 그룹이 아니라 fixture 베이)이다', async () => {
    const locations = await fetchLocations('asm-gbs')
    expect(locations.map((l) => l.id)).toEqual(['asm-gbs-b1', 'asm-gbs-b2', 'asm-gbs-b3'])
  })
})
