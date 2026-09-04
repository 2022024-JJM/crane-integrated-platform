/*
 * ── 설비 배치 — **도면처럼 줄을 맞춘다** (R35) ──
 *
 * 앞서는 실좌표에 찍고 겹친 것만 흩뿌려 떼어 놓았다(`decluster`). 그림은 정직했지만
 * 읽히지 않았다 — 산점도는 "여기쯤 있다"를 말하고, 조작자가 묻는 것은 "몇 번째 줄
 * 어느 자리인가"다. 공장은 실제로 베이 장변을 따라 줄지어 서 있고, 그 줄이 보이지
 * 않으면 그림이 공장 도면이 아니라 얼룩이 된다.
 *
 * 그래서 배치를 **좌표가 아니라 규칙**으로 만든다:
 *  · **베이가 좌표계다.** 베이 껍질에서 최소면적 직사각형을 얻어 장변(u)·단변(v)을
 *    구하고, 그 안에서만 자리를 잡는다. 베이가 비스듬히 서 있으면 줄도 비스듬히 선다 —
 *    화면 축이 아니라 건물 축이 기준이라야 도면으로 읽힌다.
 *  · **종류가 줄이다.** 같은 베이의 같은 종류는 한 띠(band)를 이루어 장변을 따라
 *    **등간격**으로 늘어선다. 띠 순서는 관례를 따른다 — 캐비닛(판넬·엣지PC·제어반)은
 *    벽면 쪽, 관측류(라이다·틸팅)는 가운데, 공조류(제습기·히터)는 반대 벽면.
 *  · **겹침은 흩뿌림이 아니라 칸으로 푼다.** 한 줄에 다 못 서면 같은 열을 지킨 채
 *    다음 줄로 넘긴다(격자). 자리가 흔들리는 대신 줄이 늘어난다.
 *
 * 지어낸 자리 아닌가? 그렇다 — 그리고 그것이 의도다. 실좌표 그림은 이미 야드 맵이
 * 갖고 있고(`features/yard-map`), 이 그림의 질문은 "저 라이다가 **어느 베이의 몇 번째**
 * 인가" 하나다. 베이 소속과 종류·순서(장변 방향의 실제 앞뒤)는 보존하고, 센티미터
 * 단위의 실제 편차만 버린다.
 *
 * 마지막에 **겹침 0을 무조건 보장한다.** 베이 밖 설비(옥외·미지정)는 격자에 스냅하고,
 * 그래도 부딪히는 것은 나선으로 빈칸을 찾는다 — 덮인 점은 없는 점이기 때문이다.
 */

/** 화면 좌표계의 점 하나 (투영이 끝난 뒤) */
export interface BlueprintXY {
  x: number
  y: number
}

/** 자리를 잡을 설비 하나 */
export interface BlueprintPoint extends BlueprintXY {
  id: string
  /** 종류ID — 어느 띠에 설지의 근거 */
  typeId: string
  /** 속한 베이의 구획 키. 없으면 옥외로 본다 */
  bay?: string
}

/** 베이 하나 — 껍질은 **투영이 끝난** 화면 좌표다 */
export interface BlueprintBay {
  groupKey: string
  hull: readonly BlueprintXY[]
}

export interface BlueprintOptions {
  /** 두 설비 중심 사이 최소 간격(뷰박스 단위) — 이 값이 곧 격자 눈금이다 */
  minGap: number
}

/**
 * 종류 → 띠 순위. 작을수록 단변의 앞쪽(한쪽 벽면)에 선다.
 *
 * 공장 도면의 관례를 그대로 옮긴다 — 제어 캐비닛은 벽·기둥에 붙고, 관측 장비는 정반을
 * 내려다보도록 베이 가운데를 지나며, 공조는 반대편에 선다. 모르는 종류는 맨 뒤 줄이다
 * (자리를 지어내기보다 끝줄에 모아 두는 편이 정직하다).
 */
const BAND_RANK: Record<string, number> = {
  PNL: 0,
  EDGE: 0,
  PLC: 0,
  HUB: 0,
  CONV: 0,
  LIDAR: 1,
  TILT: 1,
  VCAM: 1,
  RFID: 1,
  DH: 2,
  GH: 2,
}
const BAND_RANK_OTHER = 3

