import { quadContains, type LatLon } from '../model/types'
import { convexHull, minAreaRect } from './footprint'
import { LON_SQUEEZE } from './projection'
import { BAY_ROOF } from './relief'

/**
 * 베이 하나에 씌우는 **박공 지붕**과, 그 지붕 위의 **지번 구획**.
 *
 * 베이는 크레인이 오가는 스팬이므로 지붕은 그 길이 방향으로 **끊기지 않고 이어진다**.
 * 다만 문서(공장-베이-지번 매핑)에서 한 베이는 지번 두~네 장으로 이뤄지고 그 장들이
 * 베이 안의 작업 공간을 가르므로, 이어진 지붕면 위에 그 경계를 **조각(patch)**으로 나눠
 * 둔다 — 부르는 쪽이 조각마다 선을 긋고 색조를 한 단씩 달리해 구분을 보인다.
 *
 * 발자국은 지번 폴리곤을 **합친 그대로**다(공유 변을 지워 만든 경계). 최소 넓이 사각형으로
 * 펴면 폭이 다른 칸이 있는 베이(NPS 3BAY 의 `NP3B01` 은 폭 19m, 나머지는 43m)에서 발자국이
 * 지면의 2D 지번선 밖으로 넘어간다 — 벽이 곧 그 선이어야 3D 와 2D 가 어긋나지 않는다.
 *
 * 높이는 **하나의 규칙**(`ridgeRatio`)으로 정해진다: 용마루선에서 멀수록 낮다. 벽 꼭대기도
 * 같은 규칙을 쓰므로 짧은 끝에서 벽이 용마루까지 솟아 박공 삼각형이 저절로 생긴다.
 */
export interface BayRoof {
  /** 베이 바깥 경계 — 소속 지번을 합친 발자국 */
  outline: LatLon[]
  /** 용마루 — 발자국 안으로 자른 선분 */
  ridge: [LatLon, LatLon]
  /** 용마루가 처마 위로 오르는 높이(m) */
  rise: number
  /** 용마루가 뻗은 방향 — 지붕 면에 글씨를 눕혀 새길 때의 가로축 */
  axis: RoofAxis
  /** 베이 폭(m) */
  width: number
  /** 그 점이 처마(0)와 용마루(1) 사이 어디인가 — 벽·지붕이 함께 쓰는 단일 규칙 */
  ridgeRatio: (point: LatLon) => number
  /**
   * 지붕 조각 — 지번 하나를 용마루로 가른 반쪽들. 같은 지붕면 위에 놓이므로 이어 그리면
   * 한 장으로 보이고, 조각마다 선을 그으면 그 자리가 지번 경계가 된다.
   * `side` 는 용마루 어느 쪽인가(그리는 순서를 정할 때 쓴다).
   */
  patches: { lot: string; index: number; side: 0 | 1; polygon: LatLon[] }[]
}

/** 용마루 방향 — 경도를 누른 평면에서의 단위벡터 */
export interface RoofAxis {
  x: number
  y: number
}

/** 위도 1도의 대략적인 미터 — 폭·길이를 재는 데만 쓴다(정밀도 불필요) */
const METERS_PER_DEGREE = 111_320

const flatten = (p: LatLon) => ({ x: p.lon * LON_SQUEEZE, y: p.lat })
const unflatten = (x: number, y: number): LatLon => ({ lat: y, lon: x / LON_SQUEEZE })

/**
 * 최소 넓이 회전 사각형이 알려 주는 것 — 긴 축과 **그 축을 얼마나 믿을 수 있는가**.
 *
 * 길쭉한 발자국의 긴 축은 곧 그 건물의 방향이지만, 정사각형에 가까운 발자국에서는
 * 긴 변과 짧은 변의 차이가 반올림 수준이라 축이 90° 를 오간다. 두 변 길이를 함께
 * 내주면 부르는 쪽이 "이 축은 잡음"이라고 판단할 수 있다 (`alignedAxes` 가 그렇게 쓴다).
 */
export interface OrientedExtent {
  axis: RoofAxis
  /** 긴 변 (경도를 누른 평면에서의 길이 — 상대 비교용) */
  long: number
  /** 짧은 변 */
  short: number
}

/** 폴리곤의 최소 넓이 회전 사각형에서 긴 축과 두 변 길이를 뽑는다 */
export function orientedExtentOf(polygon: readonly LatLon[]): OrientedExtent | null {
  const rect = minAreaRect(polygon)
  if (rect.length !== 4) return null
  const [r0, r1, r2] = rect.map(flatten)
  const e1 = { x: r1.x - r0.x, y: r1.y - r0.y }
  const e2 = { x: r2.x - r1.x, y: r2.y - r1.y }
  const len1 = Math.hypot(e1.x, e1.y)
  const len2 = Math.hypot(e2.x, e2.y)
  const [long, len, short] = len1 >= len2 ? [e1, len1, len2] : [e2, len2, len1]
  if (len === 0) return null
  return { axis: { x: long.x / len, y: long.y / len }, long: len, short }
}

/** 폴리곤의 최소 넓이 회전 사각형에서 긴 축을 뽑는다 */
export function axisOf(polygon: readonly LatLon[]): RoofAxis | null {
  return orientedExtentOf(polygon)?.axis ?? null
}

/* ── 축 맞추기 ── */

/** 축을 [0, π) 각도로 — 용마루에는 앞뒤가 없으므로 180° 는 같은 방향이다 */
const angleOf = (axis: RoofAxis) => ((Math.atan2(axis.y, axis.x) % Math.PI) + Math.PI) % Math.PI

