import type { Location } from '../../../entities/location/model/types'
import { BAY_WIDTH, BAY_LENGTH } from './bayConfig'
import { obbFrame, type Pt2 } from './realScanAnchor'

/*
 * 공장 배치(레이아웃) 데이터 계약 (PRD FR-3).
 *
 * 베이 형상·배치는 뷰어에 하드코딩하지 않고 이 계층이 소유한다. 실제 shop/bay
 * 좌표는 현장 레이아웃 확정 후 여기(또는 실제 API 호출)로 주입하며, 그 전까지는
 * `source: 'mock'` 으로 명확히 표시된 목업 배치를 쓴다 — 운영 데이터로 간주하지 않는다.
 */

/** 베이 하나의 평면 배치 — 좌표계는 공장 바닥 평면(x: 폭, z: 길이 방향), 단위 미터 */
export interface BayLayout {
  bayId: string
  name: string
  workCntr: string
  /** 베이 바닥 중심 [x, z] */
  center: [number, number]
  /** 외곽 크기 [폭(x), 길이(z)] */
  size: [number, number]
  /** 평면 회전(도, 반시계) — 목업은 0 */
  rotationDeg: number
  /**
   * 실형상 바닥 외곽 — **베이 로컬**(중심 원점·회전 제거) [x,z] 폴리곤. 소속 지번
   * 폴리곤의 합집합 외곽(convex 껍질이 아니다 — 오목 스팬이 부풀지 않게)이며, 있으면
   * 뷰어가 바닥 판을 이 모양으로 깎는다. 목업 배치에는 없다.
   */
  footprint?: [number, number][]
  /**
   * 설비 엔티티의 LiDAR 실좌표 — 베이 로컬 [x,z]. 있으면 뷰어가 절차 배치 대신
   * 이 자리에 마커를 세운다(도면 이식값 — 개정 시 fixture 재생성으로 따라간다).
   */
  sensorPoints?: [number, number][]
}

export interface FactoryLayout {
  factoryId: string
  /**
   * 'mock': 임의 배치(운영 데이터 아님) / 'yard-fixture': painting 야드 지번·베이
   * fixture 파생 실형상(bays.js·지번 폴리곤 — 실측 지리 데이터) / 'surveyed': 현장
   * 확정 좌표(실연동 후). PRD FR-3 이 예정한 "mock 대신 실좌표 주입" 이음새다.
   */
  source: 'mock' | 'yard-fixture' | 'surveyed'
  bays: BayLayout[]
  /** 열(row) 사이 통로 폭 — 통로 관계가 보이도록 배치에 반영된다 */
  aisleWidth: number
}

/** 한 열에 세우는 최대 베이 수 — 넘으면 통로 건너 다음 열로 */
const BAYS_PER_ROW = 4
/** 같은 열 안 베이 사이 간격(폭 방향) */
const BAY_GAP = 10
/** 열 사이 통로 폭(길이 방향) */
const AISLE_WIDTH = 16

/**
 * 목업 배치 생성 — 베이를 통로를 사이에 둔 열로 세운다 (열당 4면).
 * 결정론적이며 전체가 원점 중심으로 정렬된다. 실측 좌표가 확정되면 이 함수 대신
 * 실제 조회 결과를 `FactoryLayout` 으로 매핑해 내려보낸다.
 */
export function buildMockFactoryLayout(factoryId: string, locations: Location[]): FactoryLayout {
  const rows = Math.max(1, Math.ceil(locations.length / BAYS_PER_ROW))
  const pitchX = BAY_WIDTH + BAY_GAP
  const pitchZ = BAY_LENGTH + AISLE_WIDTH

  const bays = locations.map((location, index): BayLayout => {
    const row = Math.floor(index / BAYS_PER_ROW)
    const col = index % BAYS_PER_ROW
    const colsInRow = row === rows - 1 ? locations.length - row * BAYS_PER_ROW : BAYS_PER_ROW
    const rowWidth = (colsInRow - 1) * pitchX
    return {
      bayId: location.id,
      name: location.name,
      workCntr: location.workCntr,
      center: [col * pitchX - rowWidth / 2, row * pitchZ - ((rows - 1) * pitchZ) / 2],
      size: [BAY_WIDTH, BAY_LENGTH],
      rotationDeg: 0,
    }
  })

  return { factoryId, source: 'mock', bays, aisleWidth: AISLE_WIDTH }
}

