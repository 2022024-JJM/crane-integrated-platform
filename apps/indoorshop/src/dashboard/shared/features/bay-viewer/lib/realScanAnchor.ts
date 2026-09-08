/*
 * 실측 스캔 앵커 — 실측 자체(display) 프레임을 야드 좌표(EPSG:5187 계열)로 잇는
 * **데이터 유도 변환**. 임의 앵커(출처 왜곡)를 두지 않기 위한 경로다.
 *
 * 두 갈래가 있고, 어느 쪽을 쓸지는 데이터가 정한다:
 *
 *  (1) **점집합 강체 정합** (`fitRigid2D`) — 같은 물리 LiDAR 집합이 두 자료에 다 있을 때.
 *      대응표(ID↔IP) 없이 회전+병진(반사 후보 포함)을 추정하고 잔차(RMS)가 스스로 검증한다.
 *      ⚠️ PBS 5BAY 는 **이 경우가 아니다**: 실측 12대는 갠트리 3기에 뭉쳐 64.7×4.6m
 *      (종횡비 14, 준-1차원)인데 설비 도면 12대는 베이 전장 238m 에 32m 피치로 분산
 *      (213.8×39.0m)이고, 도면 주 레일(v=+12.7m) 선상에는 스캔 점이 0개다 — 두 12대는
 *      **다른 장비 집합**이라 어떤 강체변환으로도 맞지 않는다(RMS 52.75m). W5-3 분석 §A③.
 *      그래도 지우지 않는다 — 장비 집합이 같은 데이터셋에서는 이쪽이 정답이다.
 *
 *  (2) **벽선 앵커** (`fitWallAxis`) — 점군의 구조(장변 벽선 2개)에서 회전·횡방향을 유도한다.
 *      센서 대응이 없어도 서고, 두 벽선의 평행도·내부폭이 스스로 검증한다. PBS 5BAY 가 쓰는 길.
 *      종방향 1 자유도는 여기서 결정되지 않는다 — 소비 쪽(공정 데이터 계층)이 규칙으로 채운다.
 *
 * 전부 순수 함수다 — 수치 규칙이 로더/뷰어 안에 있으면 검증할 수 없다.
 */

export interface Pt2 {
  x: number
  y: number
}

/** 강체 정합 결과 — target = R(±reflect)·source + t */
export interface Rigid2D {
  /** 회전각(라디안) */
  theta: number
  /** x 축 반전(반사) 여부 — display(y-up 수평면)와 평면좌표의 손방향이 다를 수 있다 */
  reflected: boolean
  tx: number
  ty: number
  /** 대응된 점 쌍의 RMS 잔차(m) */
  rms: number
  /** source 인덱스 → target 인덱스 (전 점 일대일) */
  pairs: number[]
}

const applyRigidPoint = (p: Pt2, theta: number, reflected: boolean, tx: number, ty: number): Pt2 => {
  const x = reflected ? -p.x : p.x
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return { x: c * x - s * p.y + tx, y: s * x + c * p.y + ty }
}

export function applyRigid(points: readonly Pt2[], t: Rigid2D): Pt2[] {
  return points.map((p) => applyRigidPoint(p, t.theta, t.reflected, t.tx, t.ty))
}

const centroid = (pts: readonly Pt2[]): Pt2 => {
  let x = 0
  let y = 0
  for (const p of pts) {
    x += p.x
    y += p.y
  }
  return { x: x / pts.length, y: y / pts.length }
}

/** 일대일 탐욕 배정 — 가까운 쌍부터 확정. n=12 라 O(n³) 도 공짜다 */
function greedyAssign(a: readonly Pt2[], b: readonly Pt2[]): number[] {
  const n = a.length
  const pairs = new Array<number>(n).fill(-1)
  const usedB = new Set<number>()
  const edges: { i: number; j: number; d: number }[] = []
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      edges.push({ i, j, d: (a[i].x - b[j].x) ** 2 + (a[i].y - b[j].y) ** 2 })
  edges.sort((p, q) => p.d - q.d)
  for (const { i, j } of edges) {
    if (pairs[i] !== -1 || usedB.has(j)) continue
    pairs[i] = j
    usedB.add(j)
  }
  return pairs
}

