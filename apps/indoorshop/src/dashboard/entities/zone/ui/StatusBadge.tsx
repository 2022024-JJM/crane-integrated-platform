import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { ZONE_STATUS_META, type ZoneStatus } from '../model/types'
import { StatusChip } from '../../../shared/ui/atoms/StatusChip'

interface StatusBadgeProps {
  status: ZoneStatus
  className?: string
}

/**
 * 서비스 가동 상태 배지.
 * 라벨만으로는 "실행 중"과 "정상"이 구분되지 않으므로 툴팁에 판정 근거를 싣는다.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation()
  const meta = ZONE_STATUS_META[status]
  const label = t(meta.labelKey)

  return (
    <StatusChip
      tone={meta.tone}
      label={label}
      title={t('zone.statusTitle', { label, meaning: t(meta.meaningKey) })}
      className={className}
    />
  )
}