/* ── 실형상 배치 (yard-fixture) ─────────────────────────────────────── */

const METERS_PER_DEGREE = 111_320

/** 각도를 (-π/2, π/2] 로 접는다 — 축(axis)에는 앞뒤가 없다 */
const foldAxisAngle = (rad: number) => {
  let a = rad % Math.PI
  if (a > Math.PI / 2) a -= Math.PI
  if (a <= -Math.PI / 2) a += Math.PI
  return a
}

/**
 * 실형상 공장 배치 — painting 야드 fixture(베이=지번 묶음, WGS84)에서 파생한다
 * (S-(a)). 목업 격자(30×70 고정 상자)를 실제 베이 폭·길이·모양으로 바꾼다:
 *
 *  1. 각 정반(location)의 베이를 지도 fixture 에서 찾아 소속 지번 폴리곤의 **합집합
 *     외곽**(shared `outlineOf` — convex 껍질이 아니라서 오목 스팬이 부풀지 않는다.
 *     `bayOutline.test` 가 조립 23베이 전수로 정확성을 보증하는 그 로직)을 얻는다.
 *  2. WGS84 → 미터: 공장 도심 기준 등장방형(위도 cos 보정). 야드 폭(수백 m)에서
 *     왜곡은 cm 급 — 대시보드 2.5D 가 같은 근사로 건물을 세운다.
 *  3. 공장 로컬 프레임: 베이 OBB 긴 축들의 넓이 가중 평균(축 각은 π 주기라 2θ 벡터
 *     평균)을 +z(길이 방향)로, 베이 중심들의 도심을 원점으로.
 *  4. 베이별 center/size/rotation + 로컬 footprint + 설비 LiDAR 실좌표.
 *
 * fixture 에 없는 공장·베이가 하나라도 있으면 null — 호출 쪽이 목업 배치로 폴백한다
 * (반쪽 실형상은 반쪽 거짓말이다).
 *
 * `factoryName` 은 지번 fixture(`yard-parcels`)의 공장명이다 — 어느 공정 모듈의
 * 공장인지 이 빌더는 모른다. 각 공정이 제 fixture 에서 이름을 찾아 넘긴다(조립은
 * `ASSEMBLY_FACTORIES`, 의장은 `OUTFITTING_FACTORIES`). 정반 id 는 `{공장id}-b{베이번호}`
 * 규약을 따라야 베이를 찾을 수 있다.
 */