/** 두 각의 거리 — π 를 한 바퀴로 보는 원형 거리 */
const angleGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % Math.PI
  return Math.min(d, Math.PI - d)
}

const toRadians = (deg: number) => (deg * Math.PI) / 180

/**
 * 축을 믿고 **무리를 열 수 있는** 최소 길쭉함. 이보다 반듯하면 긴 축이 반올림 수준의
 * 차이로 정해져, 그 방향으로 남을 끌어당기면 안 된다.
 */
const SEED_ELONGATION = 1.2

/**
 * 제 축으로 **방향을 고를 수 있는** 최소 길쭉함. 이보다 반듯한 칸은 긴 축이 90° 를
 * 오가므로 제 축 대신 이웃이 놓인 방향을 본다 (아래 alignedAxes 주석).
 */
const OWN_AXIS_ELONGATION = 1.35

/** 무리의 방향을 다듬을 때 평균에 넣을 범위(도) — 이보다 벌어진 회원은 기준을 끌지 못한다 */
const REFINE_DEGREES = 6

/**
 * 베이가 제 건물의 **깊이를 혼자 채운다**고 볼 최대 배율 (건물 깊이 ÷ 베이 폭).
 *
 * 건물 실측으로 베이를 눕힐지 정할 때의 잣대다(`straightenBayFootprints`). 이보다 깊은
 * 건물은 스팬이 둘 이상 나란히 든 다중 스팬 동이므로, 그 건물의 긴 축은 용마루가 아니라
 * 스팬이 늘어선 방향이다. 실제 값은 1.13(1DOCK A5·A6 — 혼자 든다)과 2.02(GPS 4·5BAY —
 * 스팬 셋이 든다)로 뚜렷이 갈려, 그 사이 어디를 잡아도 같은 판정이 나온다.
 */
const BUILDING_DEPTH_FILL = 1.5

/** 베이 하나의 방향 단서 — 제 발자국과, 이웃이 어디 붙어 있는지 */
export interface BayAxisInput {
  /** 발자국의 최소 넓이 사각형. 없으면(축을 못 구했으면) 방향도 없다 */
  extent: OrientedExtent | null
  /** 발자국 중심 — 이웃이 어느 쪽에 붙어 있는지 재는 데 쓴다 */
  center: LatLon
}

/**
 * 한 공장 안 베이들의 **용마루 방향을 서로 맞춘다** — 나란해야 할 것이 나란해 보이도록.
 *
 * 베이마다 제 발자국의 긴 축을 그대로 쓰면 같은 건물 안에서 지붕이 몇 도씩 어긋나 톱니처럼
 * 삐뚤어 보인다. 원본 지번이 저마다 반올림되어 긴 축이 흔들리고, 무엇보다 **정사각형에
 * 가까운 칸은 긴 축이 90° 를 오간다**(1DOCK 도장공장의 낱개 셀은 30×28 이라 이웃과 지붕이
 * 직각으로 엇갈렸다). 그렇다고 공장 하나에 축 하나를 강제하면 직각으로 붙은 동(2DOCK 의
 * D3·D4)이 건물 가로로 눕는다.
 *
 * 그래서 두 단계로 맞춘다.
 *
 * **하나, 방향의 후보를 무리로 세운다.** 길쭉해서 축을 믿을 만한 베이들만 무리를 열고
 * (SEED_ELONGATION), 가장 확실한 것(길이 차 × 길이가 큰 것)이 그 무리의 방향을 잡는다.
 * 이어 그 방향 가까이(REFINE_DEGREES) 있는 회원만 가중 평균해 다듬는다 — 한둘 비뚤어진
 * 발자국이 무리 전체를 몇 도 끌고 가지 않게 한다.
 *
 * **둘, 각 베이가 무리를 고른다.** 길쭉한 베이는 제 축에 가장 가까운 무리를 고르면 된다.
 * 반듯한 칸은 제 축이 잡음이므로 대신 **이웃이 놓인 방향**을 본다: 베이는 용마루를 가로질러
 * 나란히 붙으므로, 가장 가까운 이웃으로 향하는 방향에 **직각인** 쪽이 그 칸의 용마루다.
 * 이 규칙이 1DOCK 의 낱개 셀 25칸을 두 방향으로 나란히 정렬시킨다 — 칸마다 제 지붕이
 * 줄을 가로질러 서고, 그것이 그 칸들의 실제 긴 쪽이기도 하다.
 *
 * 축을 못 구한 자리(null)는 null 그대로 돌려준다 — 없는 방향을 지어내지 않는다.
 */
