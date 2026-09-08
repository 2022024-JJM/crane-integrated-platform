import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../shared/lib/utils'
import type { JudgmentRow, StateInfo } from '../model/dashboard'
import { codeLabel, stateLabel } from '../lib/labels'
import { BodyRow, CodeWithLabel, DataTable, EmptyRow, HeadRow, Td, Th, TimeCell } from './parts'

/** 추적객체 표기 — 타입(ROLL/PART)을 코드처럼 앞에 붙인다 */
function TrackingCell({ type, id }: { type: string; id: string }) {
  return (
    <Td mono>
      <span
        className={cn(
          'mr-1.5 rounded-inshop-xs px-1 py-px text-2xs font-semibold',
          type === 'PART' ? 'bg-surface-secondary text-foreground/68' : 'bg-accent/10 text-accent',
        )}
      >
        {type}
      </span>
      {id}
    </Td>
  )
}

function AttributesCell({ attributes }: { attributes: Record<string, string> }) {
  const entries = Object.entries(attributes).filter(([key]) => key !== 'source_table')
  const { t } = useTranslation()
  if (entries.length === 0) return <Td muted>{t('common.none')}</Td>
  return (
    <Td>
      <span className="flex flex-wrap gap-1">
        {entries.map(([key, value]) => (
          <span
            key={key}
            className={cn(
              'rounded-inshop-xs px-1.5 py-px font-mono text-2xs',
              key === 'emergency' && value === 'true'
                ? 'bg-status-degraded/10 text-status-degraded'
                : 'bg-surface-secondary text-foreground/68',
            )}
          >
            {key}={value}
          </span>
        ))}
      </span>
    </Td>
  )
}

/**
 * fabrication_judgment_result 행 목록 — 최근 판별 카드와 ROLL 판별 근거 패널이 같이 쓴다.
 * `showTracking=false` 면 한 추적객체 안의 목록이라 추적객체 열을 뺀다.
 */
export function JudgmentTable({
  label,
  rows,
  states,
  showTracking = true,
  emptyLabel,
}: {
  /** 표의 접근 가능한 이름 */
  label: string
  rows: JudgmentRow[]
  states: StateInfo[]
  showTracking?: boolean
  emptyLabel: string
}) {
  const { t, i18n } = useTranslation()
  const none = t('common.none')
  const columnCount = showTracking ? 8 : 7

  return (
    <DataTable label={label}>
      <thead>
        <HeadRow>
          <Th>{t('fabrication.judgment.recent.judgedAt')}</Th>
          <Th>{t('fabrication.judgment.recent.occurredAt')}</Th>
          {showTracking && <Th>{t('fabrication.judgment.recent.tracking')}</Th>}
          <Th>{t('fabrication.judgment.recent.checkpoint')}</Th>
          <Th>{t('fabrication.judgment.recent.event')}</Th>
          <Th>{t('fabrication.judgment.recent.transition')}</Th>
          <Th>{t('fabrication.judgment.recent.source')}</Th>
          <Th>{t('fabrication.judgment.recent.attributes')}</Th>
        </HeadRow>
      </thead>
      <tbody>
        {rows.length === 0 && <EmptyRow colSpan={columnCount}>{emptyLabel}</EmptyRow>}
        {rows.map((row) => (
          <BodyRow key={row.id}>
            <TimeCell iso={row.judgedAt} emphasis />
            <TimeCell iso={row.occurredAt} />
            {showTracking && <TrackingCell type={row.trackingObjectType} id={row.trackingObjectId} />}
            <Td>
              <CodeWithLabel code={row.checkpoint} label={codeLabel(t, i18n, 'checkpoint', row.checkpoint)} />
            </Td>
            <Td>
              <CodeWithLabel code={row.eventType} label={codeLabel(t, i18n, 'event', row.eventType)} />
            </Td>
            <Td mono title={`${row.fromStateId ?? '∅'} → ${row.stateId}`}>
              <span className="text-foreground/50">{stateLabel(states, row.fromStateId, '∅')}</span>
              <span className="mx-1 text-foreground/40">→</span>
              <span className={cn('font-semibold', row.terminal && 'text-accent')}>
                {stateLabel(states, row.stateId, none)}
              </span>
            </Td>
            <Td mono muted={!row.sourceTable} title={row.sourceRef ?? undefined}>
              {row.sourceTable ?? none}
            </Td>
            <AttributesCell attributes={row.attributes} />
          </BodyRow>
        ))}
      </tbody>
    </DataTable>
  )
}
