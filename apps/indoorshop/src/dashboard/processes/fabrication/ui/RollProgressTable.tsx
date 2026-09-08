import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { Card, SectionHeading } from '../../../shared/ui/atoms/Card'
import { StatusChip } from '../../../shared/ui/atoms/StatusChip'
import type { RollProgress, StateInfo } from '../model/dashboard'
import { codeLabel, stateLabel } from '../lib/labels'
import { useCompactTime } from '../lib/useCompactTime'
import { BodyRow, CodeWithLabel, DataTable, EmptyRow, HeadRow, Td, Th, TimeCell } from './parts'

/** 기반 데이터 ↔ 판별 대조 결과 한 칸 */
export function RollVerdictChip({ roll }: { roll: RollProgress }) {
  const { t } = useTranslation()
  if (!roll.judgedStateId && !roll.mirrorStageId) {
    return <StatusChip tone="neutral" label={t('fabrication.judgment.rolls.pending')} title={t('fabrication.judgment.rolls.pendingHint')} />
  }
  if (!roll.judgedStateId) {
    return <StatusChip tone="neutral" label={t('fabrication.judgment.rolls.pending')} title={t('fabrication.judgment.rolls.pendingHint')} />
  }
  if (roll.gap) {
    return <StatusChip tone="warning" label={t('fabrication.judgment.rolls.gap')} title={t('fabrication.judgment.rolls.gapHint')} />
  }
  return <StatusChip tone="good" label={t('fabrication.judgment.rolls.synced')} title={t('fabrication.judgment.rolls.syncedHint')} />
}

export function RollProgressTable({
  rolls,
  states,
  selectedRollNo,
  onSelect,
}: {
  rolls: RollProgress[]
  states: StateInfo[]
  selectedRollNo: string | null
  onSelect: (rollNo: string) => void
}) {
  const { t, i18n } = useTranslation()
  const none = t('common.none')

  return (
    <Card>
      <SectionHeading
        description={t('fabrication.judgment.rolls.description')}
        action={
          <span className="text-inshop-xs text-foreground/58">
            {t('fabrication.judgment.rolls.showing', { count: rolls.length })}
          </span>
        }
      >
        {t('fabrication.judgment.rolls.title')}
      </SectionHeading>
      <DataTable label={t('fabrication.judgment.rolls.title')}>
        <thead>
          <HeadRow>
            <Th>{t('fabrication.judgment.rolls.rollNo')}</Th>
            <Th>{t('fabrication.judgment.rolls.stus')}</Th>
            <Th title="ACPT_DATE">{t('fabrication.judgment.rolls.received')}</Th>
            <Th title="FRST_PICK_ACTL_DATE_1">{t('fabrication.judgment.rolls.firstPick')}</Th>
            <Th title="SCND_PICK_ACTL_DATE">{t('fabrication.judgment.rolls.secondPick')}</Th>
            <Th title="ISS_ACTL_DATE · STW08M.PRCS_CLSF=3">{t('fabrication.judgment.rolls.issued')}</Th>
            <Th>{t('fabrication.judgment.rolls.mirrorStage')}</Th>
            <Th title="fabrication_process_status.current_state_id">{t('fabrication.judgment.rolls.judgedState')}</Th>
            <Th>{t('fabrication.judgment.rolls.judgedAt')}</Th>
            <Th>{t('fabrication.judgment.rolls.verdict')}</Th>
          </HeadRow>
        </thead>
        <tbody>
          {rolls.length === 0 && <EmptyRow colSpan={10}>{t('fabrication.judgment.rolls.empty')}</EmptyRow>}
          {rolls.map((roll) => {
            const { mirror } = roll
            return (
              <BodyRow
                key={mirror.rollNo}
                onClick={() => onSelect(mirror.rollNo)}
                selected={selectedRollNo === mirror.rollNo}
              >
                <Td mono className="font-semibold">
                  {mirror.rollNo}
                  {mirror.emergency && (
                    <span
                      className="ml-1.5 rounded-inshop-xs bg-status-degraded/10 px-1 py-px font-inshop-sans text-2xs font-medium text-status-degraded"
                      title={t('fabrication.judgment.rolls.emergencyHint')}
                    >
                      {t('fabrication.judgment.rolls.emergency')}
                    </span>
                  )}
                </Td>
                <Td>
                  <CodeWithLabel code={mirror.stus} label={codeLabel(t, i18n, 'stus', mirror.stus)} />
                </Td>
                <TimeCell iso={mirror.acptDate} />
                <TimeCell iso={mirror.frstPickActlDate1} />
                <TimeCell iso={mirror.scndPickActlDate} />
                <Td mono muted={!mirror.issActlDate} title={mirror.issActlDate ?? undefined}>
                  <IssueValue roll={roll} />
                </Td>
                <Td muted={!roll.mirrorStageId} title={roll.mirrorStageId ?? undefined}>
                  {stateLabel(states, roll.mirrorStageId, none)}
                </Td>
                <Td muted={!roll.judgedStateId} title={roll.judgedStateId ?? undefined} className="font-medium">
                  {stateLabel(states, roll.judgedStateId, none)}
                </Td>
                <TimeCell iso={roll.judgedAt} />
                <Td>
                  <RollVerdictChip roll={roll} />
                </Td>
              </BodyRow>
            )
          })}
        </tbody>
      </DataTable>
    </Card>
  )
}

/** 불출 일시 — STW08M 불출완료 교차 확인이 없으면 일시가 있어도 인정되지 않음을 표시 */
function IssueValue({ roll }: { roll: RollProgress }) {
  const { t } = useTranslation()
  const { time } = useCompactTime()
  const { mirror } = roll
  if (!mirror.issActlDate) return <>{t('common.none')}</>
  return (
    <>
      {time(mirror.issActlDate)}
      {!mirror.issueConfirmed && (
        <span
          className="ml-1.5 rounded-inshop-xs bg-status-degraded/10 px-1 py-px font-inshop-sans text-2xs text-status-degraded"
          title={t('fabrication.judgment.rolls.issueUnconfirmedHint')}
        >
          {t('fabrication.judgment.rolls.issueUnconfirmed')}
        </span>
      )}
    </>
  )
}
