import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { Card, SectionHeading } from '../../../shared/ui/atoms/Card'
import type { DashboardSummary } from '../model/dashboard'
import { CHECKPOINT_ORDER, codeLabel } from '../lib/labels'
import { CountBars } from './CountBars'

/** 절점별 판별 건수 — fabrication_judgment_result.checkpoint 집계 */
export function CheckpointCounts({ summary }: { summary: DashboardSummary }) {
  const { t, i18n } = useTranslation()
  const known = new Set<string>(CHECKPOINT_ORDER)
  const keys: string[] = [
    ...CHECKPOINT_ORDER,
    // yml 어휘 밖의 절점(UNKNOWN 등)이 결과에 섞이면 숨기지 않고 뒤에 세운다
    ...Object.keys(summary.checkpointCounts).filter((key) => !known.has(key)),
  ]
  const items = keys.map((key) => {
    const label = codeLabel(t, i18n, 'checkpoint', key)
    const count = summary.checkpointCounts[key] ?? 0
    return { key, label, code: key, count, title: t('fabrication.judgment.checkpoints.barTitle', { label, count }) }
  })

  return (
    <Card>
      <SectionHeading description={t('fabrication.judgment.checkpoints.description')}>
        {t('fabrication.judgment.checkpoints.title')}
      </SectionHeading>
      <CountBars items={items} emptyLabel={t('fabrication.judgment.checkpoints.empty')} />
    </Card>
  )
}

/** 추적객체 현재 상태 분포 — fabrication_process_status.current_state_id 집계, 순서는 fabrication.yml */
export function StateCounts({ summary }: { summary: DashboardSummary }) {
  const { t } = useTranslation()
  const knownStates = new Set(summary.states.map((state) => state.stateId))
  const items = [
    ...summary.states.map((state) => ({
      key: state.stateId,
      label: state.name,
      code: state.stateId,
      count: summary.stateCounts[state.stateId] ?? 0,
      badge: state.terminal ? t('fabrication.judgment.states.terminal') : undefined,
    })),
    // 설정에서 사라진 상태 id 가 DB 에 남아 있으면 id 그대로 보인다
    ...Object.entries(summary.stateCounts)
      .filter(([stateId]) => !knownStates.has(stateId))
      .map(([stateId, count]) => ({ key: stateId, label: stateId, count })),
  ]

  return (
    <Card>
      <SectionHeading description={t('fabrication.judgment.states.description')}>
        {t('fabrication.judgment.states.title')}
      </SectionHeading>
      <CountBars items={items} emptyLabel={t('fabrication.judgment.checkpoints.empty')} />
    </Card>
  )
}
