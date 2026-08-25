import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { ZONE_CHECK_META, type ZoneCheck } from '../model/types'
import { cn } from '../../../shared/lib/utils'

interface ZoneCheckListProps {
  checks: ZoneCheck[]
  className?: string
}

/**
 * 건전성 판정의 내역.
 *
 * 배지 하나("주의")로는 어디가 걸렸는지 알 수 없어, 사람이 결국 서버에 붙어
 * 로그를 본다. 그 한 단계를 화면이 대신한다 — 점검 항목마다 **본 값**을 낸다.
 */
export function ZoneCheckList({ checks, className }: ZoneCheckListProps) {
  const { t } = useTranslation()
  return (
    <dl className={cn('space-y-1.5', className)}>
      {checks.map((check) => {
        const meta = ZONE_CHECK_META[check.state]
        const stateLabel = t(meta.labelKey)
        return (
          <div key={check.labelKey} className="flex items-start gap-2">
            <span
              title={stateLabel}
              className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', meta.dotClass)}
            />
            <dt className="w-[4.5rem] shrink-0 text-inshop-xs text-foreground/58">{t(check.labelKey)}</dt>
            <dd className="min-w-0 flex-1 text-inshop-xs leading-relaxed text-foreground/75">
              {t(check.detailKey)}
              <span className="sr-only"> ({stateLabel})</span>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
