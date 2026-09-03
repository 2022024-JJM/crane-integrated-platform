import { describe, expect, it } from 'vitest'
import {
  REAL_FACTORY_ID,
  REAL_LOCATION,
  REAL_LOCATION_ID,
  buildRealScanAnchor,
  isRealLocation,
  loadRealBayDimensions,
} from '../realScanData'
import { wallToBayLocal, type WallFrame } from '../../../../shared/features/bay-viewer/lib/realScanAnchor'
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

/**
 * 벽선 앵커의 게이트와 종방향 규칙 — 실측에서 나온 값을 그대로 넣어 고정한다.
 *
 * 여기 박힌 수치가 곧 "실측 홀이 5BAY 안 어디에 앉는가"의 근거다. 자산을 다시 굽거나
 * 지번 fixture 가 바뀌어 값이 달라지면 이 테스트가 먼저 깨져야 한다.
 */
describe('buildRealScanAnchor — 벽선 앵커', () => {
  /** 2025-12-20 실측 프리뷰(factory_preview.bin)에서 fitWallAxis 가 낸 값 */
  const MEASURED: WallFrame = {
    angle: (-0.984 * Math.PI) / 180,
    walls: [
      { offset: -19.11, count: 6172, residual: 0.295, coverage: 64 },
      { offset: 20.76, count: 668, residual: 0.188, coverage: 60 },
    ],
    innerWidth: 39.87, // = 20.76 - (-19.11)
    center: 0.825, //    = 두 벽면의 중간
    angleSpread: (0.033 * Math.PI) / 180,
    endWalls: [null, 65.716],
  }
  /** 도면 PBS 5BAY 껍질 OBB (지번 fixture 파생) */
  const BAY = { long: 237.68, short: 45.09 }
  /** 갠트리 그룹 대표 위치(display) — G1 이 +X 쪽(북), G3 이 -X 쪽(남) */
  const GANTRY = {
    north: [[48.28, 5.7, -8.79]] as [number, number, number][],
    south: [[-9.1, 6.14, -9.08]] as [number, number, number][],
  }

  it('실측 값으로 앵커가 서고, 북측 끝벽이 베이 북쪽 끝의 편측 여유 안쪽에 앉는다', () => {
    const built = buildRealScanAnchor(MEASURED, BAY, GANTRY)!
    expect(built).not.toBeNull()
    expect(built.widthRatio).toBeCloseTo(39.87 / 45.09, 3)
    /* 편측 여유 = (45.09 - 39.87)/2 = 2.61m — 횡·종에 같은 값을 쓴다 */
    const sideMargin = (BAY.short - MEASURED.innerWidth) / 2
    expect(built.anchor.longitudinalOffset).toBeCloseTo(BAY.long / 2 - sideMargin - 65.716, 6)
    /* 실제로 옮겨 보면: 끝벽 위의 점이 베이 북쪽 끝 - 여유 자리에 떨어진다 */
    const a = MEASURED.angle
    const onEndWall = wallToBayLocal(
      built.anchor,
      65.716 * Math.cos(a) - MEASURED.center * Math.sin(a),
      65.716 * Math.sin(a) + MEASURED.center * Math.cos(a)
    )
    expect(onEndWall.y).toBeCloseTo(BAY.long / 2 - sideMargin, 6)
    /* 벽 중심선은 베이 중심선(x=0)으로 */
    expect(onEndWall.x).toBeCloseTo(0, 6)
  })

  it('벽 중심선을 베이 폭 안에 앉힌다 — 두 벽이 ±폭/2 로 갈라진다', () => {
    const built = buildRealScanAnchor(MEASURED, BAY, GANTRY)!
    const a = MEASURED.angle
    const at = (offset: number) =>
      wallToBayLocal(built.anchor, -offset * Math.sin(a), offset * Math.cos(a)).x
    expect(at(MEASURED.walls[0].offset)).toBeCloseTo(-MEASURED.innerWidth / 2, 6)
    expect(at(MEASURED.walls[1].offset)).toBeCloseTo(MEASURED.innerWidth / 2, 6)
  })

  it('갠트리 북측이 -장축 쪽이면 프레임을 뒤집고 반대편 끝벽을 쓴다', () => {
    const flipped = buildRealScanAnchor(
      { ...MEASURED, endWalls: [-65.716, null] },
      BAY,
      { north: GANTRY.south, south: GANTRY.north }
    )!
    expect(flipped).not.toBeNull()
    expect(flipped.anchor.angle).toBeCloseTo(MEASURED.angle + Math.PI, 9)
    /* 뒤집힌 프레임에서도 끝벽은 같은 자리(북쪽 끝 - 여유)로 간다 */
    expect(flipped.anchor.longitudinalOffset).toBeCloseTo(
      BAY.long / 2 - (BAY.short - MEASURED.innerWidth) / 2 - 65.716,
      6
    )
  })

  it('내부폭이 도면 단변과 크게 어긋나면 앵커를 세우지 않는다 (게이트)', () => {
    /* 갠트리 레일 쌍을 잡은 경우 — 폭 20m, 비 0.44 */
    expect(
      buildRealScanAnchor({ ...MEASURED, innerWidth: 20, center: -5 }, BAY, GANTRY)
    ).toBeNull()
    /* 베이 밖 구조까지 물린 경우 — 폭 60m, 비 1.33 */
    expect(buildRealScanAnchor({ ...MEASURED, innerWidth: 60 }, BAY, GANTRY)).toBeNull()
  })

  it('두 벽이 평행하지 않으면 벽이 아니다 (게이트)', () => {
    expect(
      buildRealScanAnchor({ ...MEASURED, angleSpread: (3 * Math.PI) / 180 }, BAY, GANTRY)
    ).toBeNull()
  })

  it('끝벽이 없으면 종방향을 지어내지 않는다', () => {
    expect(buildRealScanAnchor({ ...MEASURED, endWalls: [null, null] }, BAY, GANTRY)).toBeNull()
  })

  it('갠트리 그룹이 비면 앞뒤를 정할 수 없어 폴백한다', () => {
    expect(buildRealScanAnchor(MEASURED, BAY, { north: [], south: GANTRY.south })).toBeNull()
  })
})

describe('loadRealBayDimensions — 도면 5BAY 치수', () => {
  it('지번 fixture 에서 237.7 × 45.1m 가 나온다 (앵커 게이트의 기준값)', async () => {
    const bay = (await loadRealBayDimensions())!
    expect(bay).not.toBeNull()
    expect(bay.long).toBeCloseTo(237.7, 0)
    expect(bay.short).toBeCloseTo(45.1, 0)
  })
})