/** 대응이 주어졌을 때의 최적 강체 변환 (Kabsch/Procrustes, 반사 고정) */
function solveRigid(
  source: readonly Pt2[],
  target: readonly Pt2[],
  pairs: readonly number[],
  reflected: boolean
): { theta: number; tx: number; ty: number; rms: number } {
  const src = source.map((p) => (reflected ? { x: -p.x, y: p.y } : p))
  const ca = centroid(src)
  const matched = pairs.map((j) => target[j])
  const cb = centroid(matched)
  let sxx = 0
  let syx = 0
  for (let i = 0; i < src.length; i++) {
    const ax = src[i].x - ca.x
    const ay = src[i].y - ca.y
    const bx = matched[i].x - cb.x
    const by = matched[i].y - cb.y
    sxx += ax * bx + ay * by
    syx += ax * by - ay * bx
  }
  const theta = Math.atan2(syx, sxx)
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  const tx = cb.x - (c * ca.x - s * ca.y)
  const ty = cb.y - (s * ca.x + c * ca.y)
  let sq = 0
  for (let i = 0; i < src.length; i++) {
    const px = c * src[i].x - s * src[i].y + tx
    const py = s * src[i].x + c * src[i].y + ty
    sq += (px - matched[i].x) ** 2 + (py - matched[i].y) ** 2
  }
  return { theta, tx, ty, rms: Math.sqrt(sq / src.length) }
}

/**
 * 대응 미상의 두 점집합을 강체 정합한다.
 *
 * 회전을 모르면 최근접 대응도 못 만드니, 후보 회전(2° 간격)×반사(±)를 전수 훑어
 * 각 후보에서 탐욕 배정 → Kabsch 정련을 두 번 반복하고, RMS 최소를 택한다.
 * 12점 × 360 후보라 수 ms 다 — 실행 시점(로드 한 번)에 충분히 싸다.
 */
export function fitRigid2D(source: readonly Pt2[], target: readonly Pt2[]): Rigid2D | null {
  if (source.length !== target.length || source.length < 3) return null
  const ca = centroid(source)
  const cb = centroid(target)
  let best: Rigid2D | null = null

  for (const reflected of [false, true]) {
    for (let deg = 0; deg < 360; deg += 2) {
      let theta = (deg * Math.PI) / 180
      /* 후보 변환: 도심 일치 + 후보 회전 → 배정 → 정련 (2회면 수렴한다) */
      let tx = cb.x - (Math.cos(theta) * (reflected ? -ca.x : ca.x) - Math.sin(theta) * ca.y)
      let ty = cb.y - (Math.sin(theta) * (reflected ? -ca.x : ca.x) + Math.cos(theta) * ca.y)
      let pairs: number[] = []
      let rms = Infinity
      for (let iter = 0; iter < 2; iter++) {
        const moved = source.map((p) => applyRigidPoint(p, theta, reflected, tx, ty))
        pairs = greedyAssign(moved, target)
        const solved = solveRigid(source, target, pairs, reflected)
        theta = solved.theta
        tx = solved.tx
        ty = solved.ty
        rms = solved.rms
      }
      if (!best || rms < best.rms) best = { theta, reflected, tx, ty, rms, pairs }
    }
  }
  return best
}

/* ── WGS84 → 미터 (설비 엔티티의 이중 좌표에서 유도한 국소 아핀) ── */

export interface AffinePair {
  lat: number
  lon: number
  x: number
  y: number
}

