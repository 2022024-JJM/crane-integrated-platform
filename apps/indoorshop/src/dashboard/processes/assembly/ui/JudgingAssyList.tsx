import { Link } from 'react-router-dom'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { InshopKey } from '../../../shared/lib/i18n/keys'
import { cn } from '../../../shared/lib/utils'
import type { AssyTier } from '../../../shared/features/performance/model/types'
import type { JudgingAssy } from '../lib/judgingAssys'

/*
 * **진행중 판별** 섹션 — 이 공장에서 지금 붙이고 있는 ASSY (W7-7-5).
 *
 * 공장 화면은 "여기 무엇이 서 있나"(정반·센서)는 말했지만 "여기서 지금 무엇이 만들어지고
 * 있나"는 통합실적에만 있었다. 완료분은 떠났으니 없는 게 맞고, **진행 중인 것은 아직 여기
 * 있다** — 그 한 줄이 빠져 있었다.
 *
 * 수치는 전부 통합실적에서 온다(`lib/judgingAssys`). 이 컴포넌트는 집계하지 않는다.
 * 줄을 누르면 그 ASSY 를 지목한 통합실적으로 간다 — 같은 번호로 그대로 이어진다.
 */

const TIER_KEY: Record<AssyTier, InshopKey> = {
  grand: 'assembly.judging.tier.grand',
  mid: 'assembly.judging.tier.mid',
  sub: 'assembly.judging.tier.sub',
}

function JudgingRow({ assy }: { assy: JudgingAssy }) {
  const { t } = useTranslation()
  return (
    <li>
      <Link
        to={assy.href}
        className="flex items-center gap-3 rounded-inshop-md px-2 py-1.5 transition-colors hover:bg-surface-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="w-11 shrink-0 text-2xs font-medium text-foreground/55">
          {t(TIER_KEY[assy.tier])}
        </span>
        <span className="w-32 shrink-0 truncate font-mono text-inshop-xs text-foreground">
          {assy.assyNo}
        </span>
        <span className="w-10 shrink-0 font-mono text-2xs text-foreground/45">
          {assy.mapBay ?? '—'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, assy.selfRate)}%` }}
            />
          </div>
        </div>
        {/* 이 카드가 답하는 수치 — 자기율 하나를 크게, 분수는 그 근거로 작게 */}
        <span className="w-12 shrink-0 text-right font-mono text-inshop-sm font-semibold tabular-nums text-foreground">
          {Math.round(assy.selfRate)}
          <span className="text-2xs font-normal text-foreground/45">%</span>
        </span>
        <span className="w-12 shrink-0 text-right font-mono text-2xs tabular-nums text-foreground/45">
          {assy.recognizedQty}/{assy.reqQty}
        </span>
        <span aria-hidden="true" className="shrink-0 text-2xs text-foreground/35">
          →
        </span>
      </Link>
    </li>
  )
}

export function JudgingAssyList({
  assys,
  loading = false,
  className,
}: {
  assys: readonly JudgingAssy[] | null
  loading?: boolean
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <section className={cn('rounded-inshop-lg border border-border bg-surface p-3', className)}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-inshop-sm font-semibold text-foreground">{t('assembly.judging.title')}</h3>
        <span className="text-2xs text-foreground/50">{t('assembly.judging.basis')}</span>
      </div>

      {loading ? (
        <p className="px-2 py-6 text-center text-inshop-sm text-foreground/45">{t('common.loading')}</p>
      ) : !assys || assys.length === 0 ? (
        /* 비어 있는 것이 정상인 공장이 있다 — 왜 비었는지를 말한다(빈 자리로 두지 않는다) */
        <p className="px-2 py-6 text-center text-inshop-sm text-foreground/45">
          {t('assembly.judging.empty')}
        </p>
      ) : (
        <>
          <ul>
            {assys.map((assy) => (
              <JudgingRow key={assy.assyNo} assy={assy} />
            ))}
          </ul>
          <p className="mt-2 px-2 text-2xs leading-relaxed text-foreground/40">
            {t('assembly.judging.note')}
          </p>
        </>
      )}
    </section>
  )
}
