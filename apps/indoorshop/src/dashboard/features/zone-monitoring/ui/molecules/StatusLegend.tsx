import { useState } from 'react'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import {
  ZONE_HEALTH_META,
  ZONE_STATUS_META,
  type ZoneHealth,
  type ZoneStatus,
} from '../../../../entities/zone/model/types'
import { StatusChip } from '../../../../shared/ui/atoms/StatusChip'
import { cn } from '../../../../shared/lib/utils'

const statusOrder: ZoneStatus[] = ['running', 'stopped', 'error']
const healthOrder: ZoneHealth[] = ['healthy', 'degraded', 'unhealthy']

/**
 * 배지 표기 안내.
 *
 * 카드에 "실행 중"과 "정상"이 함께 있으면 처음 보는 사람은 둘을 같은 축으로 읽는다.
 * 두 축이 무엇을 재는지는 한 번만 알면 되므로, 기본은 접어 두고 필요할 때 편다.
 */
export function StatusLegend({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('text-right', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'rounded-inshop-sm px-2 py-1 text-inshop-xs font-medium transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          open ? 'bg-accent/10 text-accent' : 'text-foreground/63 hover:text-foreground',
        )}
      >
        {open ? t('zone.legendToggleClose') : t('zone.legendToggleOpen')}
      </button>

      {open && (
        <div className="mt-2 grid grid-cols-1 gap-4 rounded-inshop-lg border border-border bg-surface p-4 text-left sm:grid-cols-2">
          <section>
            <h3 className="text-inshop-xs font-semibold text-foreground">{t('zone.legendServiceTitle')}</h3>
            <p className="mt-0.5 text-2xs text-foreground/54">
              {t('zone.legendServiceDescription')}
            </p>
            <ul className="mt-2 space-y-1.5">
              {statusOrder.map((status) => {
                const meta = ZONE_STATUS_META[status]
                return (
                  <li key={status} className="flex items-start gap-2">
                    <StatusChip tone={meta.tone} label={t(meta.labelKey)} />
                    <span className="mt-0.5 min-w-0 flex-1 text-inshop-xs leading-relaxed text-foreground/68">
                      {t(meta.meaningKey)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section>
            <h3 className="text-inshop-xs font-semibold text-foreground">{t('zone.legendQualityTitle')}</h3>
            <p className="mt-0.5 text-2xs text-foreground/54">
              {t('zone.legendQualityDescription')}
            </p>
            <ul className="mt-2 space-y-1.5">
              {healthOrder.map((health) => {
                const meta = ZONE_HEALTH_META[health]
                return (
                  <li key={health} className="flex items-start gap-2">
                    <StatusChip tone={meta.tone} label={t(meta.labelKey)} />
                    <span className="mt-0.5 min-w-0 flex-1 text-inshop-xs leading-relaxed text-foreground/68">
                      {t(meta.meaningKey)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