export interface Affine2D {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

/**
 * (lat,lon)→(x,y) 국소 아핀을 최소자승으로 맞춘다. 새 투영 코드를 들이지 않는 이유:
 * 설비 엔티티가 **같은 점의 두 좌표(WGS84 + EPSG:5187 미터)** 를 이미 들고 있어서,
 * 그 쌍이 곧 야드 범위에서의 투영 그 자체다(수백 m 범위에서 아핀으로 사실상 정확).
 */
export function fitAffineWgsToMeters(pairs: readonly AffinePair[]): Affine2D | null {
  if (pairs.length < 3) return null
  /* 정규방정식 — 기저 [lon, lat, 1]. 도 단위 편차는 1e-4 급이라 그대로 풀면 행렬이
   * 사실상 특이가 된다 — 도심 기준 + 미터급 스케일(S)로 전처리해 조건수를 살린다. */
  const lon0 = pairs.reduce((s, p) => s + p.lon, 0) / pairs.length
  const lat0 = pairs.reduce((s, p) => s + p.lat, 0) / pairs.length
  const S = 1e5
  let s11 = 0, s12 = 0, s13 = 0, s22 = 0, s23 = 0, s33 = 0
  let bx1 = 0, bx2 = 0, bx3 = 0, by1 = 0, by2 = 0, by3 = 0
  for (const p of pairs) {
    const u = (p.lon - lon0) * S
    const v = (p.lat - lat0) * S
    s11 += u * u
    s12 += u * v
    s13 += u
    s22 += v * v
    s23 += v
    s33 += 1
    bx1 += u * p.x
    bx2 += v * p.x
    bx3 += p.x
    by1 += u * p.y
    by2 += v * p.y
    by3 += p.y
  }
  const det3 = (m: number[]) =>
    m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6])
  const M = [s11, s12, s13, s12, s22, s23, s13, s23, s33]
  const D = det3(M)
  if (Math.abs(D) < 1e-12) return null
  const solve = (b1: number, b2: number, b3: number): [number, number, number] => [
    det3([b1, s12, s13, b2, s22, s23, b3, s23, s33]) / D,
    det3([s11, b1, s13, s12, b2, s23, s13, b3, s33]) / D,
    det3([s11, s12, b1, s12, s22, b2, s13, s23, b3]) / D,
  ]
  const [A, B, c0] = solve(bx1, bx2, bx3)
  const [D2, E2, f0] = solve(by1, by2, by3)
  /* 스케일·도심 전처리를 원좌표 계수로 되돌린다 */
  const a = A * S
  const b = B * S
  const d = D2 * S
  const e = E2 * S
  return { a, b, c: c0 - a * lon0 - b * lat0, d, e, f: f0 - d * lon0 - e * lat0 }
}

export function applyAffine(t: Affine2D, lat: number, lon: number): Pt2 {
  return { x: t.a * lon + t.b * lat + t.c, y: t.d * lon + t.e * lat + t.f }
}

/* ── 베이 로컬 프레임 (OBB) ── */

export interface BayFrame {
  center: Pt2
  /** 긴 축 단위벡터 — 뷰어 베이 로컬의 +z 방향에 대응시킨다 */
  axis: Pt2
  /** 긴 변 길이(m) */
  long: number
  /** 짧은 변 길이(m) */
  short: number
}

/** 볼록 폴리곤의 최소 넓이 회전 사각형에서 도심과 긴 축을 뽑는다 (변 후보 순회) */
export function obbFrame(poly: readonly Pt2[]): BayFrame | null {
  if (poly.length < 3) return null
  let best: { area: number; axis: Pt2; center: Pt2; long: number; short: number } | null = null
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const len = Math.hypot(q.x - p.x, q.y - p.y)
    if (len === 0) continue
    const ux = (q.x - p.x) / len
    const uy = (q.y - p.y) / len
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
    for (const r of poly) {
      const u = r.x * ux + r.y * uy
      const v = -r.x * uy + r.y * ux
      if (u < minU) minU = u
      if (u > maxU) maxU = u
      if (v < minV) minV = v
      if (v > maxV) maxV = v
    }
    const du = maxU - minU
    const dv = maxV - minV
    const area = du * dv
    if (!best || area < best.area) {
      const cu = (minU + maxU) / 2
      const cv = (minV + maxV) / 2
      best = {
        area,
        axis: du >= dv ? { x: ux, y: uy } : { x: -uy, y: ux },
        center: { x: cu * ux - cv * uy, y: cu * uy + cv * ux },
        long: Math.max(du, dv),
        short: Math.min(du, dv),
      }
    }
  }
  return best && { center: best.center, axis: best.axis, long: best.long, short: best.short }
}

