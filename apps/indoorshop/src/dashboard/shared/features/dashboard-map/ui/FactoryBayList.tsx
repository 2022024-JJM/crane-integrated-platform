import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import type { BaySummary } from '../lib/bayDetail'

/*
 * 공장 상세의 베이 목록 (R14) — 드릴인한 공장의 본문.
 *
 * 각 행은 베이 상세(BayDetailCard)의 축약판이다: 면적·옥내·옥외 — 상세가 보여주는
 * 항목의 부분집합을 **같은 어휘(i18n 키)·같은 원천(summarizeBay)** 으로 요약한다
 * (`lib/factoryBayRows` 의 계약). 행을 누르면 그 베이로 드릴인한다(기존 URL 문법) —
 * 공장→베이가 같은 정보 위계의 줌 단계로 읽히게.
 */
export function FactoryBayList({
  bays,
  onOpenBay,
  onHoverBay,
}: {
  bays: readonly BaySummary[]
  /** 행 클릭 = 그 베이로 드릴인 (`?bay=` — 지도의 베이 클릭과 같은 계단) */
  onOpenBay: (bayId: string) => void
  /** 행 호버 — 지도의 그 베이 칸이 함께 밝아진다. 벗어나면 null */
  onHoverBay?: (bayId: string | null) => void
}) {
  const { t } = useTranslation()
  if (bays.length === 0) return null

  return (
    <div className="shrink-0 px-3 py-3">
      <p className="mb-2 px-1 text-2xs font-medium text-white/55">
        {t('dashboard.map.factoryBayList')}
        <span className="ml-1.5 font-mono text-white/30">{bays.length}</span>
      </p>
      <ul
        className="space-y-1"
        onMouseLeave={onHoverBay ? () => onHoverBay(null) : undefined}
      >
        {bays.map((bay) => (
          <li key={bay.id}>
            <button
              type="button"
              onClick={() => onOpenBay(bay.id)}
              onMouseEnter={onHoverBay ? () => onHoverBay(bay.id) : undefined}
              title={t('dashboard.map.factoryBayOpenHint', { bay: bay.label })}
              className={cn(
                'flex w-full items-baseline gap-2 rounded-inshop-md px-2 py-1.5 text-left transition-colors',
                'hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
              )}
            >
              <span className="min-w-0 flex-1 truncate text-inshop-xs font-medium text-white/88">
                {bay.label}
              </span>
              {/* 축약 요약 — 베이 상세와 같은 어휘·같은 값 (factoryBayRows 계약) */}
              <span className="shrink-0 text-2xs tabular-nums text-white/48">
                {t('dashboard.map.area')} {Math.round(bay.area).toLocaleString()} m²
              </span>
              <span className="shrink-0 text-2xs tabular-nums text-white/48">
                {t('dashboard.map.indoor')} {bay.indoor} · {t('dashboard.map.outdoor')}{' '}
                {bay.outdoor}
              </span>
              <span aria-hidden="true" className="shrink-0 text-white/35">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
