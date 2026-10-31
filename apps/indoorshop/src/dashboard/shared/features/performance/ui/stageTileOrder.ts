import type { FabStageGroup, FabStageId } from '../model/types'

/**
 * 가공 탭 카드 배치 — 사용자가 끌어서 자리를 바꿀 수 있는 다섯 칸(사용자 확정).
 *
 * 구간별 완료율 · 레거시 정산 · 종합은 **작은 칸**, 적치 · 가공 단계 판은 **넓은 칸**이다. 배치는 **줄의 목록**으로
 * 들고 다닌다 — 작은 칸은 셋까지 한 줄을 같은 폭으로 나눠 쓰고, 넓은 칸은 한 줄을 혼자 쓴다. 칸을 줄 사이에
 * 놓으면 그 칸 혼자 새 줄을 쓴다(사용자 확정). 어떤 배치든 줄 안에 빈 자리가 생기지 않는다.
 *
 * 배치는 이 브라우저에만 남는다(`localStorage`) — 다른 사람 · 다른 PC 와 공유하지 않는다.
 */
export type StageTileId = 'sections' | 'legacy' | 'overall' | 'stack' | 'fab'

/**
 * 「구성」에서 켜고 끄는 카드 — 구간 셋은 하나씩, 나머지는 칸 하나씩(사용자 확정).
 * 구간 셋이 다 꺼지면 구간 칸(`sections`)째 숨는다.
 */
export type StageCardKey = 'sec-stack' | 'sec-dwg' | 'sec-part' | 'legacy' | 'overall' | 'stack' | 'fab'

/**
 * 종합 카드의 구간 — 단위가 같은 절점끼리 묶는다(사용자 확정): 적치(강판 kg) · 가공 도면(시수 MH) · 가공 부재(개).
 * S5 가공 입고는 Hot DB 절점이 없어 어느 구간에도 세지 않는다.
 */
export const OVERALL_SECTIONS: readonly { key: 'stack' | 'dwg' | 'part'; tone: FabStageGroup; stages: FabStageId[] }[] = [
  { key: 'stack', tone: 'stack', stages: ['S1', 'S2', 'S3', 'S4'] },
  { key: 'dwg', tone: 'fab', stages: ['S6', 'S7'] },
  { key: 'part', tone: 'fab', stages: ['S8', 'S9', 'S10'] },
]

export const STAGE_CARD_KEYS: readonly StageCardKey[] = ['sec-stack', 'sec-dwg', 'sec-part', 'legacy', 'overall', 'stack', 'fab']
export type TileRows = StageTileId[][]

const ALL: readonly StageTileId[] = ['sections', 'legacy', 'overall', 'stack', 'fab']
export const DEFAULT_TILE_ROWS: readonly (readonly StageTileId[])[] = [['sections', 'legacy', 'overall'], ['stack'], ['fab']]
/** 한 줄에 설 수 있는 작은 칸 수 */
export const MAX_ROW = 3

const WIDE: ReadonlySet<StageTileId> = new Set(['stack', 'fab'])
const STORAGE_KEY = 'otd:fabTileRows'

export function isWideTile(id: StageTileId): boolean {
  return WIDE.has(id)
}

export function defaultTileRows(): TileRows {
  return DEFAULT_TILE_ROWS.map((row) => [...row])
}

/** 다섯 칸이 한 번씩 다 있고, 넓은 칸은 혼자, 작은 칸 줄은 셋 이하일 때만 맞는 배치다 */
function isValid(value: unknown): value is TileRows {
  if (!Array.isArray(value) || !value.every((row) => Array.isArray(row) && row.length > 0)) return false
  const flat = (value as unknown[][]).flat()
  if (flat.length !== ALL.length || !ALL.every((id) => flat.includes(id))) return false
  return (value as StageTileId[][]).every((row) =>
    row.some((id) => isWideTile(id)) ? row.length === 1 : row.length <= MAX_ROW
  )
}

export function loadTileRows(): TileRows {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (isValid(parsed)) return parsed
  } catch {
    /* 저장소를 못 쓰면 기본 배치 */
  }
  return defaultTileRows()
}