export function alignedAxes(
  bays: readonly BayAxisInput[],
  toleranceDeg = 22
): (RoofAxis | null)[] {
  const tolerance = toRadians(toleranceDeg)
  const refine = toRadians(REFINE_DEGREES)

  const entries = bays.map((bay) => {
    const extent = bay.extent
    if (!extent || extent.short <= 0) return null
    return {
      axis: extent.axis,
      angle: angleOf(extent.axis),
      ratio: extent.long / extent.short,
      weight: (extent.long - extent.short) * extent.long,
      center: flatten(bay.center),
    }
  })

  /* 하나 — 확실한 것부터 무리를 연다. 무리의 방향은 그 무리를 연 베이가 잡는다 */
  const clusters: { angle: number; members: { angle: number; weight: number }[] }[] = []
  const seeds = entries
    .flatMap((entry) => (entry && entry.ratio >= SEED_ELONGATION ? [entry] : []))
    .sort((a, b) => b.weight - a.weight)
  for (const seed of seeds) {
    const near = clusters.find((cluster) => angleGap(cluster.angle, seed.angle) <= tolerance)
    if (near) near.members.push(seed)
    else clusters.push({ angle: seed.angle, members: [seed] })
  }
  /* 다듬기 — 무리를 연 방향 가까이 있는 회원만 평균한다.
     누적은 2θ 로 한다: θ 와 θ+π 는 같은 방향이라 그대로 더하면 서로를 지운다 */
  for (const cluster of clusters) {
    let cos = 0
    let sin = 0
    for (const member of cluster.members) {
      if (angleGap(member.angle, cluster.angle) > refine) continue
      cos += member.weight * Math.cos(2 * member.angle)
      sin += member.weight * Math.sin(2 * member.angle)
    }
    if (cos !== 0 || sin !== 0) {
      cluster.angle = (((Math.atan2(sin, cos) / 2) % Math.PI) + Math.PI) % Math.PI
    }
  }

  if (clusters.length === 0) return entries.map((entry) => entry?.axis ?? null)

  /** 가장 가까운 이웃이 놓인 방향에 직각인 각 — 반듯한 칸이 방향을 고르는 단서 */
  const acrossNeighbour = (index: number): number | null => {
    const self = entries[index]
    if (!self) return null
    let along: { x: number; y: number } | null = null
    let nearest = Infinity
    for (let i = 0; i < entries.length; i++) {
      const other = entries[i]
      if (i === index || !other) continue
      const dx = other.center.x - self.center.x
      const dy = other.center.y - self.center.y
      const distance = Math.hypot(dx, dy)
      if (distance > 0 && distance < nearest) {
        nearest = distance
        along = { x: dx, y: dy }
      }
    }
    return along ? angleOf({ x: -along.y, y: along.x }) : null
  }

  return entries.map((entry, index) => {
    if (!entry) return null
    const hint =
      entry.ratio >= OWN_AXIS_ELONGATION ? entry.angle : (acrossNeighbour(index) ?? entry.angle)
    let picked = clusters[0].angle
    let gap = angleGap(picked, hint)
    for (const cluster of clusters) {
      const candidate = angleGap(cluster.angle, hint)
      if (candidate < gap) {
        gap = candidate
        picked = cluster.angle
      }
    }
    return { x: Math.cos(picked), y: Math.sin(picked) }
  })
}

/**
 * 이 한 채의 **용마루 방향**을 고른다 — 잣대는 하나다: **제 긴 쪽**.
 *
 * 지붕은 용마루를 가운데 두고 대칭이므로(`bayRoofOf` 가 발자국의 한가운데를 용마루로
 * 잡는다), 용마루가 긴 쪽과 나란해야 두 지붕면이 긴 면을 따라 흐르고 짧은 끝에 박공이
 * 선다. 짧은 쪽에 놓으면 같은 건물이 폭으로 갈라져, 긴 복도 위에 지붕을 가로로 얹은
 * 꼴이 된다.
 *
 * 그래서 다른 두 잣대는 **제 긴 쪽을 다듬을 때만** 받는다 —
 *
 * - `measured`(제 건물 OSM 발자국의 긴 축)는 실측이지만, 스팬이 여럿 나란히 든 동에서는
 *   그 긴 축이 **스팬을 가로지른다**. 옥포에서 이것이 145채 중 55채의 용마루를 정확히
 *   90° 돌려놓고 있었다(CTS 1~4베이는 3.8:1 로 길쭉한데 용마루가 폭 쪽으로 누웠다).
 * - `aligned`(이웃과 맞춘 격자 추정)는 나란해야 할 것을 정확히 나란하게 만들지만,
 *   반듯한 칸에서는 이웃 방향을 보고 축을 90° 뒤집어 준다(`alignedAxes`).
 *
 * 둘 중 제 긴 쪽에 **45° 안으로** 붙은 것이 있으면 그중 가장 가까운 것을 받아 쓴다 —
 * 몇 도 차이는 원본의 반올림이라, 이웃과 같은 값으로 맞추는 편이 톱니를 없앤다. 둘 다
 * 그보다 벌어져 있으면 — 곧 용마루를 눕히라는 뜻이면 — 받지 않고 제 긴 쪽을 쓴다.
 *
 * 긴 쪽이 없는 **반듯한 칸**(30×28 짜리 도장 셀)은 제 축이 잡음이라 남의 잣대에 맡기는데,
 * 이때는 **이웃(`aligned`)이 실측(`measured`)보다 앞선다**. 낱개 칸이 줄지어 한 동을 이루는
 * 곳에서 건물의 긴 축은 칸의 방향이 아니라 **줄의 방향**이라, 그것을 용마루로 삼으면 한
 * 채씩 서야 할 칸들이 지붕 한 장으로 이어져 버린다(1DOCK 도장공장이 그랬다). 이웃 잣대는
 * 반대로 "가장 가까운 이웃으로 향하는 방향에 직각"을 보므로(`alignedAxes`) 칸마다 제
 * 지붕이 줄을 가로질러 선다 — 그 칸들의 실제 긴 쪽과도 같은 방향이다.
 *
 * 반듯한가를 가르는 잣대는 `alignedAxes` 와 **같은 것**(`OWN_AXIS_ELONGATION`)을 쓴다.
 * 두 곳이 묻는 것이 같은 질문("이 도형의 긴 축을 믿어도 되는가")이라, 잣대가 어긋나면
 * 그 사이에 낀 칸이 저 혼자 이웃과 직각으로 선다 — 1DOCK B6 은 1.16 으로 낮은 문턱만
 * 넘어, 같은 줄의 B7~B12(1.03~1.12)가 줄을 가로지르는데 혼자 줄을 따라 누웠다.
 */
