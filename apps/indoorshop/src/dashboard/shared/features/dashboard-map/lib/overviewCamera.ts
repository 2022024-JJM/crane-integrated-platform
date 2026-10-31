import type { LatLonBounds } from '../../yard-map'
import { factoryBounds, type YardParcels } from '../../../entities/yard-parcels'

/**
 * 대문 카메라 — 야드 맵이 처음 열릴 때의 자리.
 *
 * **모든 공장이 한 화면에 다 보이게** 맞춘다(사용자 확정). 지도는 돌려 보므로
 * (`MAP_BEARING`), 축 정렬 범위를 그대로 주면 돌린 상자가 커져 화면이 헐거워진다 — 공장
 * 지번을 화면 방향으로 돌려 **딱 맞는 상자**를 구하고, `fitView` 가 그 상자 그대로 맞추도록
 * 범위를 거꾸로 풀어 준다. 왼쪽에는 공정 목록 카드가 늘 떠 있으므로 그 폭만큼 왼쪽을 비운다.
 */

/** 대문 카메라 여백 — 화면 가장자리에 공장이 닿지 않을 만큼만 */
export const OVERVIEW_BOUNDS_PADDING = 0.03

/** 화면 왼쪽에서 비워 둘 몫 — 공정 목록 카드(18rem)가 덮는 폭(1440px 기준 약 4분의 1) */
const LEFT_RESERVE = 0.24

/** 경도 1도의 지면 길이 비 — 야드 위도(34.87°)에서 (yard-map 투영과 같은 값) */
const LON_SQUEEZE = Math.cos((34.87 * Math.PI) / 180)

/**
 * 소속 공장이 있는 지번 전체를 감싸는 경계 상자 — 대문 카메라(초기·선택 해제)의 범위.
 * 야드 fixture 의 전체 extent 보다 훨씬 좁아, 여기에 맞추면 공장 부피가 처음부터 선다.
 */
export function allFactoriesBounds(parcels: YardParcels): LatLonBounds | null {
  let minLat = Infinity
  let minLon = Infinity
  let maxLat = -Infinity
  let maxLon = -Infinity
  for (const lot of parcels.lots) {
    if (lot.factory == null) continue
    for (const p of lot.polygon) {
      if (p.lat < minLat) minLat = p.lat
      if (p.lat > maxLat) maxLat = p.lat
      if (p.lon < minLon) minLon = p.lon
      if (p.lon > maxLon) maxLon = p.lon
    }
  }
  if (minLat === Infinity) return null
  return { minLat, minLon, maxLat, maxLon }
}

/**
 * 대문 카메라 범위 — 방위 `bearingDeg` 로 돌린 화면에서 모든 공장 지번이 꼭 맞고, 왼쪽에
 * 카드 몫(`LEFT_RESERVE`)이 비는 자리. `fitView(범위, …, bearing)` 에 그대로 넘긴다.
 */
