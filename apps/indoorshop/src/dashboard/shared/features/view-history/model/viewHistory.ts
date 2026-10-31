import { useSyncExternalStore } from 'react'
import { performanceLinkFor, zonePerformanceLinkFor } from '../../../entities/vessel'
import { nowMs } from '../../../lib/now'

/**
 * 최근 본 화면(히스토리) — 내가 **어느 화면에서 어떤 호선-블록**을 열었는가(사용자 확정).
 *
 * 기록하는 곳은 블록을 탭으로 여는 다섯 화면 — 통합실적과 가공·조립·의장·도장 [실적] — 이다.
 * 같은 화면의 같은 블록을 다시 열면 새로 쌓지 않고 맨 위로 올린다. 헤더의 히스토리 버튼이 이 목록을
 * 펴고, 줄을 누르면 그 화면·그 블록으로 간다.
 *
 * 이 브라우저에 남긴다(localStorage) — 내 작업의 발자국이라 다른 사람과 나누지 않고, 새로 고쳐도
 * 이어진다. 저장소를 못 쓰면 이 탭의 메모리로만 기억한다.
 */

export type HistoryZone = 'performance' | 'fabrication' | 'assembly' | 'outfitting' | 'painting'

export interface HistoryEntry {
  zone: HistoryZone
  projNo: string
  blockNo: string
  /** 마지막으로 연 시각(ms) */
  at: number
}

/** 남길 줄 수 — 넘치면 오래된 것부터 버린다 */
export const HISTORY_LIMIT = 30

const STORAGE_KEY = 'otd:view-history'
const ZONES: readonly HistoryZone[] = ['performance', 'fabrication', 'assembly', 'outfitting', 'painting']

function isEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    ZONES.includes(v.zone as HistoryZone) &&
    typeof v.projNo === 'string' &&
    typeof v.blockNo === 'string' &&
    typeof v.at === 'number'
  )
}

function read(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, HISTORY_LIMIT) : []
  } catch {
    return []
  }
}

let entries: HistoryEntry[] = typeof window === 'undefined' ? [] : read()
const listeners = new Set<() => void>()

function commit(next: HistoryEntry[]) {
  entries = next
  snapshot = null
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* 저장소를 못 쓰면 이 탭의 메모리로만 기억한다 */
  }
  for (const listener of listeners) listener()
}

/** 이 화면에서 이 블록을 열었다 — 같은 줄이 있으면 맨 위로 올린다 */
export function recordView(zone: HistoryZone, projNo: string, blockNo: string, at: number = nowMs()): void {
  const rest = entries.filter((e) => !(e.zone === zone && e.projNo === projNo && e.blockNo === blockNo))
  commit([{ zone, projNo, blockNo, at }, ...rest].slice(0, HISTORY_LIMIT))
}

export function clearViewHistory(): void {
  current = null
  commit([])
}

/**
 * 지금 보고 있는 화면 · 블록 — 히스토리 목록에서 뺀다(사용자 지적: 보고 있는 것이 맨 위에 있으면 이상하다).
 * 블록 탭 화면이 탭을 바꿀 때마다 알리고, 화면을 떠나면 지운다. 블록 탭은 주소를 고치지 않으므로
 * 주소로는 알 수 없다 — 그래서 화면이 직접 알린다. 탭(브라우저)마다 따로라 저장하지 않는다.
 */
let current: Pick<HistoryEntry, 'zone' | 'projNo' | 'blockNo'> | null = null

export function setCurrentView(view: Pick<HistoryEntry, 'zone' | 'projNo' | 'blockNo'> | null): void {
  const same =
    view === current ||
    (view && current && view.zone === current.zone && view.projNo === current.projNo && view.blockNo === current.blockNo)
  if (same) return
  current = view
  snapshot = null
  for (const listener of listeners) listener()
}

/** 목록에 보일 줄 — 지금 보고 있는 것을 뺀 히스토리 */
let snapshot: readonly HistoryEntry[] | null = null
function visibleHistory(): readonly HistoryEntry[] {
  if (!snapshot) {
    const c = current
    snapshot = c ? entries.filter((e) => !(e.zone === c.zone && e.projNo === c.projNo && e.blockNo === c.blockNo)) : entries
  }
  return snapshot
}

export function viewHistory(): readonly HistoryEntry[] {
  return entries
}

export function subscribeViewHistory(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 헤더 목록이 읽는 히스토리 — 지금 보고 있는 화면 · 블록은 빠져 있다 */
export function useViewHistory(): readonly HistoryEntry[] {
  return useSyncExternalStore(subscribeViewHistory, visibleHistory, visibleHistory)
}

/** 그 줄의 화면으로 가는 주소 — 그 블록 하나를 탭으로 연다 */
export function hrefOfEntry(entry: Pick<HistoryEntry, 'zone' | 'projNo' | 'blockNo'>): string {
  const selection = { projNo: entry.projNo, blocks: [entry.blockNo] }
  return entry.zone === 'performance' ? performanceLinkFor(selection) : zonePerformanceLinkFor(entry.zone, selection)
}
