import type { LatLon } from '../model/types'

/**
 * 공장 하나를 두르는 **바깥선** — 떨어져 앉은 베이까지 한 덩어리로 묶는다.
 *
 * 왜 폴리곤 연산이 아니라 격자인가: 야드의 지번·베이는 서로 맞닿아 있어도 **꼭짓점이
 * 맞지 않는다**(T자 접합). 그래서 "같은 변을 두 번 만나면 안쪽" 같은 판정이 통하지
 * 않고, 정직한 다각형 합집합을 쓰려면 클리핑 라이브러리 한 벌이 필요하다. 게다가 우리가
 * 원하는 것은 순수한 합집합도 아니다 — 같은 공장인데 통로만큼 떨어진 덩어리들을 **한 채로
 * 보고 싶다**. 격자에 굽고 부풀렸다 되돌리면(모폴로지 닫기) 그 두 가지가 한 번에 풀린다.
 *
 * 대신 격자는 계단을 남기므로, 마지막에 선을 펴서(RDP) 곧은 변을 곧게 돌려놓는다.
 *
 * 값이 바뀌지 않는 계산이라 **데이터를 읽을 때 한 번**만 돌린다 — 프레임마다 돌릴 것이
 * 아니다.
 */

/** 격자 한 칸의 크기(m). 작을수록 모서리가 곱지만 계산이 제곱으로 늘어난다 */
const CELL_M = 0.5
/** 격자가 이보다 커지면 칸을 키운다 — 아주 넓은 공장에서 메모리가 터지지 않게 */
const MAX_CELLS = 4_000_000
/** 선을 펴는 허용 오차(m). 격자 계단(최대 CELL_M)보다 넉넉해야 계단이 지워진다 */
const SIMPLIFY_M = 1.1

interface Grid {
  w: number
  h: number
  cell: number
  /** 격자 (0,0) 이 놓인 지역좌표 원점 */
  ox: number
  oy: number
  bits: Uint8Array
}

/**
 * 위경도를 미터 평면으로 — 야드 한 곳(수 km)만 다루므로 기준 위도 하나로 충분하다.
 * 지도 렌더러와 같은 근사(경도는 cos φ 로 눌린다)를 쓴다.
 */
function projector(lat0: number) {
  const M = 111_320
  const kx = M * Math.cos((lat0 * Math.PI) / 180)
  return {
    x: (p: LatLon) => p.lon * kx,
    y: (p: LatLon) => p.lat * M,
    back: (x: number, y: number): LatLon => ({ lat: y / M, lon: x / kx }),
  }
}

/** 다각형들을 격자에 굽는다 (짝수-홀수 규칙, 주사선) */
function rasterize(polys: readonly (readonly LatLon[])[], bridgeM: number, lat0: number): Grid | null {
  const pr = projector(lat0)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const poly of polys)
    for (const p of poly) {
      const x = pr.x(p)
      const y = pr.y(p)
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  if (!Number.isFinite(minX)) return null

  /* 부풀렸다 되돌릴 여유 + 한 칸 — 테두리가 격자 밖으로 잘리지 않게 */
  const padM = bridgeM + CELL_M * 2
  let cell = CELL_M
  let w = Math.ceil((maxX - minX + padM * 2) / cell)
  let h = Math.ceil((maxY - minY + padM * 2) / cell)
  while (w * h > MAX_CELLS) {
    cell *= 2
    w = Math.ceil((maxX - minX + padM * 2) / cell)
    h = Math.ceil((maxY - minY + padM * 2) / cell)
  }
  const ox = minX - padM
  const oy = minY - padM
  const bits = new Uint8Array(w * h)

  for (const poly of polys) {
    if (poly.length < 3) continue
    const xs = poly.map((p) => (pr.x(p) - ox) / cell)
    const ys = poly.map((p) => (pr.y(p) - oy) / cell)
    let top = Infinity
    let bottom = -Infinity
    for (const y of ys) {
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
    const y0 = Math.max(0, Math.floor(top))
    const y1 = Math.min(h - 1, Math.ceil(bottom))
    for (let row = y0; row <= y1; row++) {
      /* 칸 한가운데를 지나는 주사선 — 꼭짓점을 정확히 스치는 경우를 피한다 */
      const sy = row + 0.5
      const cuts: number[] = []
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const yi = ys[i]
        const yj = ys[j]
        if (yi > sy === yj > sy) continue
        cuts.push(xs[i] + ((sy - yi) / (yj - yi)) * (xs[j] - xs[i]))
      }
      cuts.sort((a, b) => a - b)
      for (let k = 0; k + 1 < cuts.length; k += 2) {
        const x0 = Math.max(0, Math.ceil(cuts[k] - 0.5))
        const x1 = Math.min(w - 1, Math.floor(cuts[k + 1] - 0.5))
        for (let x = x0; x <= x1; x++) bits[row * w + x] = 1
      }
    }
  }
  return { w, h, cell, ox, oy, bits }
}