/** 줄 간격의 상한(눈금 배수) — 이보다 벌리면 베이의 여백이 사라져 칸이 안 보인다 */
const ROW_SPREAD_MAX = 1.7

function bandRankOf(typeId: string): number {
  return BAND_RANK[typeId] ?? BAND_RANK_OTHER
}

/** 베이의 지역 좌표계 — 최소면적 직사각형에서 얻은 장변(u)·단변(v) */
export interface BayFrame {
  cx: number
  cy: number
  /** 장변 단위벡터 */
  ux: number
  uy: number
  /** 단변 단위벡터 (u 를 90° 돌린 것) */
  vx: number
  vy: number
  /** 장변 반길이 */
  halfU: number
  /** 단변 반길이 */
  halfV: number
}

/**
 * 껍질을 감싸는 **최소면적 직사각형**.
 *
 * 축정렬 상자를 쓰지 않는 이유: 옥포의 베이는 대개 15~40° 기울어 서 있고, 축정렬
 * 상자에 줄을 세우면 건물은 비스듬한데 설비만 화면 축을 따라 서서 둘이 어긋난다.
 * 최소면적 직사각형은 한 변이 껍질의 어느 변과 반드시 맞닿는다는 성질을 쓰므로
 * (볼록 다각형에서 성립) 변의 방향만 훑으면 된다 — 껍질이 열댓 점이라 비용도 없다.
 */
export function bayFrameOf(hull: readonly BlueprintXY[]): BayFrame | null {
  if (hull.length < 3) return null

  let best: { area: number; angle: number; minA: number; maxA: number; minB: number; maxB: number } | null =
    null

  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i]
    const b = hull[(i + 1) % hull.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    if (length < 1e-9) continue
    const ex = dx / length
    const ey = dy / length

    let minA = Infinity
    let maxA = -Infinity
    let minB = Infinity
    let maxB = -Infinity
    for (const point of hull) {
      const pa = point.x * ex + point.y * ey
      const pb = -point.x * ey + point.y * ex
      minA = Math.min(minA, pa)
      maxA = Math.max(maxA, pa)
      minB = Math.min(minB, pb)
      maxB = Math.max(maxB, pb)
    }
    const area = (maxA - minA) * (maxB - minB)
    /* 같은 넓이면 먼저 본 변을 지킨다 — 결과가 입력 순서에만 매이도록(결정적) */
    if (!best || area < best.area - 1e-9) {
      best = { area, angle: Math.atan2(ey, ex), minA, maxA, minB, maxB }
    }
  }
  if (!best) return null

  const ex = Math.cos(best.angle)
  const ey = Math.sin(best.angle)
  const midA = (best.minA + best.maxA) / 2
  const midB = (best.minB + best.maxB) / 2
  const cx = ex * midA - ey * midB
  const cy = ey * midA + ex * midB
  const halfAlong = (best.maxA - best.minA) / 2
  const halfAcross = (best.maxB - best.minB) / 2

  /* 장변이 u — 줄은 늘 긴 쪽을 따라 선다 */
  if (halfAlong >= halfAcross) {
    return { cx, cy, ux: ex, uy: ey, vx: -ey, vy: ex, halfU: halfAlong, halfV: halfAcross }
  }
  return { cx, cy, ux: -ey, uy: ex, vx: -ex, vy: -ey, halfU: halfAcross, halfV: halfAlong }
}

/** 한 종류가 이루는 띠 — 몇 열 몇 줄로 설지 */
interface Band {
  typeId: string
  members: BlueprintPoint[]
  cols: number
  rows: number
}

/**
 * 도면 배치 — 설비 id → 화면 좌표.
 *
 * 입력 순서를 흔들지 않고 **결정적**이다(폴링마다 그림이 떨리면 그건 살아 있는 게
 * 아니라 떠는 것이다). 반환된 좌표는 서로 `minGap` 이상 떨어져 있음이 보장된다.
 */
