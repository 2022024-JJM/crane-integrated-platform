import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { loadYardParcels } from '../../../entities/yard-parcels'
import { SearchIcon } from '../../../ui/icons'
import { cn } from '../../../lib/utils'
import {
  buildEquipmentSearchCtx,
  searchGlobal,
  type EquipmentSearchCtx,
  type SearchGroup,
  type SearchHit,
} from '../lib/searchIndex'
import { woEntriesOf } from '../lib/woIndex'
import {
  readRecentSearches,
  rememberRecentSearch,
  type RecentSearch,
} from '../lib/recentSearches'
import { useBaseDate } from '../../../lib/useBaseDate'

/*
 * 통합 검색 팔레트 — 입력 하나로 호선·블록·ASSY·W/O·설비를 가로질러 찾고,
 * Enter 한 번으로 그 대상의 화면(통합실적 조회 · 공정 맵 드릴다운)으로 나간다.
 *
 * 검색 규칙과 링크는 전부 `lib/searchIndex.ts` 다 — 이 파일은 그리기와 키보드만 한다.
 * 열림/단축키는 부모(`GlobalSearch`)의 몫이라, 여기가 마운트됐다는 것 자체가 "열려
 * 있다"는 뜻이다(닫힘 상태를 여기서 또 들지 않는다).
 *
 * ESC 는 **preventDefault 로 닫는다** — 뒤에 서 있는 지도 화면의 드릴다운 ESC
 * (`useDrilldownEscape`)가 defaultPrevented 를 존중하므로, 팔레트를 닫는 ESC 가
 * 지도까지 한 단계 올려 버리는 이중 반응이 나지 않는다.
 */

const GROUP_LABEL: Record<SearchGroup, InshopKey> = {
  vessel: 'globalSearch.groups.vessel',
  block: 'globalSearch.groups.block',
  assy: 'globalSearch.groups.assy',
  wo: 'globalSearch.groups.wo',
  equipment: 'globalSearch.groups.equipment',
}

/** 목록 한 줄이 되는 것 — 검색 결과이거나 최근 검색이거나, 그리는 모양은 같다 */
type Row = Pick<SearchHit, 'group' | 'title' | 'subtitle' | 'href'> & { id: string }

const optionDomId = (index: number) => `global-search-option-${index}`

