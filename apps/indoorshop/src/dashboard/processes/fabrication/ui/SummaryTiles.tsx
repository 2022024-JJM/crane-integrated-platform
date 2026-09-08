import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { Card } from '../../../shared/ui/atoms/Card'
import { useLanguage } from '../../../shared/lib/i18n/useLanguage'
import { useTimeFormat } from '../../../shared/lib/i18n/useTimeFormat'
import type { DashboardSummary } from '../model/dashboard'

function Tile({ label, hint, value, unit }: { label: string; hint: string; value: string; unit?: string }) {
  return (
    <Card title={hint}>
      <p className="font-mono text-inshop-xs uppercase tracking-wide text-foreground/68">{label}</p>
      <p className="mt-2 text-3xl font-bold text-foreground">
        {value}
        {unit && <span className="ml-1 text-inshop-base font-medium text-foreground/68">{unit}</span>}
      </p>
    </Card>
  )
}

/** 한 줄 요약 — 각 수치가 어느 테이블·컬럼에서 온 것인지 툴팁으로 밝힌다 */
export function SummaryTiles({ summary }: { summary: DashboardSummary }) {
  const { t } = useTranslation()
  const { locale } = useLanguage()
  const { relative, absolute } = useTimeFormat()
  const n = (value: number) => value.toLocaleString(locale)
  const unit = t('fabrication.judgment.summary.unit') || undefined
  const judgmentTotal = Object.values(summary.checkpointCounts).reduce((sum, count) => sum + count, 0)

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <Tile
        label={t('fabrication.judgment.summary.rolls')}
        hint={t('fabrication.judgment.summary.rollsHint')}
        value={n(summary.rollCount)}
        unit={unit}
      />
      <Tile
        label={t('fabrication.judgment.summary.parts')}
        hint={t('fabrication.judgment.summary.partsHint')}
        value={n(summary.partCount)}
        unit={unit}
      />
      <Tile
        label={t('fabrication.judgment.summary.judgments')}
        hint={t('fabrication.judgment.summary.judgmentsHint')}
        value={n(judgmentTotal)}
        unit={unit}
      />
      <Tile
        label={t('fabrication.judgment.summary.emergency')}
        hint={t('fabrication.judgment.summary.emergencyHint')}
        value={n(summary.emergencyIssueCount)}
        unit={unit}
      />
      <Card title={summary.lastJudgedAt ? absolute(summary.lastJudgedAt) : t('fabrication.judgment.summary.lastJudgedHint')}>
        <p className="font-mono text-inshop-xs uppercase tracking-wide text-foreground/68">
          {t('fabrication.judgment.summary.lastJudged')}
        </p>
        <p className="mt-2 text-inshop-2xl font-bold text-foreground">
          {summary.lastJudgedAt ? relative(summary.lastJudgedAt) : t('common.none')}
        </p>
      </Card>
    </div>
  )
}
