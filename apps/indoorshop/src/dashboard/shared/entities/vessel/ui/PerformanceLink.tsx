import { Link } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { performanceLinkFor } from '../lib/blockSelection'
import { findBlock } from '../lib/roster'

/**
 * "이 블록의 통합실적 보기" — 공정·지도 화면 → `/indoorshop/performance` 딥링크.
 *
 * 보고 있던 호선·블록을 URL 에 실어 보내므로, 도착한 화면에서 조건을 다시 고르지
 * 않는다(야드 맵의 `?factory=`·`?shop=` 과 같은 자리의 계약).
 *
 * **로스터에 없는 블록이면 아무것도 그리지 않는다.** 대시보드 블록 검색이 다루는 BTS
 * 운반 위치처럼 mock 우주 밖의 실데이터도 있어서, 갈 곳 없는 링크를 세우지 않으려면
 * 붙이는 쪽이 아니라 여기서 걸러야 한다.
 *
 * 이 컴포넌트가 엔티티 쪽에 사는 이유: 딥링크 문법의 임자가 여기다. 통합실적 feature 에
 * 두면 링크 하나 붙이려고 공정 화면이 그 모듈을 통째로 끌어오게 된다.
 */
export function PerformanceLink({
  projNo,
  blockNo,
  tone = 'default',
  className,
}: {
  projNo: string
  /**
   * 블록번호. **여럿을 받을 수 있다** — 한 정반에 블록이 여럿 서 있는 경우(실측 5BAY 의
   * 553·726·736)를 하나로 줄여 보내면 나머지가 조회에서 빠진다. 로스터에 없는 번호는
   * 걸러 보내고, 하나도 안 남으면 링크를 세우지 않는다.
   */
  blockNo: string | readonly string[]
  /** `onDark` — 지도 오버레이처럼 어두운 판 위에 설 때 (그쪽은 흰색 계열 팔레트를 쓴다) */
  tone?: 'default' | 'onDark'
  className?: string
}) {
  const { t } = useTranslation()
  const wanted = typeof blockNo === 'string' ? [blockNo] : blockNo
  const known = wanted.filter((block) => findBlock(projNo, block))
  if (known.length === 0) return null
  const label = known.length === 1 ? `${projNo}-${known[0]}` : `${projNo}-${known.join(',')}`

  return (
    <Link
      to={performanceLinkFor({ projNo, blocks: known })}
      title={t('common.viewPerformanceHint', { block: label })}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-inshop-md border px-2 py-0.5 text-2xs transition-colors focus:outline-none focus-visible:ring-2',
        tone === 'onDark'
          ? 'border-white/18 text-white/70 hover:border-white/35 hover:text-white focus-visible:ring-white/70'
          : 'border-border text-foreground/70 hover:border-accent/50 hover:text-accent focus-visible:ring-accent/70',
        className
      )}
    >
      {t('common.viewPerformance')}
      <span aria-hidden="true">→</span>
    </Link>
  )
}
