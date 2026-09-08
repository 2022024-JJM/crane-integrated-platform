import type { ProcessZone } from '../../../entities/vessel'
import type { SearchGroup } from './searchIndex'

/*
 * 최근 검색 — 빈 팔레트가 "지난번 그 블록"으로 한 번에 돌아가게 한다.
 *
 * sessionStorage 에 둔다: 세션 동안 살고 브라우저를 닫으면 사라진다. 통합실적의
 * sticky 선택(`rememberSelection`)과 같은 수명 철학이다 — 오래된 검색이 다음날까지
 * 따라오면 그건 기억이 아니라 소음이다. 저장 실패(사생활 보호 모드 등)는 조용히
 * 기능만 끈다 — 검색 자체는 저장소 없이도 온전하다.
 */

export interface RecentSearch {
  group: SearchGroup
  title: string
  subtitle: string | null
  href: string
  /** 공정 단계 — 결과 줄과 같은 공정색 칩을 최근 검색에서도 세운다 */
  zone?: ProcessZone
}

export const RECENT_LIMIT = 3

const STORAGE_KEY = 'global-search:recent'

function safeStorage(): Storage | null {
  try {
    return globalThis.sessionStorage
  } catch {
    return null
  }
}

const GROUPS: readonly string[] = ['vessel', 'block', 'assy', 'yard', 'wo', 'equipment']

/** 저장돼 있던 값이 지금 모양인지 — 낡은/깨진 항목은 버린다(빈 목록이 오류보다 낫다) */
function isRecentSearch(value: unknown): value is RecentSearch {
  if (typeof value !== 'object' || value == null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.group === 'string' &&
    GROUPS.includes(item.group) &&
    typeof item.title === 'string' &&
    typeof item.href === 'string' &&
    (item.subtitle === null || typeof item.subtitle === 'string')
  )
}

/** 최근 검색 목록 (최신이 앞) — 저장소가 없거나 깨져 있으면 빈 목록 */
export function readRecentSearches(storage: Storage | null = safeStorage()): RecentSearch[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecentSearch).slice(0, RECENT_LIMIT)
  } catch {
    return []
  }
}

/**
 * 고른 결과를 남긴다 — 같은 곳(href)은 한 번만, 최신이 앞, 3건 상한.
 * 갱신된 목록을 돌려주므로 화면이 다시 읽지 않아도 된다.
 */
export function rememberRecentSearch(
  pick: RecentSearch,
  storage: Storage | null = safeStorage()
): RecentSearch[] {
  const next = [
    pick,
    ...readRecentSearches(storage).filter((item) => item.href !== pick.href),
  ].slice(0, RECENT_LIMIT)
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* 저장이 막혀도 이번 화면의 목록은 유효하다 */
  }
  return next
}