export function ridgeAxisOf(input: {
  /** 이 한 채의 발자국 치수 — 없으면(축을 못 구했으면) 남의 잣대에 맡긴다 */
  own: OrientedExtent | null
  /** 제 건물 OSM 발자국의 긴 축 (`ringExtentAround`) */
  measured?: RoofAxis | null
  /** 공장 안 이웃과 맞춘 격자 추정 (`alignedAxes`) */
  aligned?: RoofAxis | null
}): RoofAxis | null {
  const { own, measured = null, aligned = null } = input
  if (!own) return measured ?? aligned ?? null
  if (own.short <= 0 || own.long / own.short < OWN_AXIS_ELONGATION)
    return aligned ?? measured ?? own.axis

  const target = angleOf(own.axis)
  let picked = own.axis
  let best = Infinity
  for (const candidate of [measured, aligned]) {
    if (!candidate) continue
    const gap = angleGap(angleOf(candidate), target)
    if (gap < best) {
      best = gap
      picked = candidate
    }
  }
  return best <= Math.PI / 4 ? picked : own.axis
}

/**
 * 발자국을 정해진 축에 맞춰 **똑바로 세운다** — 중심은 그대로 두고 최소각만큼만 돌린다.
 *
 * 지번 폴리곤 대부분은 야드 격자 위에 반듯이 놓여 있지만, 원본을 디지타이징할 때 몇 장이
 * 격자에서 돌아간 채로 들어와 있다(1DOCK 도장공장의 A5·A6·B7·B9·B11 은 11° 틀어져,
 * 같은 줄에 선 이웃과 벽이 어긋난 채 서 있었다). 그 몇 장을 제 무리의 축으로 돌려 세우면
 * 건물이 위성사진처럼 한 줄로 반듯하게 선다.
 *
 * **돌리는 각은 90° 로 접어 ±45° 안에서 고른다.** 사각형은 90° 대칭이라 그 이상 돌릴 이유가
 * 없고, 무엇보다 반듯한 칸은 이웃을 보고 축을 90° 뒤집어 받는데(`alignedAxes`) 그 차이를
 * 그대로 돌리면 멀쩡한 건물이 90° 자빠진다.
 *
 * 크기와 모양은 손대지 않는다 — 실측에서 온 값이라 여기서 고칠 근거가 없다. 회전만으로도
 * 벽이 이웃과 나란해지고, 같은 폴리곤을 지면의 2D 지번선도 함께 쓰므로 3D 와 어긋나지 않는다.
 *
 * 돌릴 것이 없으면 `null` 이다 — 부르는 쪽이 원본을 그대로 쓰라는 뜻이고, 멀쩡한 폴리곤을
 * 사본으로 갈아치워 참조 비교와 경계 상자 계산을 헛돌게 하지 않는다.
 */
export function straightenToAxis(
  polygons: readonly (readonly LatLon[])[],
  axis: RoofAxis | null,
  /**
   * true(기본)면 회전각을 90° 로 접어 ±45° 안에서 고른다 — 반듯한 칸이 축 뒤집힘으로
   * 자빠지지 않게. false 면 **긴 축을 목표 축에 그대로** 맞춘다(±90° 안) — 셀이 건물에
   * 세로로 안 들어가 눕혀야 할 때 쓴다 (straightenBayFootprints 참조).
   */
  foldQuarter = true
): LatLon[][] | null {
  if (!axis) return null
  const points = polygons.flat()
  if (points.length < 3) return null
  const own = orientedExtentOf(convexHull([...points]))
  if (!own) return null

  /* 목표까지의 회전각 — 기본은 90° 로 접은 최소각, 눕히기는 긴 축을 곧장 맞춘다 */
  const quarter = Math.PI / 2
  const fold = foldQuarter ? quarter : Math.PI
  let turn = (angleOf(axis) - angleOf(own.axis)) % fold
  if (turn > fold / 2) turn -= fold
  if (turn < -fold / 2) turn += fold
  /* 0.2° 아래면 격자 위에 이미 서 있다 — 좌표를 흔들지 않는다(null = 그대로 쓰라는 뜻) */
  if (Math.abs(turn) < toRadians(0.2)) return null

  const flat = points.map(flatten)
  const center = {
    x: flat.reduce((sum, p) => sum + p.x, 0) / flat.length,
    y: flat.reduce((sum, p) => sum + p.y, 0) / flat.length,
  }
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  return polygons.map((polygon) =>
    polygon.map((p) => {
      const q = flatten(p)
      const dx = q.x - center.x
      const dy = q.y - center.y
      return unflatten(center.x + dx * cos - dy * sin, center.y + dx * sin + dy * cos)
    })
  )
}

/**
 * 서로 **맞닿아 이어진** 지번끼리 묶는다 — 인덱스 그룹 목록을 돌려준다.
 *
 * 원본(공장-베이-지번 매핑)의 한 베이는 늘 한 덩어리가 아니다: SSY 의 베이는 도로로
 * 끊긴 **줄 서너 토막**이고(원본의 `지번인접여부(3m)` 열이 "분리(3개 그룹)"라고 적는
 * 그 구조다 — 1~4베이 3토막, 5베이 4토막), 토막들을 한 덩어리로 다루면 볼록 껍질이
 * 길 건너까지 삼켜 이웃 베이와 겹치고, 지붕끼리 교차해 화면이 깨진다. 여기서 갈라야
 * 2D 칸도 3D 지붕도 제 토막 위에만 선다.
 *
 * 붙었다고 보는 거리는 원본과 같은 **3m** — 실틈(원본의 지번별 반올림)은 잇고
 * 도로(SSY 는 토막 사이가 9m 이상)는 가른다. 꼭짓점끼리만 재지 않고 꼭짓점↔변 거리로
 * 잰다: 폭이 다른 칸은 변의 일부만 맞닿아 꼭짓점이 서로 멀 수 있다(NPS 3BAY 의 19m
 * 칸이 43m 칸에 붙는 식).
 */