export async function buildYardFactoryLayout(
  factoryId: string,
  factoryName: string,
  locations: Location[]
): Promise<FactoryLayout | null> {
  if (!factoryName || locations.length === 0) return null

  const [{ loadYardParcels }, { outlineOf }, equipment] = await Promise.all([
    import('../../../entities/yard-parcels'),
    import('../../yard-map/lib/bayGable'),
    import('../../../entities/equipment'),
  ])
  const parcels = await loadYardParcels()
  const lotPolygon = new Map(parcels.lots.map((lot) => [lot.lot, lot.polygon]))

  /* 베이별 외곽(WGS84) — 하나라도 못 만들면 실형상 포기(위 주석) */
  const outlines: { location: Location; bayNo: number; outline: { lat: number; lon: number }[] }[] = []
  for (const location of locations) {
    const bayNo = Number(location.id.split('-b').pop())
    const bay = parcels.bays.find(
      (b) => b.factory === factoryName && b.bay === String(bayNo)
    )
    if (!bay) return null
    const polys = bay.lotCodes
      .map((code) => lotPolygon.get(code))
      .filter((poly): poly is NonNullable<typeof poly> => poly != null)
    const outline = polys.length > 0 ? outlineOf(polys) : null
    if (!outline || outline.length < 3) return null
    outlines.push({ location, bayNo, outline })
  }

  /* WGS84 → 공장 국소 미터 (동=+x, 북=+y) */
  const all = outlines.flatMap((o) => o.outline)
  const lat0 = all.reduce((s, p) => s + p.lat, 0) / all.length
  const lon0 = all.reduce((s, p) => s + p.lon, 0) / all.length
  const cosLat = Math.cos((lat0 * Math.PI) / 180)
  const toMeters = (p: { lat: number; lon: number }): Pt2 => ({
    x: (p.lon - lon0) * METERS_PER_DEGREE * cosLat,
    y: (p.lat - lat0) * METERS_PER_DEGREE,
  })

  const frames = outlines.map((o) => {
    const frame = obbFrame(o.outline.map(toMeters))
    return frame ? { ...o, frame } : null
  })
  if (frames.some((f) => f == null)) return null
  const valid = frames as NonNullable<(typeof frames)[number]>[]

  /* 공장 축 — 베이 긴 축의 넓이 가중 원형 평균(2θ), 원점 — 베이 중심 도심 */
  let sx = 0
  let sy = 0
  for (const f of valid) {
    const w = f.frame.long * f.frame.short
    const theta = Math.atan2(f.frame.axis.y, f.frame.axis.x)
    sx += Math.cos(2 * theta) * w
    sy += Math.sin(2 * theta) * w
  }
  const factoryTheta = Math.atan2(sy, sx) / 2
  const u = { x: Math.cos(factoryTheta), y: Math.sin(factoryTheta) } // 로컬 +z
  const origin = {
    x: valid.reduce((s, f) => s + f.frame.center.x, 0) / valid.length,
    y: valid.reduce((s, f) => s + f.frame.center.y, 0) / valid.length,
  }
  /* 미터(동/북) → 공장 로컬(x=u 의 왼수직, z=u) — 실측 앵커(displayToBayLocal)와 같은 규약 */
  const toLocal = (p: Pt2): Pt2 => {
    const qx = p.x - origin.x
    const qy = p.y - origin.y
    return { x: qx * -u.y + qy * u.x, y: qx * u.x + qy * u.y }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100
  const bays = valid.map((f): BayLayout => {
    const centerLocal = toLocal(f.frame.center)
    const rotation = foldAxisAngle(
      Math.atan2(f.frame.axis.y, f.frame.axis.x) - factoryTheta
    )
    /* 베이 로컬 = (로컬 - center) 를 -rotation 으로 되돌린 것 — 뷰어가 group 회전으로 되살린다 */
    const cr = Math.cos(-rotation)
    const sr = Math.sin(-rotation)
    const toBayLocal = (p: Pt2): [number, number] => {
      const local = toLocal(p)
      const dx = local.x - centerLocal.x
      const dz = local.y - centerLocal.y
      return [round2(cr * dx - sr * dz), round2(sr * dx + cr * dz)]
    }
    const sensorPoints = equipment.YARD_EQUIPMENT.filter(
      (e) =>
        e.typeId === 'LIDAR' && e.factory === factoryName && e.bay === String(f.bayNo)
    ).map((e) => toBayLocal(toMeters(e)))
    return {
      bayId: f.location.id,
      name: f.location.name,
      workCntr: f.location.workCntr,
      center: [round2(centerLocal.x), round2(centerLocal.y)],
      size: [round2(f.frame.short), round2(f.frame.long)],
      rotationDeg: round2((rotation * 180) / Math.PI),
      footprint: f.outline.map((p) => toBayLocal(toMeters(p))),
      ...(sensorPoints.length > 0 ? { sensorPoints } : {}),
    }
  })

  return { factoryId, source: 'yard-fixture', bays, aisleWidth: 0 }
}
