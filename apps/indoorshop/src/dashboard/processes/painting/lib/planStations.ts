import type { LatLon } from '../../../shared/entities/yard-parcels'
import type { AirUnit } from './airEffect'
import { stationsOf } from './bayStations'
import type { BayFloor, PaintingFloorPlan } from './floorPlan'

/*
 * ── 도면(2D)과 가동 뷰(3D)가 **같은 자리에** 설비를 세운다 (R45) ──
 *
 * 두 그림이 서로 다른 규칙으로 설비를 놓고 있었다:
 *
 *   2D 배치도 — 공용 청사진 배치(`equipment-birdview/lib/blueprint`). 베이 안에 종류별로
 *               줄을 세워 균등 배분한다. 조립처럼 한 베이에 라이다 수십 대가 늘어선
 *               공장을 위한 규칙이다.
 *   3D 가동 뷰 — 도장의 관례 자리(`lib/bayStations`). 히터는 긴 벽을 좌우 번갈아, 제습기는
 *               코너부터. 도장 베이에서 실제로 그렇게 선다.
 *
 * 그래서 같은 EQ039 가 도면에서는 베이 가운데 줄에, 3D 에서는 코너에 섰다. 두 그림을
 * 나란히 두고 "저 대가 어디 있나"를 묻는 화면에서 이것은 **틀린 그림**이다 — 한쪽은
 * 반드시 거짓말을 하고 있고, 어느 쪽인지 화면은 말해 주지 않는다.
 *
 * 정본은 **도장의 관례 자리**다. 3D 는 실제 베이 크기(58×56m) 위에 그 규칙을 세우고,
 * 히터가 벽을 타고 분다는 사실이 그 그림의 내용이기 때문이다. 그러니 도면이 그쪽으로
 * 맞춘다 — 이 파일이 그 다리다: **베이 로컬 미터 → 도면 화면 좌표**.
 *
 * ── 변환을 어떻게 구하는가 ──
 * 두 좌표계 사이의 관계를 손으로 유도하지 않는다(축의 부호가 뒤집히는 자리가 셋이나
 * 되고, 그중 하나만 틀려도 좌우가 거울이 된 채 조용히 그려진다 — 실제로 이 레포에서
 * 그런 사고가 두 번 있었다). 대신 **이미 짝지어진 점들**로 맞춘다: 베이 껍질의 꼭짓점은
 * 두 좌표계에 같은 순서로 들어 있으므로(`floorPlanFromHulls` 가 `hull.map(toBayLocal)`
 * 로 만든다), 그 짝에 닮음변환(회전·확대·거울)을 최소제곱으로 맞추면 된다.
 *
 * 거울을 함께 시험하는 이유: 도면 평면은 화면과 같은 방향(y = -lat)이고 베이 로컬은
 * 미터(y = +north)라, 둘 사이에는 늘 거울이 한 겹 끼어 있다. 거울 없는 닮음만 맞추면
 * 아무리 잘 맞춰도 잔차가 크게 남는다 — 둘 다 맞춰 보고 잘 맞는 쪽을 고른다.
 */

export interface Pt {
  x: number
  y: number
}

/** 베이 로컬(미터) → 도면(화면) 닮음변환 한 벌 */
export interface LocalToScreen {
  (point: { x: number; z: number }): Pt
}

/** 최소제곱 잔차와 함께 — 잘 맞는 쪽을 고르기 위해 */
interface Fit {
  apply: LocalToScreen
  residual: number
}

