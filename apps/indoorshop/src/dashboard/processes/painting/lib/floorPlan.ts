import { loadYardParcels, type LatLon } from '../../../shared/entities/yard-parcels'
import { obbFrame, type Pt2 } from '../../../shared/features/bay-viewer/lib/realScanAnchor'

/*
 * 도장 공장의 **바닥 배치** — 가동 뷰가 세우는 베이의 실형상 (R38).
 *
 * 지금까지 가동 뷰는 베이 상자를 **설비 좌표의 외접 상자**로 만들었다. 그런데 도장 설비
 * 좌표는 베이 안 한 구석에 몰려 있다 — 1DOCK B1 베이는 실제로 58×56m 인데 그 안의
 * 제습기·히터 두 대는 8m 남짓 안에 붙어 서 있다. 그 외접 상자를 베이로 삼으면 화면에
 * 서는 것은 베이가 아니라 **설비 두 대를 감싼 작은 큐브**다. 큐브만 늘어선 화면이 나온
 * 이유가 그것이다.
 *
 * 베이의 정본은 야드 지번 fixture 다(`shared/entities/yard-parcels` — painting `bays.js`
 * 에서 생성). 거기엔 도장 5개 공장의 베이 60면이 **실제 껍질(WGS84)** 로 들어 있고,
 * 설비가 있는 32면은 전부 그 표에 있다. 그래서 이 파일은 좌표를 지어내지 않는다 —
 * 실측 껍질을 공장 로컬 미터로 옮기기만 한다.
 *
 * 프레임 규약은 조립 공장 뷰(`shared/features/bay-viewer/lib/bayLayout`)와 같다:
 *  · 베이 OBB 긴 축들의 넓이 가중 평균(축 각은 π 주기라 2θ 벡터 평균)을 +z 로,
 *  · 베이 중심들의 도심을 원점으로,
 *  · 베이 로컬은 중심 원점·회전 제거(뷰어가 group 회전으로 되살린다).
 * 세 공정의 3D 가 같은 프레임 규약을 쓰면 화면을 옮길 때 눈이 다시 배우지 않는다.
 *
 * ⚠️ 이 파일은 **fixture 를 읽기만** 한다(조립 `buildYardFactoryLayout` 을 그대로 쓸 수
 *    없는 이유는 그쪽이 정반 id `{공장id}-b{숫자}` 에서 베이 번호를 캐기 때문이다 —
 *    도장 베이명은 `B10`·`NP2`·`D2` 처럼 숫자가 아니다). 계산 규칙은 같게 유지한다.
 */

/** 베이 하나의 바닥 — 공장 로컬 미터, x=폭 방향 / z=공장 길이 방향 */
export interface BayFloor {
  /** 베이명 — 공장 안에서만 유일 */
  bay: string
  /** 화면에 쓰는 이름 (예: `B3BAY`) */
  label: string
  /** 베이 바닥 중심 [x, z] */
  center: [number, number]
  /** 외곽 크기 [폭(x), 길이(z)] */
  size: [number, number]
  /** 평면 회전(도) — 공장 축 대비 */
  rotationDeg: number
  /** 실형상 바닥 외곽 — **베이 로컬**(중심 원점·회전 제거) [x, z] */
  footprint: [number, number][]
}

export interface PaintingFloorPlan {
  factory: string
  /** 'yard-fixture': 지번 fixture 실형상 / 'grid': fixture 에 없어 만든 격자 갈음 */
  source: 'yard-fixture' | 'grid'
  bays: BayFloor[]
}

/** fixture 한 줄 — 이 계산이 필요로 하는 최소한 */
export interface BayHullInput {
  bay: string
  label: string
  hull: readonly LatLon[]
}

const METERS_PER_DEGREE = 111_320