export function layoutBlueprint(
  points: readonly BlueprintPoint[],
  bays: readonly BlueprintBay[],
  options: BlueprintOptions
): Map<string, BlueprintXY> {
  const minGap = Math.max(1e-6, options.minGap)
  const placed = new Map<string, BlueprintXY>()
  /* 충돌 검사 대상 — 배치 순서대로 쌓인다 */
  const taken: BlueprintXY[] = []

  const put = (id: string, at: BlueprintXY) => {
    const free = isFree(taken, at, minGap) ? at : nearestFreeCell(taken, at, minGap)
    placed.set(id, free)
    taken.push(free)
  }

  const frames = new Map<string, BayFrame>()
  for (const bay of bays) {
    const frame = bayFrameOf(bay.hull)
    if (frame) frames.set(bay.groupKey, frame)
  }

  const byBay = new Map<string, BlueprintPoint[]>()
  const outside: BlueprintPoint[] = []
  for (const point of points) {
    const key = point.bay
    if (key && frames.has(key)) {
      const list = byBay.get(key)
      if (list) list.push(point)
      else byBay.set(key, [point])
    } else {
      outside.push(point)
    }
  }

  /* 베이 순서는 키 순 — 입력 배열 순서가 바뀌어도 같은 그림이 나와야 한다 */
  for (const groupKey of [...byBay.keys()].sort((a, b) => a.localeCompare(b))) {
    const frame = frames.get(groupKey)!
    for (const [id, at] of layoutBay(byBay.get(groupKey)!, frame, minGap)) put(id, at)
  }

  /*
   * 베이 밖 설비(옥외·미지정)는 제 실좌표에서 가장 가까운 **격자 눈금**에 선다.
   * 자리를 통째로 지어내지 않으면서도 줄은 맞는다 — 도크변 설비가 그렇게 놓인다.
   */
  for (const point of [...outside].sort((a, b) => a.id.localeCompare(b.id))) {
    put(point.id, snapToGrid(point, minGap))
  }

  return placed
}