/** 거울 여부를 정해 놓고 닮음변환을 맞춘다 (회전 + 확대 + 평행이동) */
function fitSimilarity(local: readonly Pt[], screen: readonly Pt[], mirror: boolean): Fit | null {
  const n = Math.min(local.length, screen.length)
  if (n < 2) return null
  const src = local.slice(0, n).map((p) => ({ x: p.x, y: mirror ? -p.y : p.y }))
  const dst = screen.slice(0, n)

  const mean = (points: readonly Pt[]) => ({
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  })
  const cs = mean(src)
  const cd = mean(dst)

  let num1 = 0 // Σ(s·d)
  let num2 = 0 // Σ(s×d)
  let den = 0 // Σ|s|²
  for (let i = 0; i < n; i += 1) {
    const sx = src[i].x - cs.x
    const sy = src[i].y - cs.y
    const dx = dst[i].x - cd.x
    const dy = dst[i].y - cd.y
    num1 += sx * dx + sy * dy
    num2 += sx * dy - sy * dx
    den += sx * sx + sy * sy
  }
  if (den < 1e-9) return null
  const a = num1 / den
  const b = num2 / den

  const apply: LocalToScreen = (point) => {
    const x = point.x - cs.x
    const y = (mirror ? -point.z : point.z) - cs.y
    return { x: cd.x + a * x - b * y, y: cd.y + b * x + a * y }
  }

  let residual = 0
  for (let i = 0; i < n; i += 1) {
    const got = apply({ x: local[i].x, z: local[i].y })
    residual += (got.x - dst[i].x) ** 2 + (got.y - dst[i].y) ** 2
  }
  return { apply, residual: Math.sqrt(residual / n) }
}

/**
 * 베이 하나의 **로컬 → 화면** 변환.
 *
 * `localHull` 과 `screenHull` 은 **같은 꼭짓점을 같은 순서로** 담은 두 좌표계의 표현이다.
 * 거울 있는 쪽과 없는 쪽을 둘 다 맞춰 보고 잔차가 작은 쪽을 고른다.
 */
export function bayLocalToScreen(
  localHull: readonly (readonly [number, number])[],
  screenHull: readonly Pt[]
): LocalToScreen | null {
  const local = localHull.map(([x, z]) => ({ x, y: z }))
  const straight = fitSimilarity(local, screenHull, false)
  const mirrored = fitSimilarity(local, screenHull, true)
  if (!straight) return mirrored?.apply ?? null
  if (!mirrored) return straight.apply
  return (mirrored.residual < straight.residual ? mirrored : straight).apply
}

/** 도면에 설비를 놓기 위해 필요한 것 — 베이 껍질(투영본)과 그 베이의 설비 */
export interface PlanStationInput {
  /** 도면이 그린 베이 껍질 — `groupKey` 는 베이명과 같은 어휘다 */
  bays: readonly { groupKey: string; points: readonly Pt[] }[]
  /** 실형상 바닥 배치 — 베이 로컬 껍질과 크기의 출처 */
  floor: PaintingFloorPlan | null
  /** 베이명 → 그 베이의 설비 (3D 가 쓰는 것과 같은 목록·같은 순서) */
  unitsByBay: ReadonlyMap<string, readonly AirUnit[]>
}

/**
 * 설비ID → **도면 위 자리**.
 *
 * 3D 와 같은 규칙(`stationsOf`)으로 베이 로컬 자리를 구한 뒤, 그 베이의 변환으로 화면
 * 좌표로 옮긴다. 실형상 배치가 없으면(격자 갈음이거나 fixture 미보유) 빈 표를 낸다 —
 * 그때는 도면이 지금까지처럼 공용 청사진 배치로 그린다(반쯤 맞춘 자리보다 낫다).
 */
export function planStationPositions({ bays, floor, unitsByBay }: PlanStationInput): Map<string, Pt> {
  const placed = new Map<string, Pt>()
  if (!floor || floor.source !== 'yard-fixture') return placed

  const screenOf = new Map(bays.map((bay) => [bay.groupKey, bay.points]))
  for (const bayFloor of floor.bays as readonly BayFloor[]) {
    const screenHull = screenOf.get(bayFloor.bay)
    const units = unitsByBay.get(bayFloor.bay)
    if (!screenHull || !units || units.length === 0) continue
    const toScreen = bayLocalToScreen(bayFloor.footprint, screenHull)
    if (!toScreen) continue
    for (const station of stationsOf(units, bayFloor.size)) {
      placed.set(station.id, toScreen({ x: station.x, z: station.z }))
    }
  }
  return placed
}

/** fixture 껍질 한 줄 — 이 계산이 요구하는 최소한 (테스트가 쓰는 형태) */
export interface HullInput {
  bay: string
  hull: readonly LatLon[]
}
