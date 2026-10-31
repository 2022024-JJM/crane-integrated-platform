import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { StatusWarningIcon } from '../../../ui/icons'

/**
 * 점검 필요 **아이콘** — 테두리·바탕 없이 경고 삼각형 하나(사용자 확정). 왼쪽 카드의 공정·공장
 * 줄과 공장 카드의 베이 줄이 같은 표식을 쓴다. 수는 글자로 적지 않고 툴팁·보조기기 이름이
 * 말한다(`점검 필요 n`) — 줄이 좁아도 이름 옆에 붙을 수 있게.
 */
export function FaultMark({ count, className }: { count: number; className?: string }) {
  const { t } = useTranslation()
  const label = t('dashboard.map.equipmentFault', { count })
  return (
    <span role="img" aria-label={label} title={label} className={cn('inline-flex shrink-0 text-status-unhealthy', className)}>
      <StatusWarningIcon size={16} />
    </span>
  )
}
