import type { LatLonBounds } from '../../../entities/yard/model/types'

/**
 * 위경도 ↔ 화면 좌표.
 *
 * 야드는 남북 약 4km 다 — 이 크기에서는 웹 메르카토르를 쓸 이유가 없다. 위도를 그대로
 * 세로축으로 쓰고 **경도만 cos(위도) 로 눌러** 주면 가로세로 비율이 맞고, 4km 구간에서
 * 생기는 오차는 센티미터 수준이라 지번 사각형이 틀어지지 않는다.
 *
 * 뷰는 **중심(위경도) + 배율(px/도) + 카메라 자세(기울기·방위)** 로만 들고 있다 —
 * 화면 크기가 바뀌어도 보고 있던 자리가 유지되고, 확대/축소·투영 계산이 한 곳에 모인다.
 *
 * 2D(기울기 0)와 3D(기울기 > 0)는 **같은 함수**를 쓴다. 그리는 쪽이 두 벌의 좌표계를
 * 들고 있으면 히트 테스트·라벨·칩이 저마다 다른 계산을 하게 되고, 한쪽만 고치는 버그가
 * 반드시 생긴다. 여기서 한 번만 갈라 두면 나머지 코드는 기울기를 몰라도 된다.
 */
export interface YardView {
  centerLat: number
  centerLon: number
  /** 배율 — 위도 1도당 픽셀 수 (기울기 0에서의 값) */
  scale: number
  /** 카메라 기울기(도). 0이면 바로 위에서 내려다본 평면 = 2D */
  pitch: number
  /** 카메라 방위(도, 시계방향). 0이면 북쪽이 화면 위 */
  bearing: number
}

/** 맵을 어떤 눈으로 보는가 — 버튼 하나가 정하는 값이라 문자열로 둔다 */
export type YardViewMode = '2d' | '3d'

export interface Viewport {
  width: number
  height: number
}

export interface ScreenPoint {
  sx: number
  sy: number
}

export interface ProjectedPoint extends ScreenPoint {
  /** 카메라로부터의 깊이(px) — 클수록 멀다. 겹치는 입체를 뒤에서부터 그릴 때 쓴다 */
  depth: number
  /** 지평선 위(= 땅이 없는 방향)라 화면 좌표에 뜻이 없는 점 */
  behind: boolean
}

/** 옥포 위도(약 34.87°)에서의 경도 압축률 — 야드 안에서는 상수로 봐도 된다 */
export const LON_SQUEEZE = Math.cos((34.87 * Math.PI) / 180)

/** 위도 1도 ≈ 111.32km — 축척 표시와 높이(m) 환산에 쓴다 */
const METERS_PER_LAT_DEGREE = 111320

const DEG = Math.PI / 180

/*
 * 카메라를 화면 높이의 몇 배 뒤에 둘 것인가 — 원근의 세기를 정하는 유일한 값이다.
 * 1.5배는 화각 약 37°로, 야드 전체를 담아도 가까운 쪽이 과장돼 보이지 않는 정도다.
 * 이 값이면 기울기 71° 까지 지평선이 화면 안으로 들어오지 않는다(MAX_PITCH 참조).
 */
const CAMERA_DISTANCE_FACTOR = 1.5

/** 기울기 상한 — 이보다 눕히면 먼 쪽이 한 줄로 뭉쳐 야드를 읽을 수 없다 */
export const MAX_PITCH = 62
/** 3D 로 바꿨을 때의 기울기 — 높이가 보이면서 배치도 아직 읽히는 자리 */
export const TILTED_PITCH = 52
/** 3D 안에서 손으로 세울 수 있는 하한 — 여기서 더 세우면 2D 와 구별되지 않는다 */
export const MIN_TILTED_PITCH = 12

export function clampPitch(pitch: number): number {
  return Math.min(MAX_PITCH, Math.max(0, pitch))
}

