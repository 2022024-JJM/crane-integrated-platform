import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { SearchIcon } from '../../../ui/icons'
import { cn } from '../../../lib/utils'
import { useSearchBox } from '../lib/useSearchBox'
import { readRecentSearches, type RecentSearch } from '../lib/recentSearches'
import { SearchResultRows, rowDomId, type SearchRow } from './SearchResultRows'

/*
 * 통합 검색 팔레트 — 입력 하나로 호선·블록·ASSY·야드·W/O·설비를 가로질러 찾고,
 * Enter 한 번으로 그 결과의 화면으로 나간다.
 *
 * **검색의 알맹이는 이 파일에 없다.** 색인·규칙·행선지는 `lib/searchIndex`, 행동(질의·
 * 키보드·이동)은 `lib/useSearchBox`, 줄 그리기는 `ui/SearchResultRows` 다 — 대시보드
 * 지도 위 상주 검색창(`SearchField`)이 같은 것들을 쓰므로, 두 진입점이 같은 질의에
 * 같은 답을 하고 같은 곳으로 간다. 여기 남은 것은 **팔레트라는 옷**뿐이다: 화면 한가운데
 * 뜨는 층, 배경 잠금, 최근 검색, ESC.
 *
 * ESC 는 **preventDefault 로 닫는다** — 뒤에 서 있는 지도 화면의 드릴다운 ESC
 * (`useDrilldownEscape`)가 defaultPrevented 를 존중하므로, 팔레트를 닫는 ESC 가
 * 지도까지 한 단계 올려 버리는 이중 반응이 나지 않는다.
 */

const LIST_ID = 'global-search-listbox'

export function GlobalSearchOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [recent, setRecent] = useState<RecentSearch[]>(() => readRecentSearches())
  const panelRef = useRef<HTMLDivElement>(null)

  /* 빈 입력이면 최근 검색이 목록이 된다 — 키보드 문법(위아래·Enter)이 그대로 먹는다 */
  const recentRows = useMemo<SearchRow[]>(
    () => recent.map((item, i) => ({ ...item, id: `recent:${i}:${item.href}` })),
    [recent]
  )

  const box = useSearchBox({
    rows: undefined,
    onPicked: () => {
      setRecent(readRecentSearches())
      onClose()
    },
  })
  const searching = box.query.trim().length > 0
  const rows: readonly SearchRow[] = searching ? box.results : recentRows

  /* 최근 검색 목록에서도 ↑↓·Enter 가 같게 먹어야 한다 — 훅에 그 목록을 알려 준다 */
  const boxWithRows = useSearchBoxRows(box, rows)

  /* 열려 있는 동안 배경 스크롤을 잠근다 (모바일 드로어와 같은 규칙) */
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    document.getElementById(rowDomId(LIST_ID, box.activeIndex))?.scrollIntoView?.({
      block: 'nearest',
    })
  }, [box.activeIndex])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]">
      {/* 배경 — 누르면 닫힌다. 팔레트는 화면 위 한 겹이지 새 화면이 아니다 */}
      <div
        className="absolute inset-0 bg-black/45 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('globalSearch.title')}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
            return
          }
          boxWithRows.onKeyDown(event)
        }}
        className={cn(
          'relative w-full max-w-xl overflow-hidden rounded-inshop-lg animate-slide-up',
          'border border-material-border bg-material-strong backdrop-blur-2xl backdrop-saturate-150 shadow-2xl'
        )}
      >
        {/* 입력 줄 */}
        <div className="flex items-center gap-2.5 border-b border-material-border px-4">
          <SearchIcon size={16} className="shrink-0 text-foreground/45" />
          <input
            autoFocus
            value={box.query}
            onChange={(event) => box.setQuery(event.target.value)}
            placeholder={t('globalSearch.placeholder')}
            aria-label={t('globalSearch.title')}
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls={LIST_ID}
            aria-activedescendant={rows.length > 0 ? rowDomId(LIST_ID, box.activeIndex) : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-inshop-sm text-foreground placeholder:text-foreground/38 focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-2xs text-foreground/45">
            Esc
          </kbd>
        </div>

        {/* 결과 목록 — 그룹 머리글 + 줄. 빈 입력이면 최근 검색이 이 자리에 선다 */}
        <ul
          id={LIST_ID}
          role="listbox"
          aria-label={t('globalSearch.title')}
          className="scroll-thin max-h-[52vh] overflow-y-auto p-1.5"
        >
          {!searching && rows.length > 0 && (
            <li className="px-2.5 pb-1 pt-1.5 text-2xs font-medium text-foreground/42">
              {t('globalSearch.recent')}
            </li>
          )}
          {!searching && rows.length === 0 && (
            <li className="px-2.5 py-4 text-center text-inshop-xs text-foreground/48">
              {t('globalSearch.noRecent')}
            </li>
          )}
          {searching && rows.length === 0 && (
            <li className="px-2.5 py-4 text-center text-inshop-xs text-foreground/48">
              <p>{t('globalSearch.empty', { query: box.query.trim() })}</p>
              <p className="mt-1 font-mono text-2xs text-foreground/38">
                {t('globalSearch.emptyGuide')}
              </p>
            </li>
          )}

          <SearchResultRows
            rows={rows}
            activeIndex={box.activeIndex}
            listId={LIST_ID}
            tone="panel"
            /* 최근 검색은 한 묶음이라 그룹 머리글 대신 줄 끝 배지가 소속을 말한다 */
            showGroupHeadings={searching}
            onPick={(row) => boxWithRows.go(row)}
            onHover={box.setActiveIndex}
          />
        </ul>

        {/* 발치 — 키보드 문법 안내 */}
        <div className="border-t border-material-border px-4 py-1.5 text-2xs text-foreground/40">
          {t('globalSearch.hint')}
        </div>
      </div>
    </div>
  )
}

/**
 * 목록이 결과가 아닐 때(최근 검색)도 같은 키보드를 쓰기 위한 얇은 겹.
 *
 * `useSearchBox` 는 자기가 만든 결과를 기본 목록으로 삼지만, 팔레트는 빈 질의에 최근
 * 검색을 세운다 — 그 목록에도 ↑↓·Enter 가 똑같이 먹어야 한다(사용자에게는 같은 목록이다).
 */
function useSearchBoxRows(
  box: ReturnType<typeof useSearchBox>,
  rows: readonly SearchRow[]
): Pick<ReturnType<typeof useSearchBox>, 'onKeyDown' | 'go'> {
  return {
    go: box.go,
    onKeyDown: (event) => {
      if (rows.length === 0) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        box.setActiveIndex((box.activeIndex + 1) % rows.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        box.setActiveIndex((box.activeIndex - 1 + rows.length) % rows.length)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        const row = rows[Math.min(box.activeIndex, rows.length - 1)]
        if (row) box.go(row)
      }
    },
  }
}
