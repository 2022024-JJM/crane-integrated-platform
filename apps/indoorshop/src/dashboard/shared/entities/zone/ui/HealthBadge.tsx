import { useTranslation } from '../../../lib/i18n/useTranslation'
import { ZONE_HEALTH_META, type ZoneHealth } from '../model/types'
import { StatusChip } from '../../../ui/atoms/StatusChip'

interface HealthBadgeProps {
  health: ZoneHealth
  className?: string
}

/** 수집 품질(건전성) 배지 — 서비스 가동 상태(StatusBadge)와는 다른 축이다 */
export function HealthBadge({ health, className }: HealthBadgeProps) {
  const { t } = useTranslation()
  const meta = ZONE_HEALTH_META[health]
  const label = t(meta.labelKey)

  return (
    <StatusChip
      tone={meta.tone}
      label={label}
      title={t('zone.healthTitle', { label, meaning: t(meta.meaningKey) })}
      className={className}
    />
  )
}
