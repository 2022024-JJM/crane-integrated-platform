import { memo, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../shared/lib/utils'
import { ChevronRightIcon } from '../../../shared/ui/icons'
import type { MapTheme } from '../lib/basemapStyle'
import { FACILITY_PROCESSES, type YardFacility } from '../lib/facilities'

interface YardFacilityListProps {
  facilities: YardFacility[]
  mapTheme: MapTheme
  selectedFacility: string | null
  /** 목록에서 고르면 맵이 그 공장으로 간다 */
  onSelectFacility: (name: string) => void
  onHoverFacility?: (name: string | null) => void
  facilityHref: (facility: YardFacility) => string | null
  className?: string
}

/**
 * 공장·샵 목록 — 레퍼런스 뷰어의 "샵 찾기" 패널이다.
 *
 * 공정별로 묶고 그 안에서 큰 공장(구획 많은 순)이 앞에 선다 — fixture 가 이미 그
 * 순서라 여기서는 다시 정렬하지 않는다. 묶음 머리글의 색이 곧 맵의 발광색이라,
 * 이 목록이 범례를 겸한다 (범례를 따로 두지 않는 이유다).
 *
 * 검색은 이름 부분일치 + 공정 이름도 받는다 — "도장"을 치면 도장공장 다섯이 남는다.
 */
export const YardFacilityList = memo(function YardFacilityList({
  facilities,
  mapTheme,
  selectedFacility,
  onSelectFacility,
  onHoverFacility,
  facilityHref,
  className,
}: YardFacilityListProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    const matched = trimmed
      ? facilities.filter(
          (facility) =>
            facility.name.toLowerCase().includes(trimmed) ||
            facility.process.label.includes(trimmed),
        )
      : facilities
    return FACILITY_PROCESSES.map((process) => ({
      process,
      items: matched.filter((facility) => facility.process.key === process.key),
    })).filter((group) => group.items.length > 0)
  }, [facilities, query])

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('yard.facility.searchPlaceholder')}
        aria-label={t('yard.facility.searchLabel')}
        className={cn(
          'w-full shrink-0 rounded-inshop-md border border-border bg-surface px-2.5 py-1.5 text-inshop-xs text-foreground',
          'placeholder:text-foreground/40',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      />

      {groups.length === 0 ? (
        <p className="px-1 py-8 text-center text-inshop-sm text-foreground/54">
          {t('yard.facility.empty')}
        </p>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {groups.map(({ process, items }) => {
            const color = process.color[mapTheme]
            return (
              <section key={process.key}>
                {/* 갈래 이름은 번역하지 않는다 — 지번 갈래·필터 칩과 같은 규칙이다 */}
                <h3 className="mb-1 flex items-center gap-1.5 px-1 text-2xs font-semibold uppercase tracking-wider text-foreground/54">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ background: color, boxShadow: `0 0 5px ${color}` }}
                  />
                  {process.label}
                  <span className="font-mono font-normal tabular-nums text-foreground/40">
                    {items.length}
                  </span>
                </h3>
                <ul className="space-y-0.5">
                  {items.map((facility) => {
                    const selected = facility.name === selectedFacility
                    const href = facilityHref(facility)
                    return (
                      <li key={facility.name} className="flex items-stretch gap-0.5">
                        <button
                          type="button"
                          onClick={() => onSelectFacility(facility.name)}
                          onMouseEnter={() => onHoverFacility?.(facility.name)}
                          onMouseLeave={() => onHoverFacility?.(null)}
                          title={t('yard.facility.selectTitle', { name: facility.name })}
                          className={cn(
                            'flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-inshop-md px-2 py-1 text-left',
                            'text-inshop-xs transition-colors',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                            selected
                              ? 'bg-accent/10 font-semibold text-foreground'
                              : 'text-foreground/76 hover:bg-foreground/4 hover:text-foreground',
                          )}
                        >
                          <span className="truncate">{facility.name}</span>
                          <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-foreground/40">
                            {facility.sections}
                          </span>
                        </button>
                        {href && (
                          <Link
                            to={href}
                            aria-label={t('yard.facility.openZone', {
                              name: facility.name,
                              process: facility.process.label,
                            })}
                            title={t('yard.facility.openZone', {
                              name: facility.name,
                              process: facility.process.label,
                            })}
                            className={cn(
                              'flex shrink-0 items-center rounded-inshop-md px-1 text-foreground/40 transition-colors',
                              'hover:bg-foreground/4 hover:text-foreground',
                              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                            )}
                          >
                            <ChevronRightIcon size={12} />
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
})