export function adjacentLotGroups(
  polygons: readonly (readonly LatLon[])[],
  gapMeters = 3
): number[][] {
  const gap = gapMeters / METERS_PER_DEGREE
  const flats = polygons.map((polygon) => polygon.map(flatten))
  const boxes = flats.map((pts) => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const p of pts) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    return { minX, minY, maxX, maxY }
  })

  /** 점 p 에서 변 (a,b) 까지의 거리 — 경도를 누른 평면에서 잰다 */
  const distToEdge = (
    p: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number }
  ) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
  }
  /** i 의 꼭짓점 하나라도 j 의 변에 gap 안으로 닿는가 */
  const verticesTouch = (i: number, j: number) => {
    for (const p of flats[i]) {
      for (let k = 0; k < flats[j].length; k++) {
        if (distToEdge(p, flats[j][k], flats[j][(k + 1) % flats[j].length]) <= gap) return true
      }
    }
    return false
  }
  const touches = (i: number, j: number) => {
    const a = boxes[i]
    const b = boxes[j]
    if (
      a.minX > b.maxX + gap ||
      b.minX > a.maxX + gap ||
      a.minY > b.maxY + gap ||
      b.minY > a.maxY + gap
    )
      return false
    return verticesTouch(i, j) || verticesTouch(j, i)
  }

  /* union-find — 베이 하나는 지번 수십 장이라 단순한 것으로 충분하다 */
  const parent = polygons.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < polygons.length; i++) {
    for (let j = i + 1; j < polygons.length; j++) {
      if (find(i) !== find(j) && touches(i, j)) parent[find(j)] = find(i)
    }
  }
  const groups = new Map<number, number[]>()
  for (let i = 0; i < polygons.length; i++) {
    const root = find(i)
    const list = groups.get(root)
    if (list) list.push(i)
    else groups.set(root, [i])
  }
  return [...groups.values()]
}

/**
 * **베이 매핑이 없는 공장**의 지번을 맞닿은 것끼리 묶는다 — 부르는 쪽이 이 묶음마다
 * 박공을 세워, 그 공장이 지붕 없는 평지로 남지 않게 한다.
 *
 * 잣대는 **베이 매핑이 그 공장에 있는가**다(`hasBays`).
 *
 * - **있으면 베이가 곧 건물의 목록이다.** 매핑 밖에 남은 지번은 세우지 않는다 — 그 자리는
 *   마당·통로·옥외 적치이지 건물이 아니고, 세우면 이름 없는 덩어리가 베이들 옆에 서서
 *   무엇인지 물을 수 없는 것이 된다(CTS 8베이 자리 3장·POS 1공장 옥외의장 6장·3DS
 *   정련동 1장이 그렇게 서 있었다).
 * - **없으면 그 공장은 아무것도 서지 않아** 평지붕 판 한 장으로 남는다(형강·T-BAR
 *   절단공장). 그때는 소속 지번이 곧 그 공장의 동이므로 그것을 세운다. 베이를 아예
 *   주지 않는 화면(도장 화면)이 대시보드와 같은 모습이 되는 것도 이 갈래다.
 *
 * 그 밖에 셋을 더 거른다 — 이미 베이로 선 지번(`spanned`), **남의 공장 지번**(한 지번이
 * 여러 공장에 속할 수 있어, 첫 소유 공장만 세우지 않으면 같은 자리에 두 채가 선다),
 * 도형이 없는 지번. 남은 것은 `adjacentLotGroups` 로 갈라 **떨어져 선 동을 한 지붕으로
 * 잇지 않는다** — 이으면 그 사이 빈 마당까지 건물이 된다.
 */
export function unmappedFactoryLots(
  factory: { name: string; lotCodes: readonly string[] },
  source: {
    /** 이 공장에 베이 매핑이 있는가 — 있으면 베이만 서고 나머지는 지면으로 남는다 */
    hasBays: boolean
    /** 이미 베이 스팬으로 선 지번 */
    spanned: ReadonlySet<string>
    /** 지번 → 첫 소유 공장 */
    ownerOf: ReadonlyMap<string, string>
    /** 지번 → 발자국 */
    polygonOf: ReadonlyMap<string, LatLon[]>
  }
): { lot: string; polygon: LatLon[] }[][] {
  if (source.hasBays) return []
  const rest: { lot: string; polygon: LatLon[] }[] = []
  for (const lot of factory.lotCodes) {
    if (source.spanned.has(lot)) continue
    if (source.ownerOf.get(lot) !== factory.name) continue
    const polygon = source.polygonOf.get(lot)
    if (polygon && polygon.length >= 3) rest.push({ lot, polygon })
  }
  if (rest.length === 0) return []
  return adjacentLotGroups(rest.map((entry) => entry.polygon)).map((indices) =>
    indices.map((k) => rest[k])
  )
}

