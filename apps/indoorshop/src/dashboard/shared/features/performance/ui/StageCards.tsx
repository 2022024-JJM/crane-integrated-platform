import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { STATUS_STYLE } from '../../../ui/statusPalette'
import { Card } from '../../../ui/atoms/Card'
import {
  FAB_STAGE_GROUP,
  FAB_STAGES_PENDING_SOURCE,
  fabStagesOfGroup,
  type FabStageGroup,
  type FabStageId,
  type FabricationSummary,
} from '../model/types'
import { FAB_STAGE_BASIS_KEY, FAB_STAGE_LABEL_KEY } from './stageLabels'

/**
 * 가공권역 절점 카드 10장 + 종합 카드 (IPD-S04 · 기준일 스냅샷).
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

  /**
   * 묶음 머리 — 한 줄을 통째로 차지해(`col-span-full`) 격자 안에서 줄을 가른다.
   * 카드 열을 따로 나누지 않고 같은 격자에 머리만 끼워 넣는 것이라, 카드 크기·정렬이
   * 종전 그대로다(디자인 재설계 없이 '어디부터 가공인지' 만 읽히게 한다 — R39).
   */
  const groupHeader = (group: FabStageGroup) => {
    const stages = fabStagesOfGroup(group)
    return (
      <div key={`head-${group}`} className="col-span-full flex items-center gap-2 pt-0.5">
        <span className="text-[11px] font-semibold text-foreground/60">
          {t(`performance.stages.group.${group}` as const)}
        </span>
        <span className="text-[10px] tabular-nums text-foreground/38">
          {t('performance.stages.groupRange', {
            from: stages[0],
            to: stages[stages.length - 1],
          })}
        </span>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
    )
  }

  return (
    /* 절점이 열이 되면서 6열 그리드로는 카드가 두 줄 반이 된다 — 넓은 화면에서 한 줄에
       담기도록 열을 늘린다(카드 디자인은 그대로, 격자만). */
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
      {summary.stages.flatMap((s, i) => {
        const complete = s.weightRate >= 100
        const active = activeStage === s.stage
        /* 묶음이 바뀌는 자리(첫 절점 포함)에 머리를 세운다 */
        const previous = summary.stages[i - 1]
        const head =
          previous === undefined || FAB_STAGE_GROUP[previous.stage] !== FAB_STAGE_GROUP[s.stage]
            ? [groupHeader(FAB_STAGE_GROUP[s.stage])]
            : []
        return [
          ...head,
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
              <span className="text-inshop-xs font-semibold">{t(FAB_STAGE_LABEL_KEY[s.stage])}</span>
              {/* 원천(레거시 컬럼) 확정 대기 절점 — 축은 정본이지만 근거가 아직 없다는 사실을
                  카드가 스스로 적는다. 감추면 '다 수집되고 있다' 는 거짓말이 된다. */}
              {FAB_STAGES_PENDING_SOURCE.includes(s.stage) && (
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
              {/* 바는 한 규칙만 쓴다(감사 F-9) — 값에 따른 상태색: 다 차면 완료, 아니면 진행중 */}
              <div
                className={cn(
                  'h-full rounded-full',
                  complete ? STATUS_STYLE.done.fill : STATUS_STYLE.inProgress.fill
                )}
                style={{ width: `${Math.min(100, s.weightRate)}%` }}
              />
            </div>

            {/* 카드 아랫단이 평평했다 — 건수·진행·미도래·근거가 전부 같은 크기·같은 농도라
                무엇이 먼저 읽혀야 하는지 없었다. 건수는 중량%의 짝이므로 한 급 올리고,
                진행·미도래는 보조로 내린다(크기·굵기·농도만 — 자리는 그대로). */}
            <div className="mt-2 text-inshop-xs font-medium tabular-nums text-foreground/75">
              {t('performance.stages.counts', { done: s.doneCount, target: s.targetCount })}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] tabular-nums text-foreground/45">
              <span>{t('performance.stages.inProgress', { count: s.inProgressCount })}</span>
              <span>{t('performance.stages.notDue', { count: s.notDueCount })}</span>
              {s.excludedCount > 0 && (
                <span>{t('performance.stages.excluded', { count: s.excludedCount })}</span>
              )}
            </div>
            <div className="mt-2 border-t border-border pt-1.5 text-[10px] leading-4 text-foreground/38">
              <div>
                {t('performance.stages.basis')} {t(FAB_STAGE_BASIS_KEY[s.stage])}
              </div>
            </div>
          </Card>,
        ]
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