/* ── 합성: display 수평점 → 베이 로컬 (x=폭, z=길이) ── */

export interface RealScanAnchor {
  rigid: Rigid2D
  frame: BayFrame
}

/**
 * display 수평점(x,z)을 베이 로컬 평면(x,z)으로. y(높이)는 양쪽 다 바닥 0 이라 그대로 둔다.
 * 주의: 목업 공장 뷰의 베이 상자는 실제 베이(237.6m)를 대변하지 못하므로, **베이 축 방향
 * 오프셋은 호출 쪽에서 도심 재중심으로 접는다** — 여기서는 왜곡 없이 변환만 한다.
 */
export function displayToBayLocal(anchor: RealScanAnchor, dx: number, dz: number): Pt2 {
  const p = applyRigidPoint({ x: dx, y: dz }, anchor.rigid.theta, anchor.rigid.reflected, anchor.rigid.tx, anchor.rigid.ty)
  const qx = p.x - anchor.frame.center.x
  const qy = p.y - anchor.frame.center.y
  const u = anchor.frame.axis
  /* z = 긴 축 성분, x = 그 왼손 수직 성분 — three(y-up) 평면에서 오른손계가 되게 */
  return { x: qx * -u.y + qy * u.x, y: qx * u.x + qy * u.y }
}

/* ── 벽선 앵커 — 홀 구조에서 유도하는 앵커 (W5-3 분석 §A) ─────────────────────── */

/** 축 각을 (-π/2, π/2] 로 접는다 — 축(axis)에는 앞뒤가 없다 */
const foldAxisAngle = (rad: number): number => {
  let a = rad % Math.PI
  if (a > Math.PI / 2) a -= Math.PI
  if (a <= -Math.PI / 2) a += Math.PI
  return a
}

/** 장변 벽선 하나 — 밀도 봉우리 근방 점의 전최소자승(TLS) 직선 적합 결과 */
export interface WallLine {
  /** 장축에 수직인 좌표(m) */
  offset: number
  /** 적합에 쓰인 점 수 */
  count: number
  /** 직선 잔차 RMS(m) — '벽면다움'의 척도 */
  residual: number
  /**
   * 장축 방향 **연속 길이**(m) — 짧은 설비 라인과 긴 벽을 가르는 기준.
   *
   * 퍼센타일 폭이 아니라 '점이 실제로 있는 칸의 합'이다: 밴드에는 벽 말고 바닥·부유
   * 점도 섞이는데, 폭으로 재면 그 몇 점이 짧은 라인(갠트리 레일)의 값을 벽만큼 부풀린다.
   * 칸 판정 문턱을 그 밴드 **자신의 최대 칸에 비례**시켜 점 밀도(원본/프리뷰)에 무관하게
   * 같은 값이 나오게 한다 — 실측 자산에서 원본·프리뷰 모두 벽 57~65m / 레일 1.5m 다.
   */
  coverage: number
}

/** 점군에서 유도한 홀 프레임 — display 수평면(x,z) 기준 */
export interface WallFrame {
  /** 홀 장축이 display 수평면에서 이루는 각(rad, (-π/2, π/2]) */
  angle: number
  /** 두 장변 벽선 — offset 오름차순 */
  walls: [WallLine, WallLine]
  /** 벽면 사이 내부 폭(m) — 도면 베이 단변과 대조하는 게이트의 입력 */
  innerWidth: number
  /** 두 벽선 중심선의 offset — 베이 중심선에 맞출 자리 */
  center: number
  /** 두 벽선 각의 편차(rad) — 평행하지 않으면 벽이 아니다(자기검증) */
  angleSpread: number
  /**
   * 장축 양 끝의 끝벽 위치(장축 좌표, m) — `[작은 쪽, 큰 쪽]`. 검출 실패면 null.
   * 홀 내부 띠를 가로지르는 밀도 봉우리를 양 끝에서 찾는다. 종방향 앵커의 근거다.
   */
  endWalls: [number | null, number | null]
}

