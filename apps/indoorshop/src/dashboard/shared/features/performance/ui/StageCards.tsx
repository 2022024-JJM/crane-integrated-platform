import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { cn } from '../../../lib/utils'
import { Card } from '../../../ui/atoms/Card'
import type { FabStageId, FabricationSummary } from '../model/types'

const STAGE_LABEL_KEY: Record<FabStageId, InshopKey> = {
  S1: 'performance.stages.s1',
  S2: 'performance.stages.s2',
  S3: 'performance.stages.s3',
  S4: 'performance.stages.s4',
  S5: 'performance.stages.s5',
}

const STAGE_BASIS_KEY: Record<FabStageId, InshopKey> = {
  S1: 'performance.stages.basisOf.S1',
  S2: 'performance.stages.basisOf.S2',
  S3: 'performance.stages.basisOf.S3',
  S4: 'performance.stages.basisOf.S4',
  S5: 'performance.stages.basisOf.S5',
}

/**
 * 가공권역 단계 카드 5장 + 종합 카드 (IPD-S04 · 기준일 스냅샷).
 *
 * D2 — 중량%를 카드의 주인공(대형 수치)으로, 진행 바·상태색으로 시인성을 만든다.
 * 표기는 정의서 §6.4 어휘 그대로: 건수/중량 이원, 진행·미도래, 분모 제외(미대상).
 */
export function StageCards({
  summary,
  activeStage,
  onStageClick,
}: {
  summary: FabricationSummary
  activeStage: FabStageId | null
  onStageClick: (stage: FabStageId) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {summary.stages.map((s) => {
        const complete = s.weightRate >= 100
        const active = activeStage === s.stage
        return (
          <Card
            key={s.stage}
            interactive
            role="button"
            tabIndex={0}
            aria-pressed={active}
            onClick={() => onStageClick(s.stage)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onStageClick(s.stage)
              }
            }}
            className={cn('cursor-pointer p-3.5', active && 'border-accent/60')}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-inshop-xs font-semibold">{t(STAGE_LABEL_KEY[s.stage])}</span>
              {s.stage === 'S1' && (
                <span className="rounded bg-status-degraded/10 px-1 py-px text-[10px] text-status-degraded">
                  {t('performance.stages.s1Pending')}
                </span>
              )}
            </div>

            <div
              className={cn(
                'mt-2 text-3xl font-semibold tabular-nums',
                complete ? 'text-status-healthy' : 'text-foreground'
              )}
            >
              {s.weightRate}
              <span className="text-inshop-base text-foreground/45">%</span>
              <span className="ml-1 align-middle text-[10px] font-medium text-accent">
                ★{t('performance.stages.primary')}
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-secondary"
              role="img"
              aria-label={`${t('performance.stages.weightRate')} ${s.weightRate}%`}
            >
              <div
                className={cn('h-full rounded-full', complete ? 'bg-status-healthy' : 'bg-accent')}
                style={{ width: `${Math.min(100, s.weightRate)}%` }}
              />
            </div>

            <div className="mt-2 text-[11px] tabular-nums text-foreground/60">
              {t('performance.stages.counts', { done: s.doneCount, target: s.targetCount })}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] tabular-nums text-foreground/50">
              <span>{t('performance.stages.inProgress', { count: s.inProgressCount })}</span>
              <span>{t('performance.stages.notDue', { count: s.notDueCount })}</span>
              {s.excludedCount > 0 && (
                <span>{t('performance.stages.excluded', { count: s.excludedCount })}</span>
              )}
            </div>
            <div className="mt-2 border-t border-border pt-1.5 text-[10px] leading-4 text-foreground/45">
              <div>
                {t('performance.stages.basis')} {t(STAGE_BASIS_KEY[s.stage])}
              </div>
            </div>
          </Card>
        )
      })}

      <Card className="flex flex-col justify-center bg-surface-secondary/40 p-3.5">
        <div className="text-inshop-xs font-semibold text-foreground/70">
          {t('performance.stages.overall')}
        </div>
        <div className="mt-2 text-4xl font-semibold tabular-nums text-accent">
          {summary.overallWeightRate}
          <span className="text-inshop-base text-foreground/45">%</span>
        </div>
        <div className="mt-1 text-[10px] text-foreground/45">
          {t('performance.stages.overallNote')}
        </div>
      </Card>
    </div>
  )
}