export function overviewCameraBounds(
  parcels: YardParcels,
  bearingDeg = 0,
  leftReserve = LEFT_RESERVE
): LatLonBounds | null {
  const cluster = allFactoriesBounds(parcels)
  if (!cluster) return null
  const lat0 = (cluster.minLat + cluster.maxLat) / 2
  const lon0 = (cluster.minLon + cluster.maxLon) / 2
  const b = (bearingDeg * Math.PI) / 180
  const cos = Math.cos(b)
  const sin = Math.sin(b)

  /* 1) 공장 지번 꼭짓점을 화면 방향으로 돌린 좌표(배율 1)의 상자 — yard-map flatOffset 과 같은 식 */
  let fxMin = Infinity
  let fxMax = -Infinity
  let fyMin = Infinity
  let fyMax = -Infinity
  for (const lot of parcels.lots) {
    if (lot.factory == null) continue
    for (const p of lot.polygon) {
      const ex = (p.lon - lon0) * LON_SQUEEZE
      const ey = -(p.lat - lat0)
      const fx = ex * cos + ey * sin
      const fy = -ex * sin + ey * cos
      if (fx < fxMin) fxMin = fx
      if (fx > fxMax) fxMax = fx
      if (fy < fyMin) fyMin = fy
      if (fy > fyMax) fyMax = fy
    }
  }

  /* 2) 왼쪽에 카드 몫을 비운다 — 상자를 왼쪽으로 늘리면 공장들은 화면 오른쪽에 선다 */
  const reserve = Math.min(0.6, Math.max(0, leftReserve))
  const width0 = fxMax - fxMin
  fxMin -= (width0 * reserve) / (1 - reserve)
  const W = fxMax - fxMin
  const H = fyMax - fyMin

  /* 3) 상자 중심을 위경도로 되돌린다(돌림의 역변환) */
  const fcx = (fxMin + fxMax) / 2
  const fcy = (fyMin + fyMax) / 2
  const ex = fcx * cos - fcy * sin
  const ey = fcx * sin + fcy * cos
  const centerLon = lon0 + ex / LON_SQUEEZE
  const centerLat = lat0 - ey

  /*
   * 4) fitView 는 축 정렬 범위를 돌린 상자(a·C + c·S, a·S + c·C)에 맞춘다(C=|cos|, S=|sin|,
   *    a=경도 폭×squeeze, c=위도 폭). 그 상자가 W×H 가 되도록 a, c 를 푼다. 너무 길쭉해
   *    풀이가 음수가 되면(돌림이 크면) 짧은 변을 하한으로 둔다.
   */
  const C = Math.abs(cos)
  const S = Math.abs(sin)
  const det = C * C - S * S
  let a = W
  let c = H
  if (Math.abs(det) > 1e-3) {
    a = (W * C - H * S) / det
    c = (H * C - W * S) / det
  }
  const floor = Math.max(W, H) * 0.05
  a = Math.max(floor, a)
  c = Math.max(floor, c)
  const halfLon = a / LON_SQUEEZE / 2
  const halfLat = c / 2
  return {
    minLat: centerLat - halfLat,
    maxLat: centerLat + halfLat,
    minLon: centerLon - halfLon,
    maxLon: centerLon + halfLon,
  }
}

/**
 * 공장 카메라 범위 — 고른 공장을 가운데 두되, **군집 범위의 일정 비율 위로는 넓히지
 * 않는다.** (`bayCameraBounds` 의 거울상)
 *
 * 공장 지번을 그대로 맞추면 착지 배율이 공장 크기에 그대로 끌려간다. 1DOCK 도장공장은
 * 전처리 A1 부터 B19 까지 670m 비스듬한 띠라 축정렬 범위가 군집 위도폭의 34% 나 되고,
 * 대문 카메라는 이미 음수 여백(`OVERVIEW_BOUNDS_PADDING`)으로 범위 안까지 들어와 있다.
 * 그 둘이 겹쳐 1DOCK 으로 날아가도 배율이 1.3배밖에 오르지 않는다 — 다른 공장이 3~10배로
 * 붙는 것과 달리 "눌러도 확대가 안 된다"로 보인다.
 *
 * 그래서 여백이 아니라 **범위**로 배율의 하한을 만든다: 축마다 군집의 `maxRatio` 까지만
 * 담으므로 어느 공장을 눌러도 비슷한 거리에 착지한다. 긴 공장은 양 끝이 화면 밖으로
 * 나가지만(드래그로 따라간다), 착지 배율이 고른 편이 훑는 감각에 낫다.
 */
export function factoryCameraBounds(
  factory: LatLonBounds,
  cluster: LatLonBounds,
  maxRatio: number
): LatLonBounds {
  const shrink = (min: number, max: number, clusterMin: number, clusterMax: number) => {
    const target = Math.min(max - min, (clusterMax - clusterMin) * maxRatio)
    const center = (min + max) / 2
    return [center - target / 2, center + target / 2] as const
  }
  const [minLat, maxLat] = shrink(factory.minLat, factory.maxLat, cluster.minLat, cluster.maxLat)
  const [minLon, maxLon] = shrink(factory.minLon, factory.maxLon, cluster.minLon, cluster.maxLon)
  return { minLat, maxLat, minLon, maxLon }
}