export interface WallAxisOptions {
  /** 벽 슬랩 하한(m) — 바닥·블록·작업자 위 */
  minHeight?: number
  /** 벽 슬랩 상한(m) — 천장 트러스 아래 */
  maxHeight?: number
  /** 밀도 히스토그램 빈 크기(m) */
  binSize?: number
  /** 봉우리 근방 밴드 반폭(m) — 이 안의 점으로 직선을 적합한다 */
  bandWidth?: number
  /** 두 벽선의 최소 이격(m) — 이보다 가까운 쌍은 같은 벽의 겹줄로 본다 */
  minSeparation?: number
  /** 거친 각도 탐색 간격(도) */
  angleStepDeg?: number
  /** 각도 정련 반복 횟수 */
  refineIterations?: number
  /** 벽선 하나에 필요한 최소 점 수 */
  minWallPoints?: number
}

/** 값 배열을 빈으로 나눴을 때의 최대 빈 점 수 — 거친 각도 탐색의 점수 함수 */
function peakBinCount(values: Float64Array, binSize: number): number {
  let lo = Infinity
  let hi = -Infinity
  for (const v of values) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const bins = Math.max(1, Math.ceil((hi - lo) / binSize) + 1)
  const hist = new Int32Array(bins)
  for (const v of values) hist[Math.floor((v - lo) / binSize)]++
  let max = 0
  for (const h of hist) if (h > max) max = h
  return max
}

/** 정렬된 배열의 백분위 값 (선형 보간 없이 최근접 인덱스 — 수만 점에서 충분하다) */
function percentileOfSorted(sorted: Float64Array, q: number): number {
  if (sorted.length === 0) return NaN
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))
  return sorted[i]
}

/**
 * 점군에서 **장변 벽선 2개**를 뽑아 홀 프레임을 유도한다.
 *
 * 왜 이 방식인가: 센서 대응(12↔12)이 성립하지 않는 데이터셋에서도 앵커를 세우려면
 * 점군 자체의 구조를 근거로 삼아야 한다. 홀의 장변 벽은 **가장 길게 이어지는 평행한 두 선**
 * 이므로, 봉우리 세기가 아니라 **장축 방향 연장**으로 고른다 — 갠트리 레일·자재 열은
 * 점이 더 많아도 짧아서 걸러진다.
 *
 * 절차: ① 수직 투영이 가장 집중되는 방향을 거칠게(각도 전수) 찾고 ② 그 방향의 수직좌표
 * 히스토그램에서 후보 봉우리를 뽑아 ③ `min(연장)` 이 최대인 쌍을 벽으로 확정한 뒤
 * ④ 두 밴드를 TLS 직선으로 적합해 각을 정련한다(②~④ 반복).
 *
 * `points` 는 Float32 xyz 평탄배열(display 프레임, y = 바닥 기준 높이)이다.
 * 반환 각은 (-π/2, π/2] 로 접혀 있어 **앞뒤(180°)는 결정하지 않는다** — 그 1비트는
 * 소비 쪽이 자료(갠트리 그룹 방위 등)로 정한다.
 */
