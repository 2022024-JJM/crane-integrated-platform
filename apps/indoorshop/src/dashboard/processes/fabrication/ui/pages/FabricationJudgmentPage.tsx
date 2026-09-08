import { useState } from 'react'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import { Card, SectionHeading } from '../../../../shared/ui/atoms/Card'
import { Button } from '../../../../shared/ui/atoms/Button'
import { Spinner } from '../../../../shared/ui/atoms/Spinner'
import { StatusChip } from '../../../../shared/ui/atoms/StatusChip'
import { ToggleButton } from '../../../../shared/ui/atoms/ToggleButton'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import { useTimeFormat } from '../../../../shared/lib/i18n/useTimeFormat'
import { cn } from '../../../../shared/lib/utils'
import { FABRICATION_API_BASE, JUDGMENT_LIMIT, fetchDashboardSnapshot } from '../../api/fabricationApi'
import { useIntervalTick } from '../../lib/useIntervalTick'
import { SummaryTiles } from '../SummaryTiles'
import { CheckpointCounts, StateCounts } from '../JudgmentOverview'
import { MirrorPanel } from '../MirrorPanel'
import { RollProgressTable } from '../RollProgressTable'
import { RollTracePanel } from '../RollTracePanel'
import { CutProgressTable } from '../CutProgressTable'
import { CutTracePanel } from '../CutTracePanel'
import { JudgmentTable } from '../JudgmentTable'

/** 판별 서비스 폴링 주기(기본 PT5S)와 같은 박자로 읽는다 — 더 자주 읽어도 새 행이 없다 */
const REFRESH_MS = 5_000

/**
 * 가공 판별 실적 현황판.
 *
 * 한 화면에서 위→아래로 "얼마나 판별됐나(요약·절점·상태) → 무엇을 근거로(미러 적재·워터마크)
 * → ROLL 한 장씩 대조 → 도면→부재 전개 대조 → 판별 원본" 순으로 내려간다.
 * 행을 고르면 그 ROLL·도면의 판별 근거 패널이 표 바로 아래에 선다.
 */
export function FabricationJudgmentPage() {
  const { t } = useTranslation()
  const { absolute, relative } = useTimeFormat()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const { tick, bump } = useIntervalTick(REFRESH_MS, autoRefresh)
  const [selectedRollNo, setSelectedRollNo] = useState<string | null>(null)
  const [selectedDwgNo, setSelectedDwgNo] = useState<string | null>(null)

  const { data, loading, error } = useAsyncData(() => fetchDashboardSnapshot(), [tick])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-inshop-xl font-semibold text-foreground">{t('fabrication.judgment.title')}</h1>
          <p className="mt-1 max-w-3xl text-inshop-sm text-foreground/68">{t('fabrication.judgment.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-inshop-md bg-surface-secondary px-2 py-1 font-mono text-2xs text-foreground/68" title={FABRICATION_API_BASE}>
            {t('fabrication.judgment.sourceBadge', { base: FABRICATION_API_BASE })}
          </span>
          <ToggleButton pressed={autoRefresh} onPressedChange={setAutoRefresh}>
            {t('fabrication.judgment.autoRefresh')}
          </ToggleButton>
          <Button size="sm" onClick={bump} disabled={loading}>
            {t('fabrication.judgment.refreshNow')}
          </Button>
          {data && (
            <span className="text-inshop-xs text-foreground/58" title={absolute(data.fetchedAt.toISOString())}>
              {t('fabrication.judgment.fetchedAt', { time: relative(data.fetchedAt.toISOString()) })}
            </span>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-status-unhealthy/40">
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip tone="critical" label={t('fabrication.judgment.apiUnreachable')} />
            <p className="text-inshop-sm text-foreground/68">
              {t('fabrication.judgment.apiHint', { base: FABRICATION_API_BASE, message: error.message })}
            </p>
          </div>
        </Card>
      )}

      {!data && loading && (
        <div className="flex justify-center py-16">
          <Spinner size={26} label={t('fabrication.judgment.loading')} className="text-accent" />
        </div>
      )}

      {data && (
        <div className={cn('space-y-6 transition-opacity', loading && 'opacity-70')}>
          <SummaryTiles summary={data.summary} />

          <div className="grid gap-5 lg:grid-cols-2">
            <CheckpointCounts summary={data.summary} />
            <StateCounts summary={data.summary} />
          </div>

          <MirrorPanel summary={data.summary} />

          <RollProgressTable
            rolls={data.rolls}
            states={data.summary.states}
            selectedRollNo={selectedRollNo}
            onSelect={(rollNo) => setSelectedRollNo((current) => (current === rollNo ? null : rollNo))}
          />
          {selectedRollNo && (
            <RollTracePanel
              rollNo={selectedRollNo}
              states={data.summary.states}
              refreshTick={tick}
              onClose={() => setSelectedRollNo(null)}
            />
          )}

          <CutProgressTable
            cuts={data.cuts}
            selectedDwgNo={selectedDwgNo}
            onSelect={(dwgNo) => setSelectedDwgNo((current) => (current === dwgNo ? null : dwgNo))}
          />
          {selectedDwgNo && (
            <CutTracePanel
              dwgNo={selectedDwgNo}
              states={data.summary.states}
              refreshTick={tick}
              onClose={() => setSelectedDwgNo(null)}
            />
          )}

          <Card>
            <SectionHeading description={t('fabrication.judgment.recent.description', { count: JUDGMENT_LIMIT })}>
              {t('fabrication.judgment.recent.title')}
            </SectionHeading>
            <JudgmentTable
              label={t('fabrication.judgment.recent.title')}
              rows={data.judgments}
              states={data.summary.states}
              emptyLabel={t('fabrication.judgment.recent.empty')}
            />
          </Card>
        </div>
      )}
    </div>
  )
}