/**
 * 공장을 골랐을 때 화면에 담을 **군집 범위의 최대 비율** — 확대 배율의 하한이다.
 * 공장 크기가 한 채(≈80m)에서 1DOCK 도장공장의 비스듬한 띠(≈670m)까지 여덟 배 벌어져,
 * 지번 범위를 그대로 맞추면 작은 공장은 10배로 붙고 1DOCK 은 1.3배에 그친다(=확대가 안
 * 된 것처럼 보인다). 범위 쪽을 묶어 어느 공장을 눌러도 2.5배 이상으로 붙게 한다.
 * 값을 올리면 큰 공장이 더 온전히 담기는 대신 착지가 다시 멀어진다.
 */
export const FACTORY_CAMERA_MAX_RATIO = 0.17

/**
 * 이름으로 고른 공장의 카메라 범위 — 지번 범위를 군집 대비로 한 번 조인 값.
 * 지도에 없는 공장이면 `null`.
 *
 * 공장을 누르는 화면(대시보드 전체 현황·선행도장 배치)이 **같은 잣대로 착지**하도록 이
 * 조합을 한자리에 둔다. 화면마다 따로 조합하면 한쪽만 조이는 일이 생긴다 — 실제로 선행도장
 * 배치가 그래서 1DOCK 도장공장을 눌러도 확대가 되지 않았다.
 */
export function factoryCameraBoundsOf(
  parcels: YardParcels,
  factory: string
): LatLonBounds | null {
  const lots = factoryBounds(parcels, factory)
  if (!lots) return null
  const cluster = allFactoriesBounds(parcels)
  return cluster ? factoryCameraBounds(lots, cluster, FACTORY_CAMERA_MAX_RATIO) : lots
}

/**
 * 베이 카메라 범위 — 고른 베이를 가운데 두되, **공장 범위의 일정 비율 아래로는 좁히지
 * 않는다.**
 *
 * 베이 하나에 딱 맞춰 날아가면 배율이 널뛴다: PBS 3BAY 는 지번 한 장(약 100m)이고
 * 1BAY 는 세 장(약 300m)이라, 같은 여백을 줘도 앞의 것은 화면을 꽉 채우고 뒤의 것은
 * 공장 절반이 남는다. 같은 동작(베이 클릭)이 매번 다른 거리로 착지하면 어디를 보고
 * 있는지 감각이 서지 않는다.
 *
 * 그래서 여백이 아니라 **범위**로 배율을 묶는다 — 베이가 아무리 작아도 화면에는 공장의
 * `minRatio` 만큼이 담기므로, 이웃 베이가 늘 함께 남고 확대 배율에 상한이 생긴다.
 */
export function bayCameraBounds(
  bay: LatLonBounds,
  factory: LatLonBounds,
  minRatio: number
): LatLonBounds {
  const grow = (min: number, max: number, factoryMin: number, factoryMax: number) => {
    const target = Math.max(max - min, (factoryMax - factoryMin) * minRatio)
    const center = (min + max) / 2
    return [center - target / 2, center + target / 2] as const
  }
  const [minLat, maxLat] = grow(bay.minLat, bay.maxLat, factory.minLat, factory.maxLat)
  const [minLon, maxLon] = grow(bay.minLon, bay.maxLon, factory.minLon, factory.maxLon)
  return { minLat, maxLat, minLon, maxLon }
}

/** 지도 위를 덮는 상자(카드) — 지도 상자 기준 화면 좌표(px) */
export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

