import { useSyncExternalStore } from 'react'
import type { HistoryZone } from '../../view-history'
import { nowMs } from '../../../lib/now'

/**
 * 즐겨찾기 — 내가 **고정해 둔 화면 × 호선-블록**(사용자 확정: 히스토리와 같은 구조).
 *
 * 히스토리는 열면 저절로 쌓이지만, 즐겨찾기는 사용자가 ☆ 를 눌러 넣고 뺀다. 넣은 순서의 역순(최근이 위)
 * 으로 선다. 헤더의 즐겨찾기 버튼이 목록을 펴고, 줄을 누르면 그 화면 · 그 블록으로 간다.
 *
 * **저장소는 지금 이 브라우저(localStorage)** 다 — 나중에 사용자 계정에 저장한다(사용자 확정). 그때는
 * 아래 `storage` 한 곳만 서버 호출로 바꾸면 된다(읽기 · 쓰기가 여기로만 지나간다). 다른 브라우저 탭에서
 * 바꾼 것도 `storage` 이벤트로 곧바로 따라온다.
 */

export interface FavoriteEntry {
  zone: HistoryZone
  projNo: string
  blockNo: string
  /** 즐겨찾기에 넣은 시각(ms) */
  at: number
}

/** 넣을 수 있는 줄 수 — 넘치면 더하지 않는다 */
export const FAVORITES_LIMIT = 50

const STORAGE_KEY = 'otd:favorites'
const ZONES: readonly HistoryZone[] = ['performance', 'fabrication', 'assembly', 'outfitting', 'painting']

function isEntry(value: unknown): value is FavoriteEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    ZONES.includes(v.zone as HistoryZone) &&
    typeof v.projNo === 'string' &&
    typeof v.blockNo === 'string' &&
    typeof v.at === 'number'
  )
}

/** 저장소 — 지금은 브라우저. 사용자 계정 저장으로 옮길 때 이 둘만 바꾼다 */
const storage = {
  load(): FavoriteEntry[] {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, FAVORITES_LIMIT) : []
    } catch {
      return []
    }
  },
  save(next: FavoriteEntry[]) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* 저장소를 못 쓰면 이 탭의 메모리로만 기억한다 */
    }
  },
}

let entries: FavoriteEntry[] = typeof window === 'undefined' ? [] : storage.load()
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function commit(next: FavoriteEntry[]) {
  entries = next
  storage.save(next)
  notify()
}

/* 다른 브라우저 탭에서 바꾼 즐겨찾기를 따라온다 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return
    entries = storage.load()
    notify()
  })
}

const same = (a: Pick<FavoriteEntry, 'zone' | 'projNo' | 'blockNo'>, b: Pick<FavoriteEntry, 'zone' | 'projNo' | 'blockNo'>) =>
  a.zone === b.zone && a.projNo === b.projNo && a.blockNo === b.blockNo

export function isFavorite(zone: HistoryZone, projNo: string, blockNo: string): boolean {
  return entries.some((e) => same(e, { zone, projNo, blockNo }))
}

/** 있으면 빼고, 없으면 맨 위에 넣는다(가득 찼으면 넣지 않는다). 넣었으면 true */
export function toggleFavorite(zone: HistoryZone, projNo: string, blockNo: string, at: number = nowMs()): boolean {
  const key = { zone, projNo, blockNo }
  if (entries.some((e) => same(e, key))) {
    commit(entries.filter((e) => !same(e, key)))
    return false
  }
  if (entries.length >= FAVORITES_LIMIT) return false
  commit([{ ...key, at }, ...entries])
  return true
}

export function removeFavorite(zone: HistoryZone, projNo: string, blockNo: string): void {
  commit(entries.filter((e) => !same(e, { zone, projNo, blockNo })))
}

export function clearFavorites(): void {
  commit([])
}

export function favorites(): readonly FavoriteEntry[] {
  return entries
}

export function subscribeFavorites(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useFavorites(): readonly FavoriteEntry[] {
  return useSyncExternalStore(subscribeFavorites, favorites, favorites)
}