/** 각도를 (-π/2, π/2] 로 접는다 — 축(axis)에는 앞뒤가 없다 */
function foldAxisAngle(rad: number): number {
  let a = rad % Math.PI
  if (a > Math.PI / 2) a -= Math.PI
  if (a <= -Math.PI / 2) a += Math.PI
  return a
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * 실형상 바닥 배치 — 베이 껍질(WGS84) 묶음을 공장 로컬 미터로 옮긴다.
 *
 * 순수 함수다(망·fixture 접근 없음) — 배치 규칙을 테스트로 잠글 수 있는 이유이며,
 * 뷰어가 좌표를 하드코딩하지 않는 이유이기도 하다.
 *
 * 껍질이 3점 미만이거나 OBB 를 못 세우는 베이는 **빠진다**. 하나도 남지 않으면 null —
 * 호출 쪽이 격자 갈음(`gridFloorPlan`)으로 내려간다(반쪽 실형상은 반쪽 거짓말이다).
 */
export function floorPlanFromHulls(
  factory: string,
  hulls: readonly BayHullInput[]
): PaintingFloorPlan | null {
  const usable = hulls.filter((h) => h.hull.length >= 3)
  if (usable.length === 0) return null

  /* WGS84 → 공장 국소 미터 (동=+x, 북=+y). 야드 폭(수백 m)에서 등장방형 왜곡은 cm 급 */
  const all = usable.flatMap((h) => h.hull)
  const lat0 = all.reduce((s, p) => s + p.lat, 0) / all.length
  const lon0 = all.reduce((s, p) => s + p.lon, 0) / all.length
  const cosLat = Math.cos((lat0 * Math.PI) / 180)
  const toMeters = (p: LatLon): Pt2 => ({
    x: (p.lon - lon0) * METERS_PER_DEGREE * cosLat,
    y: (p.lat - lat0) * METERS_PER_DEGREE,
  })

  const framed = usable
    .map((h) => {
      const frame = obbFrame(h.hull.map(toMeters))
      return frame ? { ...h, frame } : null
    })
    .filter((f): f is NonNullable<typeof f> => f != null)
  if (framed.length === 0) return null

  /* 공장 축 — 베이 긴 축의 넓이 가중 원형 평균(2θ) */
  let sx = 0
  let sy = 0
  for (const f of framed) {
    const w = f.frame.long * f.frame.short
    const theta = Math.atan2(f.frame.axis.y, f.frame.axis.x)
    sx += Math.cos(2 * theta) * w
    sy += Math.sin(2 * theta) * w
  }
  const factoryTheta = Math.atan2(sy, sx) / 2
  const u = { x: Math.cos(factoryTheta), y: Math.sin(factoryTheta) } // 로컬 +z
  const origin = {
    x: framed.reduce((s, f) => s + f.frame.center.x, 0) / framed.length,
    y: framed.reduce((s, f) => s + f.frame.center.y, 0) / framed.length,
  }
  /* 미터(동/북) → 공장 로컬(x = u 의 왼수직, z = u) — 조립 공장 뷰와 같은 규약 */
  const toLocal = (p: Pt2): Pt2 => {
    const qx = p.x - origin.x
    const qy = p.y - origin.y
    return { x: qx * -u.y + qy * u.x, y: qx * u.x + qy * u.y }
  }

  const bays = framed.map((f): BayFloor => {
    const centerLocal = toLocal(f.frame.center)
    const rotation = foldAxisAngle(Math.atan2(f.frame.axis.y, f.frame.axis.x) - factoryTheta)
    const cr = Math.cos(-rotation)
    const sr = Math.sin(-rotation)
    const toBayLocal = (p: LatLon): [number, number] => {
      const local = toLocal(toMeters(p))
      const dx = local.x - centerLocal.x
      const dz = local.y - centerLocal.y
      return [round2(cr * dx - sr * dz), round2(sr * dx + cr * dz)]
    }
    return {
      bay: f.bay,
      label: f.label,
      center: [round2(centerLocal.x), round2(centerLocal.y)],
      size: [round2(f.frame.short), round2(f.frame.long)],
      rotationDeg: round2((rotation * 180) / Math.PI),
      footprint: f.hull.map(toBayLocal),
    }
  })

  /* 베이 순서는 이름 순(숫자 섞임 고려) — 폴링마다 순서가 바뀌면 카메라를 맞춰 둔
   * 사람이 매번 다른 자리를 보게 된다 (`bayAirStatesOf` 와 같은 이유·같은 규칙) */
  bays.sort((a, b) => a.bay.localeCompare(b.bay, undefined, { numeric: true }))
  return { factory, source: 'yard-fixture', bays }
}

/** 격자 갈음의 베이 한 면 크기(m) — 도장 베이 실측 중앙값(약 58×55)에 맞춘 값 */
export const GRID_BAY_SIZE: readonly [number, number] = [56, 56]
/** 격자 갈음의 베이 사이 통로(m) */
export const GRID_BAY_GAP = 12

/**
 * 격자 갈음 배치 — fixture 에 그 공장·베이가 없을 때만 쓴다.
 *
 * 실형상이 아니라는 사실은 `source: 'grid'` 로 남는다(화면이 그 말을 해야 한다).
 * 열 수는 √n — 가로세로가 엇비슷해져 화면을 고르게 쓴다.
 */
export function gridFloorPlan(factory: string, bays: readonly string[]): PaintingFloorPlan {
  const names = [...bays].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const columns = Math.max(1, Math.ceil(Math.sqrt(names.length)))
  const rows = Math.max(1, Math.ceil(names.length / columns))
  const [w, l] = GRID_BAY_SIZE
  const pitchX = w + GRID_BAY_GAP
  const pitchZ = l + GRID_BAY_GAP
  return {
    factory,
    source: 'grid',
    bays: names.map((bay, index): BayFloor => {
      const col = index % columns
      const row = Math.floor(index / columns)
      const center: [number, number] = [
        col * pitchX - ((columns - 1) * pitchX) / 2,
        row * pitchZ - ((rows - 1) * pitchZ) / 2,
      ]
      return {
        bay,
        label: `${bay}BAY`,
        center,
        size: [w, l],
        rotationDeg: 0,
        footprint: [
          [-w / 2, -l / 2],
          [w / 2, -l / 2],
          [w / 2, l / 2],
          [-w / 2, l / 2],
        ],
      }
    }),
  }
}

/**
 * 공장 한 곳의 바닥 배치 — fixture 를 읽어 실형상을, 없으면 격자를 낸다.
 *
 * `bays` 는 **설비가 서 있는 베이**다. fixture 에는 그 밖의 베이도 있고(설비가 아직 안
 * 붙은 면), 그것도 함께 낸다 — 공장은 설비가 있는 면만으로 이루어지지 않는다. 화면은
 * 그런 면을 흐린 구획으로 세워 "여기 베이가 있고 설비가 없다"를 말한다.
 *
 * 지번 fixture 는 무겁다(550건 폴리곤) — 그래서 dynamic import 인 `loadYardParcels` 를
 * 쓰고, 공장별 결과를 캐시한다(탭을 오갈 때마다 다시 계산하지 않는다).
 */
const planCache = new Map<string, Promise<PaintingFloorPlan>>()

export function loadPaintingFloorPlan(
  factory: string,
  equipmentBays: readonly string[]
): Promise<PaintingFloorPlan> {
  const key = `${factory}::${[...equipmentBays].sort().join(',')}`
  const cached = planCache.get(key)
  if (cached) return cached
  const promise = loadYardParcels()
    .then((parcels) => {
      const hulls = parcels.bays
        .filter((b) => b.factory === factory)
        .map((b) => ({ bay: b.bay, label: b.label, hull: b.hull }))
      const known = new Set(hulls.map((h) => h.bay))
      /* fixture 가 모르는 설비 베이가 있으면 실형상을 포기한다 — 그 베이만 빠진
       * 반쪽 배치는 "이 공장엔 그 베이가 없다"는 거짓말이 된다 */
      if (hulls.length === 0 || equipmentBays.some((bay) => !known.has(bay))) {
        return gridFloorPlan(factory, equipmentBays)
      }
      return floorPlanFromHulls(factory, hulls) ?? gridFloorPlan(factory, equipmentBays)
    })
    .catch(() => gridFloorPlan(factory, equipmentBays))
  planCache.set(key, promise)
  return promise
}