/**
 * 각 칸에서 **켜진 칸까지의 거리** (chamfer 5-7-11, 값은 5배 스케일).
 *
 * 두 번 훑는 것으로 근사 유클리드 거리가 나온다 — 원형 커널을 매 칸마다 훑는 것보다
 * 수십 배 싸고, 여기서는 반경 몇 미터짜리 판정에만 쓰이므로 근사로 충분하다.
 */
function distanceTo(bits: Uint8Array, w: number, h: number, on: 1 | 0): Int32Array {
  const INF = 1 << 28
  const d = new Int32Array(w * h)
  for (let i = 0; i < d.length; i++) d[i] = bits[i] === on ? 0 : INF
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? INF : d[y * w + x])
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (d[i] === 0) continue
      const v = Math.min(
        d[i],
        at(x - 1, y) + 5,
        at(x, y - 1) + 5,
        at(x - 1, y - 1) + 7,
        at(x + 1, y - 1) + 7,
        at(x - 2, y - 1) + 11,
        at(x + 2, y - 1) + 11,
        at(x - 1, y - 2) + 11,
        at(x + 1, y - 2) + 11
      )
      d[i] = v
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      if (d[i] === 0) continue
      const v = Math.min(
        d[i],
        at(x + 1, y) + 5,
        at(x, y + 1) + 5,
        at(x + 1, y + 1) + 7,
        at(x - 1, y + 1) + 7,
        at(x + 2, y + 1) + 11,
        at(x - 2, y + 1) + 11,
        at(x + 1, y + 2) + 11,
        at(x - 1, y + 2) + 11
      )
      d[i] = v
    }
  return d
}

/** 부풀렸다 되돌린다 — 사이가 `2r` 이내로 벌어진 덩어리들이 하나로 붙는다 */
function close(grid: Grid, bridgeM: number): Uint8Array {
  const r = (bridgeM / grid.cell) * 5
  if (r <= 0) return grid.bits
  const { w, h } = grid
  const grown = new Uint8Array(w * h)
  const toOn = distanceTo(grid.bits, w, h, 1)
  for (let i = 0; i < grown.length; i++) grown[i] = toOn[i] <= r ? 1 : 0
  const toOff = distanceTo(grown, w, h, 0)
  const out = new Uint8Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = toOff[i] > r ? 1 : 0
  return out
}

/**
 * 켜진 칸 덩어리의 **바깥 테두리**를 고리로 뽑는다.
 *
 * 격자에서는 켜진 칸과 꺼진 칸 사이의 변이 곧 경계이고, 그 변들은 어긋남 없이 정확히
 * 맞물린다(폴리곤과 달리 T자 접합이 생길 수 없다). 그래서 여기서는 변을 잇는 것만으로
 * 닫힌 고리가 나온다 — 안쪽이 왼쪽에 오도록 방향을 맞춰 담는다.
 */
