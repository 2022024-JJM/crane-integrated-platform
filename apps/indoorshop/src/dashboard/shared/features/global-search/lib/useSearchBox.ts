import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchGlobal, type SearchHit } from './searchIndex'
import { useSearchSources } from './useSearchSources'
import { rememberRecentSearch, type RecentSearch } from './recentSearches'
import type { SearchRow } from '../ui/SearchResultRows'

/*
 * 검색창 한 개의 **행동** — 질의·결과·키보드·이동. 진입점 둘이 이 훅 하나를 쓴다.
 *
 * 팔레트(Cmd+K)와 대시보드 지도 위 검색창은 생김새만 다르다: 같은 원천을 읽고
 * (`useSearchSources`), 같은 규칙으로 걸러(`searchGlobal`), 같은 곳으로 간다
 * (결과의 `href` — 행선지는 결과 타입이 정한다). 두 화면이 각자 키보드를 구현하던
 * 시절에는 한쪽만 ↑↓ 가 되고 다른 쪽은 Enter 가 첫 줄만 열었다.
 */

export interface SearchBoxApi {
  query: string
  setQuery: (next: string) => void
  /** 지금 목록에 선 줄들 (결과가 없으면 빈 배열) */
  results: SearchHit[]
  activeIndex: number
  setActiveIndex: (index: number) => void
  /** 그 줄의 행선지로 이동하고 최근 검색에 남긴다 */
  go: (row: SearchRow) => void
  /** ↑↓·Enter — 목록을 가진 요소(입력창)에 그대로 건다 */
  onKeyDown: (event: React.KeyboardEvent) => void
}

export function useSearchBox({
  /** 목록에 실제로 서는 줄 — 팔레트는 빈 질의에 최근 검색을 세우므로 결과와 다를 수 있다 */
  rows,
  onPicked,
}: {
  rows?: readonly SearchRow[]
  /** 이동 직후 진입점이 할 뒷정리 (팔레트 닫기·드롭다운 접기) */
  onPicked?: (row: SearchRow) => void
} = {}): SearchBoxApi {
  const navigate = useNavigate()
  const sources = useSearchSources()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const results = useMemo(
    () => (query.trim() ? searchGlobal(query, sources) : []),
    [query, sources]
  )
  const listed = rows ?? results

  /* 질의가 바뀌면 첫 줄부터 — 지난 질의의 자리표시가 새 목록을 가리키면 안 된다 */
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const go = (row: SearchRow) => {
    rememberRecentSearch(toRecent(row))
    onPicked?.(row)
    void navigate(row.href)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (listed.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % listed.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + listed.length) % listed.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const row = listed[Math.min(activeIndex, listed.length - 1)]
      if (row) go(row)
    }
  }

  return { query, setQuery, results, activeIndex, setActiveIndex, go, onKeyDown }
}

/** 최근 검색에 남길 모양 — 다시 그리려면 줄이 가진 것 전부가 필요하다 */
export function toRecent(row: SearchRow): RecentSearch {
  return {
    group: row.group,
    title: row.title,
    subtitle: row.subtitle,
    href: row.href,
    zone: row.zone,
  }
}