/** 베이 하나 안의 배치 — 종류별 띠를 단변을 따라 쌓고, 각 띠는 장변을 따라 등간격 */
function layoutBay(
  members: readonly BlueprintPoint[],
  frame: BayFrame,
  minGap: number
): Array<[string, BlueprintXY]> {
  /*
   * 껍질에서 한 걸음 물러선다. 두 이웃 베이가 각자 이만큼씩 물러서면 서로의 배치
   * 구역이 최소 `minGap` 떨어지므로, 베이 경계에 붙은 설비끼리 부딪히지 않는다.
   *
   * 두 축을 다르게 다룬다:
   *  · **단변(v)** 은 물러섬을 지킨다 — 베이는 대개 단변끼리 맞붙어 늘어서므로, 여기를
   *    양보하면 이웃 베이의 줄과 내 줄이 서로의 영역으로 파고든다.
   *  · **장변(u)** 은 베이가 작을 때 양보한다. 도장 공장의 베이는 뷰박스에서 30칸도 안
   *    되는데 거기서 한 칸씩 물리면 남는 길이가 0이 되어, 두 대가 장변을 따라 나란히
   *    서는 대신 단변을 가로질러 포개진다 — 그림이 베이를 가로로 터뜨린다.
   * 그래도 남는 드문 충돌은 마지막 눈금 탐색이 받는다.
   */
  const insetU = Math.min(minGap * 0.6, frame.halfU * 0.18)
  const insetV = Math.min(minGap * 0.6, frame.halfV * 0.9)
  const usableU = Math.max(0, frame.halfU * 2 - insetU * 2)
  const usableV = Math.max(0, frame.halfV * 2 - insetV * 2)
  /* 장변에 눈금 몇 개가 들어가는가 — 한 줄의 최대 열 수 */
  const maxCols = Math.max(1, Math.floor(usableU / minGap) + 1)

  const byType = new Map<string, BlueprintPoint[]>()
  for (const point of members) {
    const list = byType.get(point.typeId)
    if (list) list.push(point)
    else byType.set(point.typeId, [point])
  }

  const bands: Band[] = [...byType.keys()]
    .sort((a, b) => bandRankOf(a) - bandRankOf(b) || a.localeCompare(b))
    .map((typeId) => {
      /* 띠 안의 순서는 **장변 방향의 실제 앞뒤**를 지킨다 — 1번 라이다가 1번 자리에 */
      const list = [...byType.get(typeId)!].sort(
        (a, b) => alongU(a, frame) - alongU(b, frame) || a.id.localeCompare(b.id)
      )
      const cols = Math.max(1, Math.min(maxCols, list.length))
      return { typeId, members: list, cols, rows: Math.ceil(list.length / cols) }
    })

  const totalRows = bands.reduce((sum, band) => sum + band.rows, 0)
  /*
   * 줄 간격은 단변을 채우되 **너무 벌리지 않는다.**
   *
   * 처음에는 남는 폭을 전부 나눠 벽까지 밀어 붙였다가, 베이가 맞붙은 공장에서 설비가
   * 벽 없는 카펫처럼 화면을 고르게 덮었다 — 어디까지가 한 칸인지 보이지 않으면 정렬이
   * 돼 있어도 배치도로 읽히지 않는다. 그래서 상한을 두어 줄 사이에 여백이 남게 한다.
   */
  const rowStep =
    totalRows > 1
      ? Math.min(Math.max(minGap, usableV / (totalRows - 1)), minGap * ROW_SPREAD_MAX)
      : 0
  const vSpan = rowStep * (totalRows - 1)

  const out: Array<[string, BlueprintXY]> = []
  let rowCursor = 0
  for (const band of bands) {
    const colStep = band.cols > 1 ? Math.max(minGap, usableU / (band.cols - 1)) : 0
    const uSpan = colStep * (band.cols - 1)
    band.members.forEach((point, index) => {
      /* 열은 띠 안에서 **공유**한다 — 마지막 줄이 짧아도 열이 어긋나지 않는다 */
      const col = index % band.cols
      const row = rowCursor + Math.floor(index / band.cols)
      const u = -uSpan / 2 + col * colStep
      const v = -vSpan / 2 + row * rowStep
      out.push([
        point.id,
        {
          x: frame.cx + u * frame.ux + v * frame.vx,
          y: frame.cy + u * frame.uy + v * frame.vy,
        },
      ])
    })
    rowCursor += band.rows
  }
  return out
}

/** 장변 방향의 좌표 — 띠 안의 순서를 실제 배치에서 가져오기 위한 것 */
function alongU(point: BlueprintXY, frame: BayFrame): number {
  return (point.x - frame.cx) * frame.ux + (point.y - frame.cy) * frame.uy
}

/** 실좌표에서 가장 가까운 격자 눈금 */
function snapToGrid(point: BlueprintXY, step: number): BlueprintXY {
  return { x: Math.round(point.x / step) * step, y: Math.round(point.y / step) * step }
}

function isFree(taken: readonly BlueprintXY[], at: BlueprintXY, minGap: number): boolean {
  for (const other of taken) {
    if (Math.hypot(other.x - at.x, other.y - at.y) < minGap - 1e-6) return false
  }
  return true
}

/**
 * 빈 눈금 찾기 — 격자 위를 **나선**으로 훑는다.
 *
 * 규칙대로 잡은 자리가 이미 찬 경우(이웃 베이의 껍질이 서로 파고든 드문 경우, 옥외
 * 설비가 베이 위로 떨어진 경우)의 마지막 수단이다. 밀어내기(흩뿌림)를 쓰지 않는 이유는
 * 그러면 줄이 무너지기 때문이다 — 어긋나더라도 **눈금 위**에 서 있는 편이 도면답다.
 */
function nearestFreeCell(
  taken: readonly BlueprintXY[],
  at: BlueprintXY,
  step: number
): BlueprintXY {
  const baseX = Math.round(at.x / step)
  const baseY = Math.round(at.y / step)
  for (let ring = 0; ring <= 48; ring += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue
        const candidate = { x: (baseX + dx) * step, y: (baseY + dy) * step }
        if (isFree(taken, candidate, step)) return candidate
      }
    }
  }
  return at
}
