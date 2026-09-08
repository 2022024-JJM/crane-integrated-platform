import type { AirUnit } from './airEffect'

/*
 * 베이 안 **설비 자리** — 도장공장의 관례 배치를 규칙으로 적는다 (R38).
 *
 * ── 왜 실좌표를 그대로 쓰지 않는가 ─────────────────────────────
 * 설비 fixture 의 EPSG:5187 좌표는 실측이지만 **배치가 아니다.** 1DOCK 도장공장 B1 베이는
 * 58×56m 인데 그 안의 제습기·가스히터 두 대는 8m 남짓 안에 붙어 서 있고, 다른 베이도
 * 전부 같은 모양이다 — 도면이 준 것은 설비가 **어느 베이에 몇 대 있는가**이지 베이 안
 * 어디에 서 있는가가 아니다. 그 점 뭉치를 3D 에 그대로 옮기면 58m 베이 한가운데 설비
 * 두 대가 겹쳐 뜬다(지금까지의 화면이 그랬다).
 *
 * 그래서 자리는 **관례로 세우되 규칙으로 적는다**:
 *  · 가스히터 — 긴 벽면 하부에 등간격, 좌우 벽을 번갈아. 열원은 벽을 타고 베이 안쪽으로
 *    분다(가운데 세우면 블록이 설 자리를 뺏는다).
 *  · 제습기 — 베이 코너 먼저, 넘치면 짧은 벽(덕트 라인)에 등간격. 흡·배기 덕트가 코너
 *    기둥을 타고 오르는 것이 도장 베이의 관례다.
 * 두 종류 모두 **베이 안쪽을 향한다**(yaw) — 토출구가 벽을 보고 있으면 그림이 거짓말이다.
 *
 * 순서는 설비ID 순이다 — 폴링마다 자리가 바뀌면 같은 히터가 매번 다른 벽에 선다.
 *
 * ⚠️ 실 도면 배치가 확정되면 이 규칙 대신 그 좌표를 받는다. 그때 바뀌는 것은 이 파일
 *    하나이고 뷰어는 손대지 않는다 — 뷰어에 좌표를 하드코딩하지 않는 이유다.
 */

/** 벽에서 안쪽으로 들이는 거리(m) — 설비 몸통 반폭 + 통행 여유 */
export const WALL_INSET_M = 3.5
/** 긴 벽 위 설비가 양 끝에서 비켜서는 거리(m) — 코너의 제습기와 부딪히지 않게 */
export const LONG_WALL_END_INSET_M = 8
/** 짧은 벽(덕트 라인) 위 설비가 양 끝에서 비켜서는 거리(m) */
export const END_WALL_INSET_M = 6

/** 베이 안에 선 설비 한 대의 자리 — 베이 로컬 [x, z] 미터, yaw 는 Y 축 회전(라디안) */
export interface UnitStation {
  id: string
  kind: AirUnit['kind']
  x: number
  z: number
  /** 정면(+z)이 베이 안쪽을 보도록 하는 회전각 */
  yaw: number
  running: boolean
}

/** n 개를 [-half, half] 구간에 **등간격**으로 — 양 끝에 반 칸씩 여백을 남긴다 */
function evenSpread(count: number, half: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [0]
  const span = half * 2
  return Array.from({ length: count }, (_, i) => -half + (span * (i + 1)) / (count + 1))
}

/**
 * 이 베이의 설비 자리 — 크기(m)와 설비 목록만 있으면 정해진다.
 *
 * 설비가 벽 여백보다 많으면 간격이 좁아질 뿐, **벽 밖으로 나가지 않는다**(등간격 분할이라
 * 개수와 무관하게 구간 안이다). 베이가 너무 작아 여백이 음수가 되는 경우만 여백을
 * 크기에 비례해 줄인다 — 그래도 자리는 언제나 발자국 안이다.
 */
export function stationsOf(
  units: readonly AirUnit[],
  size: readonly [number, number]
): UnitStation[] {
  const [width, length] = size
  /* 작은 베이에서도 여백이 폭·길이를 넘지 않게 — 넘으면 자리가 베이 밖으로 나간다 */
  const wallInset = Math.min(WALL_INSET_M, width * 0.2, length * 0.2)
  const longEndInset = Math.min(LONG_WALL_END_INSET_M, length * 0.25)
  const endWallInset = Math.min(END_WALL_INSET_M, width * 0.25)

  const ordered = [...units].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  const heaters = ordered.filter((u) => u.kind === '가스히터')
  const dryers = ordered.filter((u) => u.kind === '제습기')

  const stations: UnitStation[] = []

  /* ── 가스히터 — 긴 벽면 하부, 좌우 번갈아, 벽마다 등간격 ── */
  const leftHeaters = heaters.filter((_, i) => i % 2 === 0)
  const rightHeaters = heaters.filter((_, i) => i % 2 === 1)
  const heaterHalf = Math.max(0, length / 2 - longEndInset)
  const wallX = Math.max(0, width / 2 - wallInset)
  for (const [side, list] of [
    [-1, leftHeaters],
    [1, rightHeaters],
  ] as const) {
    const zs = evenSpread(list.length, heaterHalf)
    list.forEach((unit, i) => {
      stations.push({
        id: unit.id,
        kind: unit.kind,
        x: side * wallX,
        z: zs[i],
        /* 왼벽(-x)에 선 히터는 +x 를, 오른벽은 -x 를 본다 */
        yaw: side === -1 ? Math.PI / 2 : -Math.PI / 2,
        running: unit.running,
      })
    })
  }

  /* ── 제습기 — 코너 넷 먼저, 남으면 짧은 벽(덕트 라인)에 등간격 ── */
  const cornerX = Math.max(0, width / 2 - wallInset)
  const cornerZ = Math.max(0, length / 2 - wallInset)
  const corners: { x: number; z: number; yaw: number }[] = [
    { x: -cornerX, z: -cornerZ, yaw: Math.PI / 4 },
    { x: cornerX, z: -cornerZ, yaw: -Math.PI / 4 },
    { x: cornerX, z: cornerZ, yaw: (-3 * Math.PI) / 4 },
    { x: -cornerX, z: cornerZ, yaw: (3 * Math.PI) / 4 },
  ]
  const cornerCount = Math.min(4, dryers.length)
  dryers.slice(0, cornerCount).forEach((unit, i) => {
    stations.push({ id: unit.id, kind: unit.kind, ...corners[i], running: unit.running })
  })

  const rest = dryers.slice(cornerCount)
  const nearEnd = rest.filter((_, i) => i % 2 === 0)
  const farEnd = rest.filter((_, i) => i % 2 === 1)
  const ductHalf = Math.max(0, width / 2 - endWallInset)
  const ductZ = Math.max(0, length / 2 - wallInset)
  for (const [side, list] of [
    [-1, nearEnd],
    [1, farEnd],
  ] as const) {
    const xs = evenSpread(list.length, ductHalf)
    list.forEach((unit, i) => {
      stations.push({
        id: unit.id,
        kind: unit.kind,
        x: xs[i],
        z: side * ductZ,
        /* 앞벽(-z)의 제습기는 +z 를, 뒷벽은 -z 를 본다 */
        yaw: side === -1 ? 0 : Math.PI,
        running: unit.running,
      })
    })
  }

  /* 결과 순서도 ID 순 — 인스턴싱 색 배열이 폴링마다 뒤섞이지 않게 */
  return stations.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
}
