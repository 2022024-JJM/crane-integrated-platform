import type { LatLon } from '../model/types'
import { LON_SQUEEZE } from './projection'

/**
 * 세운 것들에 **해 하나**를 비춘다.
 *
 * 지금까지 3D 는 "지붕은 밝고 옆면은 어둡다" 한 단계뿐이었다. 그러면 상자를 어느 쪽에서
 * 보든 네 벽이 같은 색이라, 기울여 세워도 종이를 접어 세운 것처럼 보인다. 부피는 **면마다
 * 밝기가 다를 때** 읽힌다 — 해를 향한 벽과 등진 벽이 갈려야 모서리가 각(角)으로 보인다.
 *
 * 그래서 빛은 **월드 좌표에 고정**한다(화면이 아니라). 카메라를 돌리면 밝던 벽이 그늘로
 * 넘어가는데, 그것이 곧 "돌고 있는 것은 건물이 아니라 나"라는 신호다. 화면 기준으로
 * 칠하면 아무리 돌려도 같은 자리가 밝아 물체가 함께 도는 것처럼 보인다.
 *
 * 값은 측정치가 아니라 **표현 상수**다(`relief.ts` 와 같은 성격). 해의 자리는 낮게 잡았다 —
 * 높이 띄우면 벽끼리 밝기 차가 줄고 그림자가 발밑에 숨는다.
 */
export const SUN = {
  /** 방위(도) — 북쪽에서 시계방향. 318°(북서)는 지도에서 관례적으로 쓰는 조명 방향이다 */
  azimuth: 318,
  /** 고도(도) — 낮을수록 벽 대비가 크고 그림자가 길다 */
  elevation: 36,
} as const

/**
 * 보조광 — 주광에서 **90° 옆**에 하나 더 건다.
 *
 * 야드의 지붕 용마루는 크게 두 방향으로 갈리고 그 둘은 서로 직각이다(안벽을 따라 선 동과
 * 그것을 가로지르는 동). 등 하나로 비추면 그 빛과 나란한 용마루를 가진 지붕은 두 면이
 * 똑같이 옆에서 빛을 받아 **한 장의 판**이 된다 — 1DOCK 도장공장의 다섯 스팬이 그랬다.
 * 방위를 어디로 옮겨도 두 방향 중 하나는 반드시 그 자리에 놓이므로, 등을 옮기는 것으로는
 * 풀리지 않고 **하나 더 걸어야** 풀린다. 90° 옆이면 주광이 놓친 쪽을 정확히 보조광이 가른다.
 *
 * 세기는 주광의 절반 남짓이다 — 같은 세기로 두면 어느 벽도 확실히 어둡지 않아 대비가
 * 뭉개진다. 고도를 낮게 잡은 것도 같은 이유다(높이 뜬 등은 수평 성분이 작아 못 가른다).
 */
export const FILL = {
  azimuth: 228,
  elevation: 30,
  /** 주광 대비 세기 */
  weight: 0.6,
} as const

const DEG = Math.PI / 180

const dirOf = (azimuth: number, elevation: number) => ({
  x: Math.cos(elevation * DEG) * Math.sin(azimuth * DEG),
  y: Math.cos(elevation * DEG) * Math.cos(azimuth * DEG),
  z: Math.sin(elevation * DEG),
})

/** 주광을 향하는 단위벡터 — (동, 북, 위). 평면은 경도를 누른 좌표계다(`LON_SQUEEZE`) */
export const SUN_DIR = dirOf(SUN.azimuth, SUN.elevation)
const FILL_DIR = dirOf(FILL.azimuth, FILL.elevation)
const TOTAL_WEIGHT = 1 + FILL.weight

/**
 * 면 하나가 빛을 얼마나 받는가 — 램버트를 **감싸서**(wrap) 쓴다.
 *
 * 순수 램버트는 해를 등진 면이 모두 0 이라, 옆벽과 뒷벽이 똑같이 새까매진다. 실제로는
 * 하늘과 지면에서 되비친 빛이 그 면을 채우므로, 내적에 `wrap` 을 더해 뒤쪽에도 기울기를
 * 남긴다. `wrap` 이 작을수록 대비가 세다.
 */
export interface LightResponse {
  /** 뒷면까지 감쌀 폭 — 0 이면 순수 램버트 */
  wrap: number
  /** 완전히 그늘진 면의 배율 */
  floor: number
  /** 정면으로 받을 때 더해지는 폭 */
  gain: number
}

/**
 * 벽 — 대비를 크게. 이 값이 상자를 상자로 만든다(해를 본 벽 1.15, 등진 벽 0.58 → 약 2배).
 */
export const WALL_LIGHT: LightResponse = { wrap: 0.75, floor: 0.5, gain: 0.85 }

/**
 * 지붕 — 벽보다 좁게 감싼다. 박공 두 면은 기울기 차가 20° 남짓이라, 벽과 같은 폭으로
 * 감싸면 두 면이 거의 같은 색이 되어 용마루가 사라진다.
 */
