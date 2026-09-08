import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import type { BayOccupancy } from '../lib/bayOccupancy'

/*
 * 공장 상세의 베이 목록 — 각 행은 그 베이의 **재실 요약**이다 (P1 ①).
 *
 * 예전에는 면적·옥내외를 적었다. 지번 대장에서 온 그 숫자는 어느 날 봐도 같아서, 매일
 * 보는 화면에서 아무 말도 하지 않았다. 지금 적는 것은 "이 칸에 무엇이 올라와 있는가" —
 * 베이를 눌러 열리는 상세(BayOccupantList)의 축약판이고, 원천도 그와 같다.
 */
export function FactoryBayList({
  bays,
  onOpenBay,
  onHoverBay,
}: {
  bays: readonly BayOccupancy[]
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
      <ul className="space-y-1" onMouseLeave={onHoverBay ? () => onHoverBay(null) : undefined}>
        {bays.map((bay) => (
          <li key={bay.bayId}>
            <button
              type="button"
              onClick={() => onOpenBay(bay.bayId)}
              onMouseEnter={onHoverBay ? () => onHoverBay(bay.bayId) : undefined}
              title={t('dashboard.map.factoryBayOpenHint', { bay: bay.label })}
              className={cn(
                'flex w-full items-baseline gap-2 rounded-inshop-md px-2 py-1.5 text-left transition-colors',
                'hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
              )}
            >
              <span className="shrink-0 text-inshop-xs font-medium text-white/88">{bay.label}</span>

              {bay.blockCount === 0 ? (
                <span className="min-w-0 flex-1 truncate text-2xs text-white/35">
                  {t('dashboard.map.bayEmpty')}
                </span>
              ) : (
                <>
                  {/* 무엇이 서 있는지 — 이름을 먼저, 세는 수는 뒤에 */}
                  <span className="min-w-0 flex-1 truncate font-mono text-2xs text-white/58">
                    {bay.occupants.map((o) => o.key).join(' · ')}
                  </span>
                  <span className="shrink-0 text-2xs tabular-nums text-white/45">
                    {t('dashboard.map.bayBlockCount', { count: bay.blockCount })}
                    {bay.assyCount > 0 &&
                      ` · ${t('dashboard.map.bayAssyCount', { count: bay.assyCount })}`}
                  </span>
                </>
              )}
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