/** 방위는 한 바퀴를 돌면 제자리다 — 값이 무한히 커지지 않도록 접는다 */
export function wrapBearing(bearing: number): number {
  const wrapped = bearing % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/** 카메라와 화면 중심 사이의 거리(px) */
function cameraDistance(viewport: Viewport): number {
  return Math.max(240, viewport.height) * CAMERA_DISTANCE_FACTOR
}

/** 중심에서의 평면 오프셋(px) — 방위까지만 반영한 값(기울기 전) */
function flatOffset(view: YardView, lat: number, lon: number): { fx: number; fy: number } {
  const ex = (lon - view.centerLon) * LON_SQUEEZE * view.scale
  const ey = -(lat - view.centerLat) * view.scale
  if (!view.bearing) return { fx: ex, fy: ey }
  const b = view.bearing * DEG
  const cosB = Math.cos(b)
  const sinB = Math.sin(b)
  return { fx: ex * cosB + ey * sinB, fy: -ex * sinB + ey * cosB }
}

/**
 * 위경도(+ 고도)를 화면으로.
 *
 * `altitude` 는 미터다 — 지면에서 얼마나 띄울지. 2D 에서는 무시한다: 평면은 원근이
 * 없어야 **배율이 곧 축척**이 되고, 축척 표시(100px = 몇 m)가 거짓말을 하지 않는다.
 */
export function project(
  view: YardView,
  viewport: Viewport,
  lat: number,
  lon: number,
  altitude = 0
): ProjectedPoint {
  const { fx, fy } = flatOffset(view, lat, lon)
  const cx = viewport.width / 2
  const cy = viewport.height / 2

  if (!view.pitch) {
    return { sx: cx + fx, sy: cy + fy, depth: 1, behind: false }
  }

  const p = view.pitch * DEG
  const sinP = Math.sin(p)
  const cosP = Math.cos(p)
  const d = cameraDistance(viewport)
  const altPx = (altitude / METERS_PER_LAT_DEGREE) * view.scale

  /* 카메라로부터의 깊이 — 북쪽(fy < 0)일수록 멀고, 높이 뜬 점일수록 가깝다 */
  const raw = d - fy * sinP - altPx * cosP
  const behind = raw <= d * 0.02
  const depth = behind ? d * 0.02 : raw
  const k = d / depth

  return {
    sx: cx + fx * k,
    sy: cy + (fy * cosP - altPx * sinP) * k,
    depth,
    behind,
  }
}

export function worldToScreen(
  view: YardView,
  viewport: Viewport,
  lat: number,
  lon: number,
  altitude = 0
): ScreenPoint {
  const { sx, sy } = project(view, viewport, lat, lon, altitude)
  return { sx, sy }
}

/** 화면 좌표가 가리키는 **지면** 위의 위경도 (고도 0 평면과의 교점) */
export function screenToWorld(
  view: YardView,
  viewport: Viewport,
  sx: number,
  sy: number
): { lat: number; lon: number } {
  const v = sx - viewport.width / 2
  const u = sy - viewport.height / 2

  let fx = v
  let fy = u
  if (view.pitch) {
    const p = view.pitch * DEG
    const sinP = Math.sin(p)
    const cosP = Math.cos(p)
    const d = cameraDistance(viewport)
    /* 지평선 위를 가리키면 땅과 만나지 않는다 — 아주 먼 지점으로 눌러 유한한 값을 준다 */
    const denom = Math.max(d * cosP + u * sinP, d * 0.02)
    fy = (u * d) / denom
    fx = (v * (d - fy * sinP)) / d
  }

  let ex = fx
  let ey = fy
  if (view.bearing) {
    const b = view.bearing * DEG
    const cosB = Math.cos(b)
    const sinB = Math.sin(b)
    ex = fx * cosB - fy * sinB
    ey = fx * sinB + fy * cosB
  }

  return {
    lat: view.centerLat - ey / view.scale,
    lon: view.centerLon + ex / (LON_SQUEEZE * view.scale),
  }
}

/**
 * 화면 100px 이 야드에서 몇 미터인가 — 배율(px/도)보다 이쪽이 읽힌다.
 *
 * 기울인 화면에서는 자리마다 축척이 다르므로 **화면 중심의 가로 축척**을 낸다
 * (중심의 가로 방향은 기울여도 눌리지 않는다). 3D 는 재는 화면이 아니라 보는
 * 화면이라, 여기서 말하는 축척은 "대략 이 정도 크기"라는 기준선이다.
 */
export function metersPer100px(view: YardView): number {
  return (100 / view.scale) * METERS_PER_LAT_DEGREE
}

/* 아래는 야드 전체가 들어오는 정도, 위는 지번 하나가 화면을 채우는 정도 */
export const MIN_SCALE = 8_000
export const MAX_SCALE = 4_000_000

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/**
 * 주어진 범위가 여백을 두고 다 들어오는 뷰.
 *
 * 카메라 자세(`camera`)를 주면 그 자세를 유지한 채 맞춘다. 돌리면 대각선이 화면을
 * 가로지르고, 기울이면 가까운 쪽이 확대되어 밖으로 밀리므로 그만큼 물러선다.
 */
export function fitView(
  bounds: LatLonBounds,
  viewport: Viewport,
  padding = 0.05,
  camera?: { pitch: number; bearing: number }
): YardView {
  const pitch = clampPitch(camera?.pitch ?? 0)
  const bearing = wrapBearing(camera?.bearing ?? 0)

  const latSpan = Math.max(1e-6, bounds.maxLat - bounds.minLat)
  const lonSpan = Math.max(1e-6, bounds.maxLon - bounds.minLon) * LON_SQUEEZE

  const b = bearing * DEG
  const cosB = Math.abs(Math.cos(b))
  const sinB = Math.abs(Math.sin(b))
  const spanW = lonSpan * cosB + latSpan * sinB
  const spanH = latSpan * cosB + lonSpan * sinB

  let scale = Math.min(viewport.height / spanH, viewport.width / spanW) * (1 - padding * 2)
  /* 기울인 만큼 물러선다 — 원근으로 커진 앞쪽이 화면 밖으로 나가지 않도록 */
  scale /= 1 + Math.sin(pitch * DEG) * 0.55

  return {
    centerLat: (bounds.minLat + bounds.maxLat) / 2,
    centerLon: (bounds.minLon + bounds.maxLon) / 2,
    scale: clampScale(scale),
    pitch,
    bearing,
  }
}

/** 커서 아래 지점을 고정한 채 확대/축소 — 그래야 "보고 있던 것"이 손에서 빠지지 않는다 */
export function zoomAt(
  view: YardView,
  viewport: Viewport,
  sx: number,
  sy: number,
  factor: number
): YardView {
  const next = clampScale(view.scale * factor)
  if (next === view.scale) return view

  const before = screenToWorld(view, viewport, sx, sy)
  const after = screenToWorld({ ...view, scale: next }, viewport, sx, sy)
  return {
    ...view,
    scale: next,
    centerLat: view.centerLat + (before.lat - after.lat),
    centerLon: view.centerLon + (before.lon - after.lon),
  }
}

/**
 * 화면을 (dx, dy) px 만큼 끌었을 때의 뷰.
 *
 * 위경도를 직접 더하지 않고 **역투영으로** 구한다 — 기울이거나 돌린 화면에서는
 * "화면 1px = 위도 몇 도"가 자리마다 다르기 때문이다. 손에 잡힌 지점이 커서를
 * 따라오게 하려면, 새 중심은 곧 "지금 화면에서 (중심 - 델타) 자리의 땅"이다.
 */
export function panBy(view: YardView, viewport: Viewport, dx: number, dy: number): YardView {
  const target = screenToWorld(view, viewport, viewport.width / 2 - dx, viewport.height / 2 - dy)
  return { ...view, centerLat: target.lat, centerLon: target.lon }
}

/**
 * 화면에 걸치는 범위 — 그리기 전에 바깥 도형을 버리는 데 쓴다.
 *
 * 기울이거나 돌리면 화면에 담기는 땅은 직사각형이 아니라 **사다리꼴**이다. 볼록한
 * 사각형이라 네 꼭짓점의 경계 상자면 충분하다(그 안을 넘는 점이 없다).
 */
export function visibleBounds(view: YardView, viewport: Viewport, marginPx = 0): LatLonBounds {
  if (!view.pitch && !view.bearing) {
    const halfLat = (viewport.height / 2 + marginPx) / view.scale
    const halfLon = (viewport.width / 2 + marginPx) / (LON_SQUEEZE * view.scale)
    return {
      minLat: view.centerLat - halfLat,
      maxLat: view.centerLat + halfLat,
      minLon: view.centerLon - halfLon,
      maxLon: view.centerLon + halfLon,
    }
  }

  const left = -marginPx
  const top = -marginPx
  const right = viewport.width + marginPx
  const bottom = viewport.height + marginPx
  const corners: [number, number][] = [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ]

  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  for (const [sx, sy] of corners) {
    const { lat, lon } = screenToWorld(view, viewport, sx, sy)
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
  }
  return { minLat, maxLat, minLon, maxLon }
}

export function intersects(a: LatLonBounds, b: LatLonBounds): boolean {
  return !(a.maxLat < b.minLat || a.minLat > b.maxLat || a.maxLon < b.minLon || a.minLon > b.maxLon)
}

export function containsPoint(bounds: LatLonBounds, lat: number, lon: number): boolean {
  return lat >= bounds.minLat && lat <= bounds.maxLat && lon >= bounds.minLon && lon <= bounds.maxLon
}