export function fitWallAxis(points: Float32Array, options: WallAxisOptions = {}): WallFrame | null {
  const {
    minHeight = 1.0,
    maxHeight = 7.5,
    binSize = 0.5,
    bandWidth = 0.7,
    minSeparation = 15,
    angleStepDeg = 1,
    refineIterations = 2,
    minWallPoints = 50,
  } = options

  /* ── 벽 슬랩 추출 ── */
  const total = Math.floor(points.length / 3)
  let kept = 0
  for (let i = 0; i < total; i++) {
    const y = points[i * 3 + 1]
    if (y >= minHeight && y <= maxHeight) kept++
  }
  if (kept < 200) return null
  const px = new Float64Array(kept)
  const pz = new Float64Array(kept)
  for (let i = 0, k = 0; i < total; i++) {
    const y = points[i * 3 + 1]
    if (y < minHeight || y > maxHeight) continue
    px[k] = points[i * 3]
    pz[k] = points[i * 3 + 2]
    k++
  }

  /* ── ① 거친 각도 — 수직 투영이 가장 집중되는 방향 ── */
  const scratch = new Float64Array(kept)
  let angle = 0
  let bestScore = -1
  for (let deg = 0; deg < 180; deg += angleStepDeg) {
    const a = (deg * Math.PI) / 180
    const nx = -Math.sin(a)
    const nz = Math.cos(a)
    for (let i = 0; i < kept; i++) scratch[i] = px[i] * nx + pz[i] * nz
    const score = peakBinCount(scratch, binSize)
    if (score > bestScore) {
      bestScore = score
      angle = foldAxisAngle(a)
    }
  }

  /* ── ②~④ 봉우리 선택 + 각 정련 ── */
  const along = new Float64Array(kept)
  const across = new Float64Array(kept)
  let frame: WallFrame | null = null

  for (let iter = 0; iter < Math.max(1, refineIterations); iter++) {
    const ux = Math.cos(angle)
    const uz = Math.sin(angle)
    for (let i = 0; i < kept; i++) {
      along[i] = px[i] * ux + pz[i] * uz
      across[i] = -px[i] * uz + pz[i] * ux
    }

    /* 수직좌표 히스토그램 → 국소 최대 봉우리(최대값의 10% 이상).
     * 양 끝에 빈 칸을 하나씩 덧대는 이유: 국소 최대 판정이 이웃 두 칸을 보므로
     * 패딩이 없으면 **범위 맨 끝에 선 벽**(바깥에 산란점이 없는 벽)이 후보에서 빠진다. */
    let lo = Infinity
    let hi = -Infinity
    for (const v of across) {
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    lo -= binSize
    hi += binSize
    const bins = Math.max(3, Math.ceil((hi - lo) / binSize) + 1)
    const hist = new Int32Array(bins)
    for (const v of across) hist[Math.floor((v - lo) / binSize)]++
    let peak = 0
    for (const h of hist) if (h > peak) peak = h
    const threshold = peak * 0.1

    /* 후보 봉우리마다 밴드 점의 '연속 길이'를 잰다 (WallLine.coverage 주석 참조).
     * 장축 칸 격자는 슬랩 전체 범위로 한 번 잡아 후보끼리 같은 자로 재게 한다. */
    let alongLo = Infinity
    let alongHi = -Infinity
    for (const v of along) {
      if (v < alongLo) alongLo = v
      if (v > alongHi) alongHi = v
    }
    const alongBins = Math.max(1, Math.ceil((alongHi - alongLo) / binSize) + 1)
    const alongHist = new Int32Array(alongBins)
    const candidates: { offset: number; coverage: number; count: number }[] = []
    for (let b = 1; b < bins - 1; b++) {
      if (hist[b] < threshold || hist[b] < hist[b - 1] || hist[b] < hist[b + 1]) continue
      const offset = lo + (b + 0.5) * binSize
      alongHist.fill(0)
      let count = 0
      for (let i = 0; i < kept; i++) {
        if (Math.abs(across[i] - offset) >= bandWidth) continue
        alongHist[Math.floor((along[i] - alongLo) / binSize)]++
        count++
      }
      if (count < minWallPoints) continue
      let peakBin = 0
      for (const h of alongHist) if (h > peakBin) peakBin = h
      const occupied = Math.max(2, peakBin * 0.1)
      let filled = 0
      for (const h of alongHist) if (h >= occupied) filled++
      candidates.push({ offset, coverage: filled * binSize, count })
    }
    if (candidates.length < 2) return null

    /* min(연속 길이)가 최대인 쌍 — 가장 길게 이어지는 평행 두 선이 장변 벽이다.
     * 동점이면 합이 큰 쪽(전체로 더 이어지는 쪽)을 택해 결과를 결정론적으로 둔다. */
    let pair: [number, number] | null = null
    let bestMin = -1
    let bestSum = -1
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        if (Math.abs(candidates[i].offset - candidates[j].offset) < minSeparation) continue
        const min = Math.min(candidates[i].coverage, candidates[j].coverage)
        const sum = candidates[i].coverage + candidates[j].coverage
        if (min > bestMin || (min === bestMin && sum > bestSum)) {
          bestMin = min
          bestSum = sum
          pair = [i, j]
        }
      }
    }
    if (!pair) return null

    /* 밴드별 TLS 직선 적합 — 각·잔차·도심 */
    const fitted = pair.map((index) => {
      const c = candidates[index]
      let sx = 0
      let sz = 0
      let n = 0
      for (let i = 0; i < kept; i++) {
        if (Math.abs(across[i] - c.offset) >= bandWidth) continue
        sx += px[i]
        sz += pz[i]
        n++
      }
      const mx = sx / n
      const mz = sz / n
      let sxx = 0
      let sxz = 0
      let szz = 0
      for (let i = 0; i < kept; i++) {
        if (Math.abs(across[i] - c.offset) >= bandWidth) continue
        const dx = px[i] - mx
        const dz = pz[i] - mz
        sxx += dx * dx
        sxz += dx * dz
        szz += dz * dz
      }
      const a = foldAxisAngle(0.5 * Math.atan2(2 * sxz, sxx - szz))
      const nx = -Math.sin(a)
      const nz = Math.cos(a)
      let sq = 0
      for (let i = 0; i < kept; i++) {
        if (Math.abs(across[i] - c.offset) >= bandWidth) continue
        const d = (px[i] - mx) * nx + (pz[i] - mz) * nz
        sq += d * d
      }
      return {
        angle: a,
        centroid: { x: mx, z: mz },
        count: n,
        residual: Math.sqrt(sq / n),
        coverage: c.coverage,
      }
    })

    /* 점 수 가중 평균 — 긴 벽(점이 많은 쪽)에 더 무게를 준다 */
    const weight = fitted[0].count + fitted[1].count
    angle = foldAxisAngle(
      (fitted[0].angle * fitted[0].count + fitted[1].angle * fitted[1].count) / weight
    )
    const nx = -Math.sin(angle)
    const nz = Math.cos(angle)
    const lines: WallLine[] = fitted.map((f) => ({
      offset: f.centroid.x * nx + f.centroid.z * nz,
      count: f.count,
      residual: f.residual,
      coverage: f.coverage,
    }))
    lines.sort((a, b) => a.offset - b.offset)
    frame = {
      angle,
      walls: [lines[0], lines[1]],
      innerWidth: lines[1].offset - lines[0].offset,
      center: (lines[0].offset + lines[1].offset) / 2,
      angleSpread: Math.abs(foldAxisAngle(fitted[0].angle - fitted[1].angle)),
      endWalls: [null, null],
    }
  }
  if (!frame) return null

  /* ── 끝벽 — 홀 내부 띠에서 장축 양 끝의 밀도 봉우리 ──
   * 끝벽은 "촘촘한 줄"이 아니라 **홀 폭을 가로지르는 줄**이다. 세기만 보면 갠트리 레일의
   * 끝머리 같은 국소 뭉침이 걸리므로, 봉우리 칸의 **수직 방향 폭**까지 함께 본다. */
  const ux = Math.cos(frame.angle)
  const uz = Math.sin(frame.angle)
  const halfInner = frame.innerWidth / 2 - 1
  const innerAlong: number[] = []
  const innerAcross: number[] = []
  for (let i = 0; i < kept; i++) {
    const t = -px[i] * uz + pz[i] * ux
    if (Math.abs(t - frame.center) >= halfInner) continue
    innerAlong.push(px[i] * ux + pz[i] * uz)
    innerAcross.push(t)
  }
  if (innerAlong.length >= 200) {
    const sorted = Float64Array.from(innerAlong).sort()
    const lo = sorted[0] - binSize
    const hi = sorted[sorted.length - 1] + binSize
    const bins = Math.max(3, Math.ceil((hi - lo) / binSize) + 1)
    const hist = new Int32Array(bins)
    for (const v of innerAlong) hist[Math.floor((v - lo) / binSize)]++
    /* 끝벽으로 인정할 최소 세기 — 내부 점의 1% (약한 봉우리는 끝벽이 아니다) */
    const minCount = innerAlong.length * 0.01
    /*
     * 그리고 최소 가로 폭 — 내부 폭의 1/3 은 가로질러야 끝벽이다. 왜 '전폭'이 아닌가:
     * 라이다가 홀 한쪽(남측 갠트리열)에만 서 있으면 먼 쪽 끝은 가려져 끝벽의 절반쯤만
     * 찍힌다(실측: 48%). 반대로 갠트리 레일의 끝머리 같은 국소 뭉침은 23% 라 갈린다.
     * 폭은 퍼센타일이 아니라 **점이 있는 칸의 합**으로 잰다 — 벽은 한쪽으로 쏠려 찍혀도
     * 그 구간이 촘촘히 이어지고, 뭉침은 꼬리만 길다.
     */
    const minSpan = frame.innerWidth / 3
    let acrossLo = Infinity
    let acrossHi = -Infinity
    for (const v of innerAcross) {
      if (v < acrossLo) acrossLo = v
      if (v > acrossHi) acrossHi = v
    }
    const spanBins = Math.max(1, Math.ceil((acrossHi - acrossLo) / binSize) + 1)
    const spanHist = new Int32Array(spanBins)
    const pick = (from: number, to: number): number | null => {
      let best = -1
      let at = -1
      for (let b = from; b <= to; b++) {
        if (hist[b] > best) {
          best = hist[b]
          at = b
        }
      }
      if (at < 0 || best < minCount) return null
      spanHist.fill(0)
      for (let i = 0; i < innerAlong.length; i++) {
        if (Math.floor((innerAlong[i] - lo) / binSize) !== at) continue
        spanHist[Math.floor((innerAcross[i] - acrossLo) / binSize)]++
      }
      let peakBin = 0
      for (const h of spanHist) if (h > peakBin) peakBin = h
      const occupied = Math.max(2, peakBin * 0.1)
      let filled = 0
      for (const h of spanHist) if (h >= occupied) filled++
      return filled * binSize >= minSpan ? lo + (at + 0.5) * binSize : null
    }
    const lowEnd = Math.max(
      0,
      Math.min(bins - 1, Math.floor((percentileOfSorted(sorted, 0.1) - lo) / binSize))
    )
    const highEnd = Math.max(
      0,
      Math.min(bins - 1, Math.floor((percentileOfSorted(sorted, 0.9) - lo) / binSize))
    )
    frame.endWalls = [pick(0, lowEnd), pick(highEnd, bins - 1)]
  }
  return frame
}