export const ROOF_LIGHT: LightResponse = { wrap: 0.25, floor: 0.52, gain: 0.7 }

/** 면 법선 → 밝기 배율. 1 이면 바탕색 그대로 */
export function lightOf(nx: number, ny: number, nz: number, res: LightResponse): number {
  const wrapped = (dot: number) => Math.max(0, (dot + res.wrap) / (1 + res.wrap))
  const key = wrapped(nx * SUN_DIR.x + ny * SUN_DIR.y + nz * SUN_DIR.z)
  const fill = wrapped(nx * FILL_DIR.x + ny * FILL_DIR.y + nz * FILL_DIR.z)
  return res.floor + (res.gain * (key + FILL.weight * fill)) / TOTAL_WEIGHT
}

/** 위를 보는 평지붕의 밝기 — 상수라 한 번만 잰다 */
export const FLAT_ROOF_LIGHT = lightOf(0, 0, 1, ROOF_LIGHT)

/**
 * 폴리곤이 화면이 아니라 **땅에서** 어느 쪽으로 감겼는가.
 *
 * 벽의 바깥 방향은 감김에 따라 부호가 뒤집힌다 — 발자국마다 감김이 제각각이라(지번 원본이
 * 그렇다) 한 번 재서 부호로 들고 다닌다.
 */
export function isCounterClockwise(polygon: readonly LatLon[]): boolean {
  let twice = 0
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    twice += a.lon * LON_SQUEEZE * b.lat - b.lon * LON_SQUEEZE * a.lat
  }
  return twice > 0
}

/**
 * 변 a→b 를 밑변으로 세운 벽의 **바깥 법선**(수평). 반시계 감김에서 바깥은 (dy, -dx) 다.
 * 벽은 수직이므로 z 성분은 0 — `lightOf(nx, ny, 0, ...)` 로 쓴다.
 */
export function wallNormal(
  a: LatLon,
  b: LatLon,
  ccw: boolean
): { x: number; y: number } | null {
  const dx = (b.lon - a.lon) * LON_SQUEEZE
  const dy = b.lat - a.lat
  const len = Math.hypot(dx, dy)
  if (len === 0) return null
  const s = ccw ? 1 : -1
  return { x: (s * dy) / len, y: (-s * dx) / len }
}

/** 벽 하나의 밝기 — 법선을 못 구한 변(길이 0)은 옆면 평균으로 친다 */
export function wallLightOf(a: LatLon, b: LatLon, ccw: boolean): number {
  const n = wallNormal(a, b, ccw)
  return n ? lightOf(n.x, n.y, 0, WALL_LIGHT) : lightOf(0, 0, 0, WALL_LIGHT)
}

/**
 * 내리막 방향 `down`(수평 단위벡터) 으로 `tan` 만큼 기운 지붕면의 밝기.
 *
 * 기울어진 평면의 법선은 **내리막 쪽으로** 눕는다: z = -x·tan 인 면의 법선은
 * (sin, 0, cos) 이다. `tan` 이 0 이면 평지붕이라 위를 본다.
 */
export function slopeLightOf(down: { x: number; y: number }, tan: number): number {
  const t = Math.atan(tan)
  const s = Math.sin(t)
  const c = Math.cos(t)
  return lightOf(down.x * s, down.y * s, c, ROOF_LIGHT)
}

/**
 * 발치 어둠 — 벽을 밑에서 위로 밝아지게 하는 세로 그러데이션의 **아래쪽 배율**.
 *
 * 실제 건물의 벽 아래는 지면에서 되비친 빛이 적고 이웃한 면끼리 서로를 가려(앰비언트
 * 오클루전) 어둡다. 이 한 겹이 없으면 벽이 균일한 색판이라, 아무리 면마다 밝기를 갈라도
 * 물체가 지면에 **닿아 있다**는 느낌이 나지 않는다.
 */
export const WALL_FOOT_DARKEN = 0.66

/**
 * 그림자가 지면에 눕는 방향과 길이 — 높이 `heightM` 인 점이 드리우는 자리의 위경도 차이.
 *
 * 해를 등진 쪽으로 `높이 ÷ tan(고도)` 만큼 밀면 된다. 그림자는 물체를 지면에 **못 박는**
 * 유일한 단서라, 없으면 세운 건물이 지도 위에 떠 보인다.
 */
export function shadowOffset(heightM: number): { dLat: number; dLon: number } {
  const h = Math.hypot(SUN_DIR.x, SUN_DIR.y)
  if (h === 0) return { dLat: 0, dLon: 0 }
  const reach = heightM / Math.tan(SUN.elevation * DEG) / 111_320
  return {
    dLat: (-SUN_DIR.y / h) * reach,
    dLon: (-SUN_DIR.x / h) * reach / LON_SQUEEZE,
  }
}

/** 지면에 눕는 그림자 색 — 밝은 지도에서는 옅게, 어두운 지도에서는 짙게 */
export const SHADOW_FILL = {
  dark: 'rgba(0, 0, 0, 0.42)',
  light: 'rgba(38, 42, 50, 0.20)',
} as const
