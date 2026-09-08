import { useTranslation } from '../../../lib/i18n/useTranslation'
import { Link } from 'react-router-dom'
import { cn } from '../../../lib/utils'
import type { BayOccupant } from '../lib/bayOccupancy'

/*
 * 이 베이에 서 있는 블록·ASSY (P1 ①) — 총괄 상세의 본문.
 *
 * 재실이 없으면 **비었다고 말한다**. 빈 칸을 감추면 "아직 안 불러왔다"와 "지금 아무것도
 * 없다"가 같은 화면이 된다 — 그 둘은 운영에서 완전히 다른 사실이다.
 */
export function BayOccupantList({
  occupants,
  className,
}: {
  occupants: readonly BayOccupant[]
  className?: string
}) {
  const { t } = useTranslation()

  if (occupants.length === 0) {
    return (
      <p className={cn('px-1 py-1.5 text-2xs text-white/40', className)}>
        {t('dashboard.map.bayEmpty')}
      </p>
    )
  }

  return (
    <ul className={cn('space-y-1', className)}>
      {occupants.map((occupant) => (
        <li key={occupant.key}>
          <Link
            to={occupant.path}
            className={cn(
              'flex items-baseline gap-2 rounded-inshop-md px-2 py-1.5 transition-colors',
              'hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
            )}
          >
            <span className="shrink-0 font-mono text-inshop-xs font-semibold text-white/92">
              {occupant.key}
            </span>
            {/* 이 자리에 올라온 ASSY — 흩어진 조립에서만 붙는다(블록 단위 자리는 빈 배열) */}
            {occupant.assys.length > 0 && (
              <span className="min-w-0 flex-1 truncate font-mono text-2xs text-white/50">
                {occupant.assys.map((assy) => assy.assyNo).join(' · ')}
              </span>
            )}
            <span className="flex-1" />
            {occupant.justArrived && (
              <span className="shrink-0 rounded border border-white/15 px-1 py-px text-[9px] text-white/55">
                {t('dashboard.map.bayJustArrived')}
              </span>
            )}
            {occupant.assys.length > 0 && (
              <span className="shrink-0 text-2xs tabular-nums text-white/45">
                {t('dashboard.map.bayAssyCount', { count: occupant.assys.length })}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