/** 공장 하나의 외곽(볼록 껍질) 꼭짓점 — 가림 검사를 수천 점이 아니라 수백 점으로 */
function hullOf(points: readonly { lat: number; lon: number }[]): { lat: number; lon: number }[] {
  const pts = [...points].sort((a, b) => a.lon - b.lon || a.lat - b.lat)
  if (pts.length <= 3) return pts
  const cross = (o: { lat: number; lon: number }, a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
    (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon)
  const lower: { lat: number; lon: number }[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: { lat: number; lon: number }[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/** 가림 검사에 쓸 점 — 공장마다 외곽 꼭짓점 */
export function factoryOutlinePoints(parcels: YardParcels): { lat: number; lon: number }[] {
  const byFactory = new Map<string, { lat: number; lon: number }[]>()
  for (const lot of parcels.lots) {
    if (lot.factory == null) continue
    const list = byFactory.get(lot.factory) ?? []
    list.push(...lot.polygon)
    byFactory.set(lot.factory, list)
  }
  return [...byFactory.values()].flatMap(hullOf)
}

/**
 * 투영 계산 — yard-map 의 것을 주입받는다(이 파일이 렌더 엔진을 직접 끌어오지 않게).
 */
export interface OverviewProjection {
  project: (view: OverviewView, viewport: { width: number; height: number }, lat: number, lon: number) => {
    sx: number
    sy: number
    behind: boolean
  }
  screenToWorld: (view: OverviewView, viewport: { width: number; height: number }, sx: number, sy: number) => {
    lat: number
    lon: number
  }
}

export interface OverviewView {
  centerLat: number
  centerLon: number
  scale: number
  pitch: number
  bearing: number
}

/**
 * **카드를 피해 최대로 확대한** 대문 카메라 — 모든 공장 외곽이 화면 안에 있고, 지도를 덮은
 * 카드(왼쪽 공정 목록·오른쪽 점검 필요) 밑으로 들어가지 않는 가장 큰 배율과 그때의 중심을
 * 찾는다(사용자 확정: "양쪽 카드에 가려지지 않을 정도로만 확대").
 *
 * 공장 군집이 꼭 맞는 배율에서 시작해, 배율을 조금씩 키우고(가장 큰 것부터) 그 배율마다 중심을
 * 화면 안에서 조금씩 옮겨 가며 되는 자리를 찾는다. 처음 되는 배율이 답이다. 하나도 안 되면
 * 꼭 맞는 배율보다 물러서며 같은 식으로 찾는다.
 *
 * 돌려주는 것은 YardMap 이 `fitView(범위, 여백 0, 그 기울기·방위)` 로 이 카메라를 그대로
 * 재현하는 **범위**다.
 */
export function overviewBoundsAvoidingCards(
  points: readonly { lat: number; lon: number }[],
  viewport: { width: number; height: number },
  obstacles: readonly ScreenRect[],
  camera: { bearing: number; pitch: number },
  proj: OverviewProjection,
  margin = 12,
  /**
   * 배율을 이 값으로 **고정**한다(사용자 확정: 기본 확대 30,000). 그때는 배율을 찾지 않고,
   * 그 배율에서 카드에 가리는 공장 꼭짓점이 가장 적은 중심만 찾는다.
   */
  fixedScale?: number
): LatLonBounds | null {
  if (points.length === 0 || viewport.width <= 0 || viewport.height <= 0) return null
  const { width: w, height: h } = viewport

  /* 0) 출발점 — 군집 중심, 배율은 화면 짧은 쪽에 대략 맞춘 값 */
  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  for (const p of points) {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLon = Math.min(minLon, p.lon)
    maxLon = Math.max(maxLon, p.lon)
  }
  const base: OverviewView = {
    centerLat: (minLat + maxLat) / 2,
    centerLon: (minLon + maxLon) / 2,
    scale: Math.min(w / ((maxLon - minLon) * LON_SQUEEZE), h / (maxLat - minLat)),
    pitch: camera.pitch,
    bearing: camera.bearing,
  }

  /** 화면 밖이거나 카드 밑인 꼭짓점 수 — 0 이면 다 보인다 */
  const misses = (view: OverviewView, stopAt = Infinity) => {
    let n = 0
    for (const p of points) {
      const { sx, sy, behind } = proj.project(view, viewport, p.lat, p.lon)
      let bad = behind || sx < margin || sx > w - margin || sy < margin || sy > h - margin
      if (!bad) {
        for (const r of obstacles) {
          if (sx > r.x - margin && sx < r.x + r.width + margin && sy > r.y - margin && sy < r.y + r.height + margin) {
            bad = true
            break
          }
        }
      }
      if (bad && ++n >= stopAt) return n
    }
    return n
  }
  const fits = (view: OverviewView) => misses(view, 1) === 0

  /* 1) 배율 후보 — 크게(2배)부터 작게(0.3배)까지 3%씩 */
  const shifts: [number, number][] = []
  for (let ix = -8; ix <= 8; ix++) for (let iy = -6; iy <= 6; iy++) shifts.push([ix * 0.03 * w, iy * 0.03 * h])
  shifts.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]))
  let found: OverviewView | null = null
  if (fixedScale != null) {
    /* 배율 고정 — 가리는 꼭짓점이 가장 적은 중심(같으면 덜 옮긴 쪽) */
    const scaled = { ...base, scale: fixedScale }
    let best = Infinity
    for (const [dx, dy] of shifts) {
      const c = proj.screenToWorld(scaled, viewport, w / 2 + dx, h / 2 + dy)
      const view = { ...scaled, centerLat: c.lat, centerLon: c.lon }
      const n = misses(view, best)
      if (n < best) {
        best = n
        found = view
        if (n === 0) break
      }
    }
  }
  for (let k = 2; k >= 0.3 && !found; k *= 0.97) {
    const scaled = { ...base, scale: base.scale * k }
    for (const [dx, dy] of shifts) {
      /* 화면에서 (dx,dy) 만큼 옮긴 자리를 새 중심으로 — 군집이 반대쪽으로 간다 */
      const c = proj.screenToWorld(scaled, viewport, w / 2 + dx, h / 2 + dy)
      const view = { ...scaled, centerLat: c.lat, centerLon: c.lon }
      if (fits(view)) {
        found = view
        break
      }
    }
  }
  if (!found) return null

  /* 2) 이 카메라를 fitView(여백 0)가 재현하는 범위로 */
  return boundsReproducingView(found, viewport, camera)
}

/**
 * 카메라 하나를 **fitView(여백 0)가 정확히 재현하는 범위**로 바꾼다 — fitView 의 배율식
 * scale = min(h/spanH, w/spanW) / (1 + sin(pitch)·0.55) 를 거꾸로 풀고, 돌린 상자 폭을
 * 축 정렬 범위로 되돌린다(overviewCameraBounds 와 같은 풀이). YardMap 은 범위를 받아
 * 카메라를 맞추므로, 계산한 카메라를 넘기려면 이 범위로 바꿔 줘야 한다.
 */
export function boundsReproducingView(
  view: Pick<OverviewView, 'centerLat' | 'centerLon' | 'scale'>,
  viewport: { width: number; height: number },
  camera: { bearing: number; pitch: number }
): LatLonBounds {
  const { width: w, height: h } = viewport
  const found = view
  const kk = found.scale * (1 + Math.sin((camera.pitch * Math.PI) / 180) * 0.55)
  const spanW = w / kk
  const spanH = h / kk
  const b = (camera.bearing * Math.PI) / 180
  const C = Math.abs(Math.cos(b))
  const S = Math.abs(Math.sin(b))
  const det = C * C - S * S
  /* 위도 폭 c 는 연립해의 값(음수면 0 에 가깝게), 경도 폭 a 는 두 조건(돌린 상자 폭 ≤ spanW,
     높이 ≤ spanH) 중 빡빡한 쪽에 꼭 맞춘다 — 한쪽이 정확히 맞아야 fitView 의 min 이 정확히
     이 배율을 낸다(바닥값으로 부풀리면 배율이 몇 % 어긋났다) */
  const tiny = Math.max(spanW, spanH) * 1e-6
  let c = Math.abs(det) > 1e-3 ? (spanH * C - spanW * S) / det : spanH
  c = Math.max(tiny, c)
  let a = S > 1e-9 ? Math.min((spanW - c * S) / C, (spanH - c * C) / S) : spanW / C
  if (a <= tiny) {
    /* 화면이 아주 납작한 경우 — 경도 쪽을 바닥에 두고 위도 쪽을 맞춘다 */
    a = tiny
    c = Math.min((spanW - a * C) / S, (spanH - a * S) / C)
  }
  return {
    minLat: found.centerLat - c / 2,
    maxLat: found.centerLat + c / 2,
    minLon: found.centerLon - a / LON_SQUEEZE / 2,
    maxLon: found.centerLon + a / LON_SQUEEZE / 2,
  }
}

/**
 * 야드 전경 — **모든 공장이 화면 안에 다 들고, 그 묶음이 화면 한가운데**에 서는 카메라의
 * 범위(사용자 확정). 방위·기울기는 정해진 값 그대로, 중심과 배율만 찾는다.
 *
 * 기울인 화면은 원근 때문에 위경도 범위의 가운데가 화면 가운데에 오지 않는다 — 그래서 화면에
 * 비친 공장 묶음의 상자를 재어 (1) 그 상자의 가운데를 화면 가운데로 옮기고 (2) 상자가 여백 안에
 * 꼭 맞도록 배율을 고치기를 몇 번 되풀이한다(몇 번이면 1px 안으로 모인다).
 *
 * `margin` 은 가장자리 여백(px) — 위쪽은 검색창·토글 줄, 아래쪽은 조작 안내가 서는 자리라
 * 가로보다 넉넉히 둔다.
 */
export function overviewBoundsCentered(
  points: readonly { lat: number; lon: number }[],
  viewport: { width: number; height: number },
  camera: { bearing: number; pitch: number },
  proj: OverviewProjection,
  margin: { x: number; y: number } = { x: 32, y: 72 }
): LatLonBounds | null {
  if (points.length === 0 || viewport.width <= 0 || viewport.height <= 0) return null
  const { width: w, height: h } = viewport
  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  for (const p of points) {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLon = Math.min(minLon, p.lon)
    maxLon = Math.max(maxLon, p.lon)
  }
  let view: OverviewView = {
    centerLat: (minLat + maxLat) / 2,
    centerLon: (minLon + maxLon) / 2,
    scale: Math.min(w / ((maxLon - minLon) * LON_SQUEEZE), h / (maxLat - minLat)) * 0.5,
    pitch: camera.pitch,
    bearing: camera.bearing,
  }
  const innerW = Math.max(1, w - margin.x * 2)
  const innerH = Math.max(1, h - margin.y * 2)
  for (let i = 0; i < 24; i++) {
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (const p of points) {
      const { sx, sy } = proj.project(view, viewport, p.lat, p.lon)
      x0 = Math.min(x0, sx)
      x1 = Math.max(x1, sx)
      y0 = Math.min(y0, sy)
      y1 = Math.max(y1, sy)
    }
    const fit = Math.min(innerW / Math.max(1e-6, x1 - x0), innerH / Math.max(1e-6, y1 - y0))
    const off = Math.hypot((x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2)
    if (Math.abs(fit - 1) < 0.002 && off < 0.5) break
    /* (1) 상자 가운데를 화면 가운데로 */
    const c = proj.screenToWorld(view, viewport, (x0 + x1) / 2, (y0 + y1) / 2)
    /* (2) 상자가 여백 안에 꼭 맞게 — 한 번에 다 고치면 원근 때문에 출렁여서 조금 눌러 고친다 */
    view = { ...view, centerLat: c.lat, centerLon: c.lon, scale: view.scale * fit ** 0.9 }
  }
  return boundsReproducingView(view, viewport, camera)
}