export function GlobalSearchOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recent, setRecent] = useState<RecentSearch[]>(() => readRecentSearches())
  const [equipmentCtx, setEquipmentCtx] = useState<EquipmentSearchCtx | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  /* 기준일 — 통합실적과 같은 날을 봐야 W/O 번호가 화면과 일치한다 */
  /* 기준일 — `?date=` 를 따라온다. 되감은 화면에서 검색하면 그날의 W/O 를 찾는다 */
  const { baseDate } = useBaseDate()

  /* 설비 검색 문맥(공장→공정 맵, 실재 베이) — 지번 로더는 비동기·캐시 공유 */
  useEffect(() => {
    let alive = true
    loadYardParcels()
      .then((parcels) => {
        if (alive) setEquipmentCtx(buildEquipmentSearchCtx(parcels))
      })
      .catch(() => {
        /* 지번이 없으면 설비 그룹만 비고 나머지 검색은 그대로 선다 */
      })
    return () => {
      alive = false
    }
  }, [])

  /* 열려 있는 동안 배경 스크롤을 잠근다 (모바일 드로어와 같은 규칙) */
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const results = useMemo<SearchHit[]>(
    () =>
      query.trim()
        ? searchGlobal(query, { wos: woEntriesOf(baseDate), equipment: equipmentCtx })
        : [],
    [query, baseDate, equipmentCtx]
  )

  /* 빈 입력이면 최근 검색이 목록이 된다 — 키보드 문법(위아래·Enter)이 그대로 먹는다 */
  const rows = useMemo<Row[]>(
    () =>
      query.trim()
        ? results
        : recent.map((item, i) => ({ ...item, id: `recent:${i}:${item.href}` })),
    [query, results, recent]
  )

  /* 질의가 바뀌면 첫 줄부터 — 지난 질의의 자리표시가 새 목록을 가리키면 안 된다 */
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    document.getElementById(optionDomId(activeIndex))?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex])

  const go = (row: Row) => {
    setRecent(
      rememberRecentSearch({
        group: row.group,
        title: row.title,
        subtitle: row.subtitle,
        href: row.href,
      })
    )
    onClose()
    void navigate(row.href)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (rows.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % rows.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + rows.length) % rows.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const row = rows[Math.min(activeIndex, rows.length - 1)]
      if (row) go(row)
    }
  }

  /* 그룹 머리글을 세울 자리 — 이 줄이 그 그룹의 첫 줄인가 */
  const isGroupStart = (index: number) =>
    index === 0 || rows[index - 1].group !== rows[index].group

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
        onKeyDown={onKeyDown}
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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('globalSearch.placeholder')}
            aria-label={t('globalSearch.title')}
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls="global-search-listbox"
            aria-activedescendant={rows.length > 0 ? optionDomId(activeIndex) : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-inshop-sm text-foreground placeholder:text-foreground/38 focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-2xs text-foreground/45">
            Esc
          </kbd>
        </div>

        {/* 결과 목록 — 그룹 머리글 + 줄. 빈 입력이면 최근 검색이 이 자리에 선다 */}
        <ul
          id="global-search-listbox"
          role="listbox"
          aria-label={t('globalSearch.title')}
          className="scroll-thin max-h-[52vh] overflow-y-auto p-1.5"
        >
          {!query.trim() && rows.length > 0 && (
            <li className="px-2.5 pb-1 pt-1.5 text-2xs font-medium text-foreground/42">
              {t('globalSearch.recent')}
            </li>
          )}
          {!query.trim() && rows.length === 0 && (
            <li className="px-2.5 py-4 text-center text-inshop-xs text-foreground/48">
              {t('globalSearch.noRecent')}
            </li>
          )}
          {query.trim() && rows.length === 0 && (
            <li className="px-2.5 py-4 text-center text-inshop-xs text-foreground/48">
              <p>{t('globalSearch.empty', { query: query.trim() })}</p>
              <p className="mt-1 font-mono text-2xs text-foreground/38">
                {t('globalSearch.emptyGuide')}
              </p>
            </li>
          )}

          {rows.map((row, index) => (
            <li key={row.id}>
              {query.trim() && isGroupStart(index) && (
                <p className="px-2.5 pb-1 pt-1.5 text-2xs font-medium text-foreground/42">
                  {t(GROUP_LABEL[row.group])}
                </p>
              )}
              <button
                type="button"
                id={optionDomId(index)}
                role="option"
                aria-selected={index === activeIndex}
                onClick={() => go(row)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'flex w-full items-baseline gap-2.5 rounded-inshop-md px-2.5 py-2 text-left transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  index === activeIndex ? 'bg-surface-secondary' : 'hover:bg-surface-secondary/60'
                )}
              >
                <span className="shrink-0 font-mono text-inshop-sm font-medium text-foreground">
                  {row.title}
                </span>
                {row.subtitle && (
                  <span className="min-w-0 flex-1 truncate text-inshop-xs text-foreground/55">
                    {row.subtitle}
                  </span>
                )}
                {/* 빈 입력(최근 검색)에서는 그룹 머리글이 없으니 줄 끝 배지가 그 소속을 말한다 */}
                {!query.trim() && (
                  <span className="shrink-0 rounded border border-border px-1 py-px text-[10px] text-foreground/48">
                    {t(GROUP_LABEL[row.group])}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* 발치 — 키보드 문법 안내 */}
        <div className="border-t border-material-border px-4 py-1.5 text-2xs text-foreground/40">
          {t('globalSearch.hint')}
        </div>
      </div>
    </div>
  )
}