export function saveTileRows(rows: TileRows): void {
  try {
    if (isDefaultRows(rows)) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch {
    /* 저장소를 못 쓰면 이 화면에서만 기억한다 */
  }
}

export function isDefaultRows(rows: TileRows): boolean {
  return JSON.stringify(rows) === JSON.stringify(DEFAULT_TILE_ROWS)
}

function locate(rows: TileRows, id: StageTileId): [number, number] {
  for (let r = 0; r < rows.length; r++) {
    const c = rows[r].indexOf(id)
    if (c >= 0) return [r, c]
  }
  return [-1, -1]
}

/** `id` 를 빼고 빈 줄을 걷은 배치 — 빠지기 전 줄 번호가 몇 칸 당겨졌는지도 함께 */
function without(rows: TileRows, id: StageTileId): TileRows {
  return rows.map((row) => row.filter((x) => x !== id)).filter((row) => row.length > 0)
}

/** `id` 혼자 `at` 번째 줄로 선다 (`at` 은 지금 배치 기준의 줄 사이 자리 — 0 은 맨 위, 줄 수는 맨 아래) */
export function moveToNewRow(rows: TileRows, id: StageTileId, at: number): TileRows {
  const [r] = locate(rows, id)
  /* 자기 줄을 혼자 쓰던 칸이 빠지면 그 아래 자리는 한 줄씩 당겨진다 */
  const shift = r >= 0 && rows[r].length === 1 && r < at ? 1 : 0
  const next = without(rows, id)
  next.splice(Math.max(0, Math.min(at - shift, next.length)), 0, [id])
  return next
}

/**
 * `id` 를 `target` 칸 위에 놓는다.
 * - 작은 칸끼리: `target` 의 줄에 그 자리로 들어간다. 그 줄이 이미 꽉 찼으면 두 칸이 자리를 바꾼다.
 * - 넓은 칸이 끼면: `id` 가 `target` 줄 자리에 혼자 새 줄로 선다 (위에서 내려왔으면 그 아래, 아래에서 올라왔으면 그 위).
 */
export function dropOnTile(rows: TileRows, id: StageTileId, target: StageTileId): TileRows {
  if (id === target) return rows
  const [fr, fc] = locate(rows, id)
  const [tr, tc] = locate(rows, target)
  if (isWideTile(id) || isWideTile(target)) return moveToNewRow(rows, id, fr < tr ? tr + 1 : tr)
  if (fr === tr) {
    const next = rows.map((row) => [...row])
    next[tr][fc] = target
    next[tr][tc] = id
    return next
  }
  if (rows[tr].length >= MAX_ROW) {
    const next = rows.map((row) => [...row])
    next[fr][fc] = target
    next[tr][tc] = id
    return next
  }
  const next = rows.map((row) => row.filter((x) => x !== id))
  next[tr].splice(tc, 0, id)
  return next.filter((row) => row.length > 0)
}

/**
 * 키보드로 옮기기 — 손잡이에 초점을 두고 화살표.
 * - 왼쪽 · 오른쪽: 같은 줄 안에서 옆 칸과 자리를 바꾼다.
 * - 위 · 아래: 줄에 다른 칸이 있으면 혼자 떼어 그 위 · 아래 새 줄로. 혼자였으면 옆 줄이 작은 칸 줄이고 자리가
 *   있을 때 그 줄에 합류하고, 아니면 옆 줄과 자리를 바꾼다.
 */
export function moveByKey(rows: TileRows, id: StageTileId, key: 'left' | 'right' | 'up' | 'down'): TileRows {
  const [r, c] = locate(rows, id)
  if (r < 0) return rows
  if (key === 'left' || key === 'right') {
    const to = c + (key === 'left' ? -1 : 1)
    if (to < 0 || to >= rows[r].length) return rows
    const next = rows.map((row) => [...row])
    next[r][c] = next[r][to]
    next[r][to] = id
    return next
  }
  const up = key === 'up'
  if (rows[r].length > 1) return moveToNewRow(rows, id, up ? r : r + 1)
  const side = r + (up ? -1 : 1)
  if (side < 0 || side >= rows.length) return rows
  const neighbor = rows[side]
  if (!isWideTile(id) && !isWideTile(neighbor[0]) && neighbor.length < MAX_ROW) {
    const next = rows.map((row) => [...row])
    next[side] = up ? [...neighbor, id] : [id, ...neighbor]
    next.splice(r, 1)
    return next
  }
  const next = rows.map((row) => [...row])
  next[r] = neighbor
  next[side] = [id]
  return next
}