function traceRings(bits: Uint8Array, w: number, h: number): [number, number][][] {
  const on = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : bits[y * w + x])
  /** 시작점 키 → 변 번호 */
  const from = new Map<number, number[]>()
  const segs: [number, number, number, number][] = []
  const key = (x: number, y: number) => y * (w + 1) + x
  const push = (ax: number, ay: number, bx: number, by: number) => {
    const i = segs.length
    segs.push([ax, ay, bx, by])
    const k = key(ax, ay)
    const list = from.get(k)
    if (list) list.push(i)
    else from.set(k, [i])
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!bits[y * w + x]) continue
      if (!on(x, y - 1)) push(x, y, x + 1, y)
      if (!on(x + 1, y)) push(x + 1, y, x + 1, y + 1)
      if (!on(x, y + 1)) push(x + 1, y + 1, x, y + 1)
      if (!on(x - 1, y)) push(x, y + 1, x, y)
    }

  const used = new Array<boolean>(segs.length).fill(false)
  const rings: [number, number][][] = []
  for (let seed = 0; seed < segs.length; seed++) {
    if (used[seed]) continue
    used[seed] = true
    const [sx, sy] = segs[seed]
    const ring: [number, number][] = [[sx, sy]]
    let [, , cx, cy] = segs[seed]
    while (cx !== sx || cy !== sy) {
      ring.push([cx, cy])
      const next = (from.get(key(cx, cy)) ?? []).find((i) => !used[i])
      if (next === undefined) break
      used[next] = true
      cx = segs[next][2]
      cy = segs[next][3]
    }
    if (ring.length >= 4) rings.push(ring)
  }
  return rings
}

/** 계단을 편다 — 곧은 변은 곧게, 모서리는 남게 (Ramer–Douglas–Peucker) */
function simplify(ring: [number, number][], eps: number): [number, number][] {
  if (ring.length < 4) return ring
  const keep = new Uint8Array(ring.length)
  keep[0] = 1
  keep[ring.length - 1] = 1
  const stack: [number, number][] = [[0, ring.length - 1]]
  while (stack.length > 0) {
    const [i, j] = stack.pop() as [number, number]
    if (j <= i + 1) continue
    const [ax, ay] = ring[i]
    const [bx, by] = ring[j]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    let worst = -1
    let worstD = eps
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((ring[k][0] - ax) * dy - (ring[k][1] - ay) * dx) / len
      if (d > worstD) {
        worstD = d
        worst = k
      }
    }
    if (worst < 0) continue
    keep[worst] = 1
    stack.push([i, worst], [worst, j])
  }
  return ring.filter((_, i) => keep[i] === 1)
}

/**
 * 공장 한 채의 바깥선.
 *
 * @param polys  그 공장이 실제로 세우는 도형들(베이 지붕 발자국)
 * @param bridgeM  같은 공장끼리 이만큼 벌어진 틈은 메워 한 덩어리로 본다.
 *   **다른 공장과는 절대 메우지 않는다** — 이 함수는 공장 하나만 받는다.
 * @returns 닫힌 고리들. 이 거리로도 안 붙는 덩어리는 고리가 따로 나온다(진짜로 멀다).
 */
export function factoryOutlineRings(
  polys: readonly (readonly LatLon[])[],
  bridgeM: number
): LatLon[][] {
  if (polys.length === 0) return []
  const lat0 = polys[0][0]?.lat ?? 0
  const grid = rasterize(polys, bridgeM, lat0)
  if (!grid) return []
  const closed = close(grid, bridgeM)
  const pr = projector(lat0)
  const eps = SIMPLIFY_M / grid.cell
  return traceRings(closed, grid.w, grid.h)
    .map((ring) => simplify(ring, eps))
    .filter((ring) => ring.length >= 3)
    .map((ring) => ring.map(([x, y]) => pr.back(grid.ox + x * grid.cell, grid.oy + y * grid.cell)))
}