/**
 * 한 야드의 **베이 발자국을 전부 격자에 맞춰 세운다** — 지번코드 → 돌려 세운 폴리곤.
 *
 * 공장마다 축을 맞춘 뒤(`alignedAxes`) 그 축으로 발자국을 돌린다(`straightenToAxis`).
 * 이미 나란한 지번은 담기지 않으므로, 부르는 쪽은 `?? 원본` 으로 받으면 된다 — 129개 베이
 * 중 실제로 돌아가는 것은 여덟이라, 나머지 좌표를 사본으로 갈아치우지 않는 편이 낫다.
 *
 * 함께 도는 단위는 베이가 아니라 **베이 안의 인접 그룹**(`adjacentLotGroups`)이다 —
 * 도로로 끊긴 토막들(SSY)을 한 몸으로 돌리면 제자리에 서 있던 토막까지 끌려 돈다.
 *
 * 이 결과 하나를 지면의 2D 지번선·3D 벽·히트테스트가 함께 써야 서로 어긋나지 않는다.
 */
export function straightenBayFootprints(
  lots: readonly { lot: string; polygon: LatLon[] }[],
  bays:
    | readonly {
        factory: string
        lotCodes: readonly string[]
        /** 이 베이가 통째로 들어앉은 건물의 실측 치수 (ringExtentAround) */
        building?: OrientedExtent | null
      }[]
    | undefined
): Map<string, LatLon[]> {
  const out = new Map<string, LatLon[]>()
  if (!bays || bays.length === 0) return out

  const polygonOf = new Map(lots.map((lot) => [lot.lot, lot.polygon]))
  const byFactory = new Map<
    string,
    { codes: string[]; polygons: LatLon[][]; building: OrientedExtent | null }[]
  >()
  for (const bay of bays) {
    const codes: string[] = []
    const polygons: LatLon[][] = []
    for (const code of bay.lotCodes) {
      const polygon = polygonOf.get(code)
      if (!polygon || polygon.length < 3) continue
      codes.push(code)
      polygons.push(polygon)
    }
    if (polygons.length === 0) continue
    const list = byFactory.get(bay.factory) ?? []
    /* 도로로 끊긴 베이는 토막마다 제 몸으로 돈다 — 건물 실측은 베이의 것을 함께 물려받는다 */
    for (const indices of adjacentLotGroups(polygons)) {
      list.push({
        codes: indices.map((k) => codes[k]),
        polygons: indices.map((k) => polygons[k]),
        building: bay.building ?? null,
      })
    }
    byFactory.set(bay.factory, list)
  }

  for (const drafts of byFactory.values()) {
    const hulls = drafts.map((draft) => convexHull(draft.polygons.flat()))
    const axes = alignedAxes(
      hulls.map((hull) => ({ extent: orientedExtentOf(hull), center: centerOfPoints(hull) }))
    )
    drafts.forEach((draft, index) => {
      const building = draft.building
      let turned: LatLon[][] | null
      if (building) {
        /*
         * 실측(제 건물)이 있으면 격자 추정보다 앞선다. 셀이 건물에 **세로로 들어가는가**로
         * 접기를 고른다: 셀의 긴 변이 건물의 짧은 변보다 길면 세울 자리가 없으므로 긴 축을
         * 건물의 긴 축에 눕혀 맞춘다 — 1DOCK A5·A6 은 32.5m 셀이 깊이 22.6m 건물에 든
         * 경우라, 눕히면 두 셀(32.5+31.2m)이 건물 길이 64.2m 를 정확히 채운다.
         *
         * 다만 **그 베이가 건물 깊이를 혼자 채울 때만** 그렇다(`fillsDepth`). 건물이 베이보다
         * 훨씬 깊으면 그 건물은 스팬 여러 채가 나란히 든 다중 스팬 동이고, 건물의 긴 축은
         * 용마루가 아니라 **스팬이 늘어선 방향**이다 — 거기에 눕히면 베이가 이웃 스팬을
         * 가로질러 90° 자빠진다(GPS 4·5BAY: 78.5m 스팬 셋이 96.8×65.0m 건물에 나란히 든다).
         */
        const own = orientedExtentOf(convexHull(draft.polygons.flat()))
        const fillsDepth = own != null && building.short < own.short * BUILDING_DEPTH_FILL
        const mustLie = own != null && own.long > building.short && fillsDepth
        turned = straightenToAxis(draft.polygons, building.axis, !mustLie)
      } else {
        turned = straightenToAxis(draft.polygons, axes[index])
      }
      if (!turned) return
      draft.codes.forEach((code, k) => out.set(code, turned[k]))
    })
  }
  return out
}

/**
 * 이 점들을 **모두 품는 건물 링**의 긴 축 — 베이가 실제로 들어앉은 건물의 방향.
 *
 * 격자 정렬(`alignedAxes`)은 "나란한 것은 나란하게"라는 추정이고, OSM 건물 발자국은
 * **실측**이다. 베이의 지번이 전부 한 건물 안에 들어 있으면 그 건물의 방향이 정답이므로
 * 추정을 덮는다 — 1DOCK A5·A6 은 건물 자체가 야드 격자에서 11° 돌아앉아 있어, 격자로
 * 세우면 오히려 제 건물 밖으로 비어져 나온다.
 *
 * 품는 건물이 없으면(무건물 지번, 링 미보유 지역) null — 그때는 격자 정렬이 잣대다.
 */
