/*
 * 실측 스캔 앵커 — 실측 자체(display) 프레임을 야드 좌표(EPSG:5187 계열)로 잇는
 * **데이터 유도 변환** (S 분석의 보너스 경로).
 *
 * 근거: 같은 물리 LiDAR 12대가 두 자료에 다 있다 —
 *  - 실측 manifest 의 센서 위치(display 프레임, y-up · 바닥 y=0 · 수평면 = x,z)
 *  - 설비 엔티티의 PBS#5 LiDAR 12대(EPSG:5187 미터, Rev. 도면 이식값)
 * ID↔IP 대응표는 없지만 12↔12 점집합 강체 정합(회전+병진, 반사 후보 포함)으로 변환을
 * 추정할 수 있고, **잔차(RMS)가 스스로 검증한다** — 도면 이식 RMS(0.67~2.24m) 수준이면
 * 같은 배치라는 뜻이고, 크면 도면과 실측 배치가 다른 것이므로 적용하지 않는다(폴백).
 * 임의 앵커(출처 왜곡)를 두지 않기 위한 유일한 경로다.
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
