/*
 * 지도 위 오버레이 카드를 잡아 옮기는 동작의 **순수 부분** — DOM 도, React 도 모른다.
 *
 * 화면(`shared/ui/atoms/DraggableCard`)에서 갈라 둔 이유는 하나다: 자리 계산과 저장은
 * 브라우저를 띄우지 않고도 검증할 수 있어야 한다. 여기 있는 함수들은 전부 인자만 보고
 * 답을 내므로 노드 환경 테스트에서 그대로 부른다.
 */

/** 원래 자리(레이아웃이 정해 준 자리)로부터의 이동량 — px */
export interface CardOffset {
  x: number
  y: number
}

export const ZERO_OFFSET: CardOffset = { x: 0, y: 0 }

/** 이동량이 0 인가 — 0 이면 transform 자체를 걸지 않는다(레이어 승격을 아끼려고) */
export function isZeroOffset(offset: CardOffset): boolean {
  return offset.x === 0 && offset.y === 0
}

/** 옮기기 전의 카드 자리 — `getBoundingClientRect()` 에서 이동량을 뺀 값 */
export interface CardRect {
  left: number
  top: number
  width: number
  height: number
}

/** 카드가 벗어나면 안 되는 테두리 — 보통은 뷰포트 */
export interface CardBounds {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * 두 끝 사이로 가둔다. `a`·`b` 의 **순서를 묻지 않는다** — 카드가 테두리보다 크면
 * 하한이 상한보다 커지는데(그때 범위는 "카드가 테두리를 덮는 구간"이다), 그대로
 * `Math.min/max` 를 쓰면 값이 한쪽 끝에 붙어 아예 못 움직인다.
 */
export function clampBetween(value: number, a: number, b: number): number {
  const low = Math.min(a, b)
  const high = Math.max(a, b)
  return Math.min(Math.max(value, low), high)
}

/**
 * 카드가 테두리 밖으로 달아나지 않게 이동량을 가둔다.
 *
 * 기준은 **옮기기 전 자리**(`natural`)다. 옮긴 뒤 자리를 기준으로 삼으면 이동량이
 * 두 번 더해져서, 끌수록 카드가 손을 앞질러 달아난다.
 */
export function clampCardOffset(
  offset: CardOffset,
  natural: CardRect,
  bounds: CardBounds,
  margin = 8,
): CardOffset {
  const minX = bounds.left + margin - natural.left
  const maxX = bounds.right - margin - (natural.left + natural.width)
  const minY = bounds.top + margin - natural.top
  const maxY = bounds.bottom - margin - (natural.top + natural.height)
  return {
    x: Math.round(clampBetween(offset.x, minX, maxX)),
    y: Math.round(clampBetween(offset.y, minY, maxY)),
  }
}

/* ── 저장 ─────────────────────────────────────────────────────────────── */

/*
 * 저장은 `sessionStorage` 다 — 새로고침·화면 왕복에는 자리가 남고, 브라우저를 닫으면
 * 처음 배치로 돌아간다. localStorage 였다면 한 번 구석에 밀어 둔 카드를 몇 달 뒤에도
 * 못 찾는 사고가 난다(그리고 그건 "화면이 깨졌다"로 신고된다).
 */
export const DRAG_CARD_STORAGE_PREFIX = 'ocean.dragcard.v1'

/** 페이지(경로) × 카드 이름 — 같은 카드라도 화면이 다르면 자리를 따로 기억한다 */
export function dragCardStorageKey(pageKey: string, cardKey: string): string {
  return `${DRAG_CARD_STORAGE_PREFIX}:${pageKey}:${cardKey}`
}

/** 읽고 쓰는 데 필요한 최소 계약 — 테스트가 가짜 저장소를 끼울 수 있게 좁혀 둔다 */
export type CardOffsetStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 저장된 자리. 없거나 깨졌으면 `null` — 깨진 값 때문에 카드가 사라지지는 않게 한다 */
export function readCardOffset(
  storage: CardOffsetStorage | null | undefined,
  key: string,
): CardOffset | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { x, y } = parsed as { x?: unknown; y?: unknown }
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null
    return { x, y }
  } catch {
    // 사생활 보호 모드·용량 초과 — 자리를 못 읽는 것뿐이므로 처음 자리로 선다
    return null
  }
}

/** 자리를 적는다. 원위치(0,0)면 키를 지운다 — 기본값을 굳이 저장해 두지 않는다 */
export function writeCardOffset(
  storage: CardOffsetStorage | null | undefined,
  key: string,
  offset: CardOffset,
): void {
  if (!storage) return
  try {
    if (isZeroOffset(offset)) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify({ x: offset.x, y: offset.y }))
  } catch {
    // 저장 실패는 이번 세션의 기억만 잃는다 — 화면 동작에는 영향이 없다
  }
}

export function clearCardOffset(
  storage: CardOffsetStorage | null | undefined,
  key: string,
): void {
  writeCardOffset(storage, key, ZERO_OFFSET)
}

/** 브라우저가 아니거나 접근이 막힌 환경에서는 `null` — 호출부가 분기하지 않게 한다 */
export function sessionStorageOrNull(): CardOffsetStorage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    return sessionStorage
  } catch {
    return null
  }
}