export function ringExtentAround(
  centroids: readonly LatLon[],
  rings: readonly (readonly (readonly [number, number])[])[]
): OrientedExtent | null {
  if (centroids.length === 0) return null
  for (const ring of rings) {
    if (ring.length < 3) continue
    let minLat = Infinity
    let minLon = Infinity
    let maxLat = -Infinity
    let maxLon = -Infinity
    for (const [x, y] of ring) {
      if (y < minLat) minLat = y
      if (y > maxLat) maxLat = y
      if (x < minLon) minLon = x
      if (x > maxLon) maxLon = x
    }
    const inBox = centroids.every(
      (c) => c.lat >= minLat && c.lat <= maxLat && c.lon >= minLon && c.lon <= maxLon
    )
    if (!inBox) continue
    const polygon = ring.map(([x, y]) => ({ lat: y, lon: x }))
    if (!centroids.every((c) => quadContains(polygon, c.lat, c.lon))) continue
    return orientedExtentOf(convexHull(polygon))
  }
  return null
}

/** 좌표를 키로 — 지번 폴리곤은 같은 fixture 에서 나와 맞닿은 꼭짓점이 정확히 같다 */
const keyOf = (p: LatLon) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`

/**
 * 같은 자리로 볼 거리(도, 약 0.7m).
 *
 * 원본이 지번마다 따로 반올림해서, 맞닿은 두 지번의 같은 모서리가 0.4m 쯤 어긋나 있다
 * (NPS 1BAY 의 `NP1B01`/`NP1B02` 이음매). 그대로 두면 공유 변이 짝지어지지 않아 안쪽
 * 변이 경계로 남는다. 지번 모서리끼리는 최소 19m 떨어져 있어 이 정도로는 엉키지 않는다.
 */
const SNAP = 6e-6

/** 꼭짓점이 변 위에 있다고 볼 거리 — 붙었다고 보는 거리와 같은 잣대를 쓴다 */
const ON_EDGE = SNAP

/**
 * 폴리곤들의 꼭짓점을 서로 붙여 준다 — 가까운 것끼리 한 자리로 모은다.
 * 이어 그 자리를 공유하는 변이 짝지어져 안쪽 변으로 지워질 수 있다.
 */
export function snapPolygons(
  polygons: readonly (readonly LatLon[])[]
): LatLon[][] {
  const reps: LatLon[] = []
  const repOf = (p: LatLon): LatLon => {
    for (const rep of reps) {
      if (Math.abs(rep.lat - p.lat) <= SNAP && Math.abs(rep.lon - p.lon) <= SNAP) return rep
    }
    reps.push(p)
    return p
  }
  return polygons.map((polygon) => polygon.map(repOf))
}

/**
 * 맞닿은 폴리곤들의 **바깥 경계**. 두 번 나온 변(= 이웃과 공유하는 안쪽 변)을 지우고
 * 남은 변을 이어 고리를 만든다. 이어 붙지 않으면(자료가 어긋나면) null 을 돌려주고
 * 부르는 쪽이 볼록 껍질로 갈음한다 — 경계를 못 만든다고 화면이 비면 안 된다.
 *
 * 세기 전에 **변을 쪼갠다**(noding): 이웃과 폭이 다른 칸은 변의 일부만 맞닿아 있어
 * (NPS 3BAY 의 19m 칸이 43m 칸에 붙는 식) 통째로는 짝이 지어지지 않는다. 그 상태로 세면
 * 안쪽 변이 남아 경계가 엉키고, 결국 볼록 껍질로 물러나 발자국이 지번선 밖으로 부푼다.
 */
export function outlineOf(input: readonly (readonly LatLon[])[]): LatLon[] | null {
  const polygons = snapPolygons(input)
  /* 모든 꼭짓점 — 변을 쪼갤 자리의 후보 */
  const vertices = new Map<string, LatLon>()
  for (const polygon of polygons) for (const p of polygon) vertices.set(keyOf(p), p)
  const points = [...vertices.values()]

  /** 변 (a,b) 를 그 위에 놓인 다른 꼭짓점들로 쪼갠다 */
  const split = (a: LatLon, b: LatLon): LatLon[] => {
    const dLat = b.lat - a.lat
    const dLon = b.lon - a.lon
    const len2 = dLat * dLat + dLon * dLon
    if (len2 === 0) return [a, b]
    const on: { t: number; p: LatLon }[] = []
    for (const p of points) {
      const t = ((p.lat - a.lat) * dLat + (p.lon - a.lon) * dLon) / len2
      if (t <= 1e-9 || t >= 1 - 1e-9) continue
      const off = Math.hypot(p.lat - (a.lat + dLat * t), p.lon - (a.lon + dLon * t))
      if (off <= ON_EDGE) on.push({ t, p })
    }
    on.sort((x, y) => x.t - y.t)
    return [a, ...on.map((x) => x.p), b]
  }

  const edges = new Map<string, { a: LatLon; b: LatLon; count: number }>()
  for (const polygon of polygons) {
    for (let i = 0; i < polygon.length; i++) {
      const chain = split(polygon[i], polygon[(i + 1) % polygon.length])
      for (let k = 0; k + 1 < chain.length; k++) {
        const ka = keyOf(chain[k])
        const kb = keyOf(chain[k + 1])
        if (ka === kb) continue
        const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
        const found = edges.get(key)
        if (found) found.count++
        else edges.set(key, { a: chain[k], b: chain[k + 1], count: 1 })
      }
    }
  }

  /* 꼭짓점 → 거기서 뻗은 바깥 변의 반대쪽 끝 */
  const from = new Map<string, LatLon[]>()
  const boundary = [...edges.values()].filter((edge) => edge.count === 1)
  if (boundary.length < 3) return null
  for (const edge of boundary) {
    for (const [p, q] of [
      [edge.a, edge.b],
      [edge.b, edge.a],
    ] as const) {
      const key = keyOf(p)
      const list = from.get(key)
      if (list) list.push(q)
      else from.set(key, [q])
    }
  }
  /* 단순한 고리가 아니면(갈래가 지면) 물러난다 — 잘못 이은 경계보다 껍질이 낫다 */
  for (const list of from.values()) if (list.length !== 2) return null

  const start = boundary[0].a
  const ring: LatLon[] = [start]
  const visited = new Set<string>([keyOf(start)])
  let current = start
  while (ring.length < boundary.length) {
    const next = from.get(keyOf(current))?.find((p) => !visited.has(keyOf(p)))
    if (!next) break
    ring.push(next)
    visited.add(keyOf(next))
    current = next
  }
  /* 고리가 닫히지 않았으면(변을 다 쓰지 못했으면) 실패 */
  return ring.length === boundary.length ? ring : null
}

/**
 * 베이의 지번들 → 이어진 박공 지붕. 지번이 하나도 없거나 축을 못 구하면 null.
 *
 * `axis` 를 주면 그 방향으로 용마루를 놓는다(공장 안에서 스팬 방향을 맞추고 싶을 때).
 * 안 주면 발자국의 긴 축을 쓴다.
 */
export function bayRoofOf(
  lots: readonly { lot: string; polygon: readonly LatLon[] }[],
  axis?: RoofAxis | null
): BayRoof | null {
  const source = lots.filter((entry) => entry.polygon.length >= 3)
  if (source.length === 0) return null

  /*
   * 꼭짓점을 먼저 붙인다 — 경계와 지붕 구획이 **같은 좌표**를 써야 이음매에 실틈이 없다.
   * 붙이는 거리(≈0.7m)는 원본의 자체 반올림보다 작아 지면의 2D 지번선과 어긋나지 않는다.
   */
  const snapped = snapPolygons(source.map((entry) => entry.polygon))
  const usable = source.map((entry, i) => ({ lot: entry.lot, polygon: snapped[i] }))

  const all = usable.flatMap((entry) => [...entry.polygon])
  const outline = outlineOf(snapped) ?? convexHull(all)
  if (outline.length < 3) return null

  const u = axis ?? axisOf(outline)
  if (!u) return null
  const n = { x: -u.y, y: u.x }

  const flat = outline.map(flatten)
  const center = flat.reduce(
    (acc, p) => ({ x: acc.x + p.x / flat.length, y: acc.y + p.y / flat.length }),
    { x: 0, y: 0 }
  )
  const local = (p: { x: number; y: number }) => ({
    s: (p.x - center.x) * u.x + (p.y - center.y) * u.y,
    d: (p.x - center.x) * n.x + (p.y - center.y) * n.y,
  })
  const global = (s: number, d: number) =>
    unflatten(center.x + s * u.x + d * n.x, center.y + s * u.y + d * n.y)

  const lp = flat.map(local)
  const dMin = Math.min(...lp.map((p) => p.d))
  const dMax = Math.max(...lp.map((p) => p.d))
  const dMid = (dMin + dMax) / 2
  const halfWidth = (dMax - dMin) / 2
  if (halfWidth <= 0) return null

  const width = 2 * halfWidth * METERS_PER_DEGREE
  const rise = Math.min(BAY_ROOF.maxRise, Math.max(BAY_ROOF.minRise, width * BAY_ROOF.pitch))

  /**
   * 용마루선(d = dMid)으로 볼록하지 않을 수도 있는 폴리곤을 가른다.
   * 지번은 사각형이라 반쪽도 단순 폴리곤이다.
   */
  const cut = (polygon: readonly LatLon[], keepPositive: boolean): LatLon[] => {
    const pts = polygon.map((p) => local(flatten(p)))
    const keep = (p: { d: number }) => (keepPositive ? p.d >= dMid : p.d <= dMid)
    const out: LatLon[] = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      if (keep(a)) out.push(polygon[i])
      if (keep(a) !== keep(b)) {
        const t = (dMid - a.d) / (b.d - a.d)
        out.push(global(a.s + (b.s - a.s) * t, dMid))
      }
    }
    return out
  }

  /* 용마루 = 발자국을 가를 때 경계와 만난 점들의 s 범위 */
  const crossings: number[] = []
  {
    const pts = lp
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      if (a.d === b.d) continue
      if (a.d <= dMid !== b.d <= dMid) {
        const t = (dMid - a.d) / (b.d - a.d)
        crossings.push(a.s + (b.s - a.s) * t)
      }
    }
  }
  const sAll = lp.map((p) => p.s)
  const sMin = crossings.length > 0 ? Math.min(...crossings) : Math.min(...sAll)
  const sMax = crossings.length > 0 ? Math.max(...crossings) : Math.max(...sAll)
  const ridge: [LatLon, LatLon] = [global(sMin, dMid), global(sMax, dMid)]

  const patches: BayRoof['patches'] = []
  usable.forEach((entry, index) => {
    for (const side of [0, 1] as const) {
      const polygon = cut(entry.polygon, side === 1)
      if (polygon.length >= 3) patches.push({ lot: entry.lot, index, side, polygon })
    }
  })

  return {
    outline,
    ridge,
    rise,
    axis: u,
    width,
    ridgeRatio: (point) =>
      1 - Math.min(1, Math.abs(local(flatten(point)).d - dMid) / halfWidth),
    patches,
  }
}

/** 점들의 평균 자리 — 깊이 정렬·라벨 자리의 기준 */
export function centerOfPoints(points: readonly LatLon[]): LatLon {
  let lat = 0
  let lon = 0
  for (const p of points) {
    lat += p.lat
    lon += p.lon
  }
  return { lat: lat / points.length, lon: lon / points.length }
}
