import type { BayAirState } from './airEffect'
import type { BayFloor, PaintingFloorPlan } from './floorPlan'
import { stationsOf, type UnitStation } from './bayStations'

/*
 * 가동 뷰가 세우는 **장면의 설계도** — 뷰어는 이것을 그리기만 한다 (R38).
 *
 * three.js 코드 안에 배치·라벨 내용이 섞이면 검증할 수 없다(WebGL 이 없는 곳에서는
 * 아예 실행되지 않는다). 그래서 "무엇이 어디에 서고 그 옆에 무슨 글자가 붙는가"는 전부
 * 여기서 정하고, 뷰어는 좌표를 계산하지 않는다 — `lib/airEffect` 가 세기를 렌더 밖에
 * 둔 것과 같은 이유다.
 *
 * 한 베이는 세 겹이다:
 *  · **바닥·구획** — 실형상 발자국(`lib/floorPlan`). 설비가 없는 베이도 선다(공장은
 *    설비가 있는 면만으로 이루어지지 않는다).
 *  · **설비** — 관례 자리(`lib/bayStations`)에 종류별 저폴리 형상으로.
 *  · **정보** — 베이 이름·환경 수치·재실 블록·가동 대수. 3D 안 라벨이 적는다.
 */

/** 이 베이에 서 있는 블록 한 장 — BTS 귀속(로스터 `mapBay`)이 근거다 */
export interface BayOccupant {
  /** `{projNo}-{blockNo}` */
  key: string
  projNo: string
  blockNo: string
  /** 갓 반입돼 스텝이 아직 안 선 블록 */
  justArrived: boolean
}

/** 장면에 서는 베이 한 면 */
export interface BaySceneItem {
  bay: string
  label: string
  center: [number, number]
  size: [number, number]
  rotationDeg: number
  footprint: [number, number][]
  /** 설비가 있는 베이만 — 없으면 대기도 없다(흐린 구획으로만 선다) */
  air: BayAirState | null
  stations: UnitStation[]
  occupants: BayOccupant[]
  /** 가동 중 / 전체 설비 대수 */
  runningCount: number
  unitCount: number
}

export interface BayScene {
  factory: string
  source: PaintingFloorPlan['source']
  items: BaySceneItem[]
  /** 설비가 선 베이 수 / 전체 베이 수 — 화면이 제가 그린 것을 말하는 계기(計器) */
  activeBays: number
  bayCount: number
  heaterCount: number
  dryerCount: number
  /** 배치에 자리가 없어 빠진 베이 — 실데이터에서는 비어 있어야 한다 */
  orphanBays: string[]
  /** 장면 전체 크기 [폭, 길이] (m) — 카메라가 처음 잡는 범위 */
  extent: [number, number]
}

/** 베이 볼륨의 높이(m) — 도장 베이는 블록이 서므로 층고가 높다 */
export const BAY_HEIGHT_M = 14

export interface BuildBaySceneInput {
  floor: PaintingFloorPlan
  air: readonly BayAirState[]
  /** 베이명 → 재실 블록 (없는 베이는 빈 배열로 친다) */
  occupants?: ReadonlyMap<string, readonly BayOccupant[]>
}

/**
 * 장면 설계도를 짠다 — 배치·자리·정보가 한 번에 정해진다.
 *
 * 베이 순서는 배치가 준 순서 그대로다(이름 순). 렌더마다 순서가 바뀌면 인스턴싱 색
 * 배열이 뒤섞이고, 무엇보다 카메라를 맞춰 둔 사람이 매번 다른 자리를 본다.
 */
export function buildBayScene({ floor, air, occupants }: BuildBaySceneInput): BayScene {
  const airByBay = new Map(air.map((state) => [state.bay, state]))
  const placed = new Set<string>()

  const items = floor.bays.map((bayFloor: BayFloor): BaySceneItem => {
    const state = airByBay.get(bayFloor.bay) ?? null
    if (state) placed.add(state.bay)
    return {
      bay: bayFloor.bay,
      label: bayFloor.label,
      center: bayFloor.center,
      size: bayFloor.size,
      rotationDeg: bayFloor.rotationDeg,
      footprint: bayFloor.footprint,
      air: state,
      stations: state ? stationsOf(state.units, bayFloor.size) : [],
      occupants: [...(occupants?.get(bayFloor.bay) ?? [])],
      runningCount: state ? state.runningCount : 0,
      unitCount: state ? state.units.length : 0,
    }
  })

  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const item of items) {
    const rad = (item.rotationDeg * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    for (const [fx, fz] of item.footprint) {
      const x = item.center[0] + fx * cos - fz * sin
      const z = item.center[1] + fx * sin + fz * cos
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }
  }

  return {
    factory: floor.factory,
    source: floor.source,
    items,
    activeBays: items.filter((item) => item.air).length,
    bayCount: items.length,
    heaterCount: items.reduce(
      (sum, item) => sum + item.stations.filter((s) => s.kind === '가스히터').length,
      0
    ),
    dryerCount: items.reduce(
      (sum, item) => sum + item.stations.filter((s) => s.kind === '제습기').length,
      0
    ),
    orphanBays: air.filter((state) => !placed.has(state.bay)).map((state) => state.bay),
    extent:
      minX === Infinity ? [0, 0] : [Math.round(maxX - minX), Math.round(maxZ - minZ)],
  }
}

/**
 * 이 장면이 요구하는 **그리기 콜(draw call) 어림수.**
 *
 * P0 에서 잠근 성능 계약("draw call 폭증 금지")을 테스트가 붙들 수 있게 수식으로 적는다.
 * 뷰어의 실제 구성과 1:1 이다:
 *  · 바닥판·구획선·벽 골조 — 베이마다 따로 그리지 않고 **하나로 합쳐** 3콜
 *  · 설비 — 종류마다 InstancedMesh 하나씩 2콜 (대수와 무관)
 *  · 헤이즈 — 베이마다 투명도가 달라 합칠 수 없다(설비가 선 베이만)
 *  · 파티클 — 가동 중인 베이만, 열·기류 각 1콜
 */
export function estimateDrawCalls(scene: BayScene): number {
  const statics = 3
  const instanced = (scene.heaterCount > 0 ? 1 : 0) + (scene.dryerCount > 0 ? 1 : 0)
  const haze = scene.activeBays
  /* 파티클 버퍼는 **설비가 있으면** 잡아 둔다(가동 여부로 씬을 다시 세우지 않기 위해).
   * 그리는 개수는 예산이 정하고, 0이면 보이지 않게 두므로 이 값은 상한이다. */
  const particles = scene.items.reduce((sum, item) => {
    if (!item.air) return sum
    const heat = item.stations.some((s) => s.kind === '가스히터') ? 1 : 0
    const dry = item.stations.some((s) => s.kind === '제습기') ? 1 : 0
    return sum + heat + dry
  }, 0)
  return statics + instanced + haze + particles
}
