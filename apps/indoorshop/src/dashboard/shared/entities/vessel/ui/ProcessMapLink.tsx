import { Link } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { findBlock } from '../lib/roster'
import { zonePathOfBlock } from '../lib/roster'

/**
 * "이 블록이 있는 공정 화면으로" — `/indoorshop/performance` → 공정 딥링크(`PerformanceLink` 의 반대편).
 *
 * 정반이 정해진 조립 블록이면 그 정반 상세까지, 아니면 그 공장을 연 맵 진입 화면까지
 * 간다(`zonePathOfBlock`). 로스터에 없는 블록이면 **아무것도 그리지 않는다** — 갈 곳이
 * 없는 링크를 세우지 않는다.
 */
export function ProcessMapLink({
  projNo,
  blockNo,
  className,
}: {
  projNo: string
  blockNo: string
  className?: string
}) {
  const { t } = useTranslation()
  const block = findBlock(projNo, blockNo)
  if (!block) return null

  return (
    <Link
      to={zonePathOfBlock(block)}
      title={t('common.viewOnProcessMapHint', { block: `${projNo}-${blockNo}` })}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-inshop-md border border-border px-2 py-1 text-inshop-xs text-foreground/70 transition-colors hover:border-accent/50 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
        className
      )}
    >
      {t('common.viewOnProcessMap')}
      <span aria-hidden="true">→</span>
    </Link>
  )
}