/**
 * 벽선 앵커 — display 수평점을 베이 로컬 평면으로 옮기는 매개변수.
 *
 * `displayToBayLocal`(강체 경로)과 **같은 출력 규약**이다: `x` = 베이 폭 방향,
 * `y` = 베이 길이 방향(뷰어의 로컬 z). 회전·횡방향은 벽선이 주고, 종방향(`longitudinalOffset`)
 * 은 이 계층이 알 수 없어 소비 쪽이 규칙으로 채운다.
 */
export interface WallAnchor {
  /** display 수평면에서 베이 +길이 방향을 가리키는 각(rad) — 앞뒤가 정해진 값이다 */
  angle: number
  /** 이 값이 베이 로컬 x = 0 이 된다 (벽 중심선) */
  lateralOrigin: number
  /** 베이 로컬 z = (장축 좌표) + 이 값 */
  longitudinalOffset: number
}

/** display 수평점(x,z) → 베이 로컬 평면. 높이(y)는 양쪽 다 바닥 0 이라 호출 쪽이 그대로 둔다. */
export function wallToBayLocal(anchor: WallAnchor, dx: number, dz: number): Pt2 {
  const c = Math.cos(anchor.angle)
  const s = Math.sin(anchor.angle)
  return {
    x: -dx * s + dz * c - anchor.lateralOrigin,
    y: dx * c + dz * s + anchor.longitudinalOffset,
  }
}
