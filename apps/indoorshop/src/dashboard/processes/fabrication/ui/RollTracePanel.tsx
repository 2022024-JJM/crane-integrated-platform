import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { Card, SectionHeading } from '../../../shared/ui/atoms/Card'
import { Button } from '../../../shared/ui/atoms/Button'
import { Spinner } from '../../../shared/ui/atoms/Spinner'
import { StatusChip } from '../../../shared/ui/atoms/StatusChip'
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import { cn } from '../../../shared/lib/utils'
import { fetchRollTrace } from '../api/fabricationApi'
import type { JudgmentRow, RollTrace, StateInfo } from '../model/dashboard'
import { ROLL_CHECKPOINTS, codeLabel, ptnHead, stateLabel } from '../lib/labels'
import { useCompactTime } from '../lib/useCompactTime'
import { JudgmentTable } from './JudgmentTable'
import { RollVerdictChip } from './RollProgressTable'
import { BodyRow, CodeWithLabel, DataTable, EmptyRow, HeadRow, IdentityPill, Td, Th, TimeCell } from './parts'

/**
 * ROLL 한 장의 판별 근거.
 *
 * 위에는 절점마다 **기반 컬럼 값 ↔ 판별 행**을 한 줄에 놓은 대조표, 아래에는 그 판별에
 * 쓰인 나머지 미러 행(선별 지시·불출 지시·작업 이력)과 판별 결과 원본을 그대로 둔다.
 * "왜 이 상태로 판별됐는가"를 레거시 컬럼 이름으로 되짚을 수 있어야 한다.
 */
export function RollTracePanel({
  rollNo,
  states,
  refreshTick,
  onClose,
}: {
  rollNo: string
  states: StateInfo[]
  /** 화면 갱신과 같은 박자로 다시 읽는다 */
  refreshTick: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { data, loading, error } = useAsyncData(() => fetchRollTrace(rollNo), [rollNo, refreshTick])

  return (
    <Card className="border-accent/40">
      <SectionHeading
        description={t('fabrication.judgment.trace.compareDescription')}
        action={
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t('fabrication.judgment.trace.close')}
          </Button>
        }
      >
        {t('fabrication.judgment.trace.title', { rollNo })}
      </SectionHeading>

      {error && (
        <p className="text-inshop-sm text-status-unhealthy">{t('fabrication.judgment.trace.notFound')}</p>
      )}
      {!data && loading && (
        <div className="flex justify-center py-8">
          <Spinner size={22} label={t('fabrication.judgment.trace.loading')} className="text-accent" />
        </div>
      )}
      {data && (
        <div className={cn('space-y-5 transition-opacity', loading && 'opacity-70')}>
          <TraceBody trace={data} states={states} />
        </div>
      )}
    </Card>
  )
}

function TraceBody({ trace, states }: { trace: RollTrace; states: StateInfo[] }) {
  const { t, i18n } = useTranslation()
  const { time } = useCompactTime()
  const none = t('common.none')
  const { roll } = trace
  const { mirror } = roll
  const byCheckpoint = new Map<string, JudgmentRow>(trace.judgments.map((row) => [row.checkpoint, row]))

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <IdentityPill label={t('fabrication.judgment.trace.identity.matCode')} value={mirror.matCode ?? none} code="MAT_CODE" muted={!mirror.matCode} />
        <IdentityPill label={t('fabrication.judgment.trace.identity.dwgNo')} value={mirror.dwgNo ?? none} code="DWG_NO" muted={!mirror.dwgNo} />
        <IdentityPill label={t('fabrication.judgment.trace.identity.bay')} value={mirror.bay ?? none} code="BAY" muted={!mirror.bay} />
        <IdentityPill label={t('fabrication.judgment.trace.identity.cutMchNo')} value={mirror.cutMchNo ?? none} code="CUT_MCH_NO" muted={!mirror.cutMchNo} />
        <IdentityPill label={t('fabrication.judgment.trace.identity.issPlnDate')} value={time(mirror.issPlnDate)} code="ISS_PLN_DATE" muted={!mirror.issPlnDate} />
        <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />
        <IdentityPill label={t('fabrication.judgment.trace.identity.ingestedAt')} value={time(mirror.ingestedAt)} code="ingested_at" />
        <IdentityPill label={t('fabrication.judgment.trace.identity.updatedAt')} value={time(mirror.updatedAt)} code="updated_at" />
        <RollVerdictChip roll={roll} />
      </div>

      {/* 절점별 대조표 */}
      <DataTable label={t('fabrication.judgment.trace.compareTitle')}>
        <thead>
          <HeadRow>
            <Th>{t('fabrication.judgment.trace.checkpoint')}</Th>
            <Th>{t('fabrication.judgment.trace.baseColumn')}</Th>
            <Th>{t('fabrication.judgment.trace.baseValue')}</Th>
            <Th>{t('fabrication.judgment.trace.judgedState')}</Th>
            <Th>{t('fabrication.judgment.trace.judgedAt')}</Th>
            <Th>{t('fabrication.judgment.rolls.verdict')}</Th>
          </HeadRow>
        </thead>
        <tbody>
          {ROLL_CHECKPOINTS.map((step) => {
            const baseValue = mirror[step.field]
            const judgment = byCheckpoint.get(step.checkpoint) ?? null
            const issueUnconfirmed = step.checkpoint === 'ISSUE' && Boolean(baseValue) && !mirror.issueConfirmed
            return (
              <BodyRow key={step.checkpoint} muted={!baseValue && !judgment}>
                <Td>
                  <CodeWithLabel code={step.checkpoint} label={codeLabel(t, i18n, 'checkpoint', step.checkpoint)} />
                </Td>
                <Td mono muted>
                  {step.column}
                </Td>
                <TimeCell iso={baseValue} emphasis />
                <Td muted={!judgment} title={judgment?.stateId}>
                  {judgment ? stateLabel(states, judgment.stateId, judgment.stateId) : none}
                </Td>
                <TimeCell iso={judgment?.judgedAt ?? null} />
                <Td>
                  <StepVerdict
                    hasBase={Boolean(baseValue)}
                    hasJudgment={Boolean(judgment)}
                    issueUnconfirmed={issueUnconfirmed}
                    emergencySkipped={mirror.emergency && (step.checkpoint === 'FIRST_PICK' || step.checkpoint === 'SECOND_PICK')}
                  />
                </Td>
              </BodyRow>
            )
          })}
        </tbody>
      </DataTable>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 선별 지시 STW07M */}
        <div>
          <h3 className="mb-2 text-inshop-sm font-semibold text-foreground">{t('fabrication.judgment.trace.pickOrders')}</h3>
          <DataTable label={t('fabrication.judgment.trace.pickOrders')}>
            <thead>
              <HeadRow>
                <Th>{t('fabrication.judgment.trace.workClsf')}</Th>
                <Th>{t('fabrication.judgment.trace.prcsClsf')}</Th>
                <Th>DWG_NO</Th>
                <Th>CUT_MCH_NO</Th>
                <Th>ISS_PLN_DATE</Th>
                <Th>{t('fabrication.judgment.trace.pickSerNo')}</Th>
              </HeadRow>
            </thead>
            <tbody>
              {trace.pickOrders.length === 0 && (
                <EmptyRow colSpan={6}>{t('fabrication.judgment.trace.pickOrdersEmpty')}</EmptyRow>
              )}
              {trace.pickOrders.map((order) => (
                <BodyRow key={order.workClsf}>
                  <Td>
                    <CodeWithLabel code={order.workClsf} label={codeLabel(t, i18n, 'workClsf', order.workClsf)} />
                  </Td>
                  <Td>
                    <CodeWithLabel code={order.prcsClsf} label={codeLabel(t, i18n, 'prcsClsf', order.prcsClsf)} />
                  </Td>
                  <Td mono muted={!order.dwgNo}>{order.dwgNo ?? none}</Td>
                  <Td mono muted={!order.cutMchNo}>{order.cutMchNo ?? none}</Td>
                  <TimeCell iso={order.issPlnDate} />
                  <Td mono muted={!order.pickSerNo}>{order.pickSerNo ?? none}</Td>
                </BodyRow>
              ))}
            </tbody>
          </DataTable>
        </div>

        {/* 불출 지시 STW08M */}
        <div>
          <h3 className="mb-2 text-inshop-sm font-semibold text-foreground">{t('fabrication.judgment.trace.issueOrder')}</h3>
          <DataTable label={t('fabrication.judgment.trace.issueOrder')}>
            <thead>
              <HeadRow>
                <Th>{t('fabrication.judgment.trace.issClsf')}</Th>
                <Th>{t('fabrication.judgment.trace.prcsClsf')}</Th>
                <Th>CUT_MCH_NO</Th>
                <Th>ISS_PLN_DATE</Th>
                <Th>updated_at</Th>
              </HeadRow>
            </thead>
            <tbody>
              {!trace.issueOrder && <EmptyRow colSpan={5}>{t('fabrication.judgment.trace.issueOrderEmpty')}</EmptyRow>}
              {trace.issueOrder && (
                <BodyRow>
                  <Td>
                    <CodeWithLabel code={trace.issueOrder.issClsf} label={codeLabel(t, i18n, 'issClsf', trace.issueOrder.issClsf)} />
                  </Td>
                  <Td>
                    <CodeWithLabel code={trace.issueOrder.prcsClsf} label={codeLabel(t, i18n, 'prcsClsf', trace.issueOrder.prcsClsf)} />
                  </Td>
                  <Td mono muted={!trace.issueOrder.cutMchNo}>{trace.issueOrder.cutMchNo ?? none}</Td>
                  <TimeCell iso={trace.issueOrder.issPlnDate} />
                  <TimeCell iso={trace.issueOrder.updatedAt} />
                </BodyRow>
              )}
            </tbody>
          </DataTable>
        </div>
      </div>

      {/* 작업 이력 STR01H */}
      <div>
        <h3 className="mb-2 text-inshop-sm font-semibold text-foreground">{t('fabrication.judgment.trace.history')}</h3>
        <DataTable label={t('fabrication.judgment.trace.history')}>
          <thead>
            <HeadRow>
              <Th>{t('fabrication.judgment.trace.ptnClsf')}</Th>
              <Th>WORK_ORD_NO</Th>
              <Th>EQP_CLSF</Th>
              <Th>{t('fabrication.judgment.trace.addr')}</Th>
              <Th>{t('fabrication.judgment.trace.start')}</Th>
              <Th>{t('fabrication.judgment.trace.end')}</Th>
            </HeadRow>
          </thead>
          <tbody>
            {trace.history.length === 0 && <EmptyRow colSpan={6}>{t('fabrication.judgment.trace.historyEmpty')}</EmptyRow>}
            {trace.history.map((row) => (
              <BodyRow key={row.id} muted={row.excluded}>
                <Td>
                  <CodeWithLabel code={row.ptnClsf} label={codeLabel(t, i18n, 'ptnHead', ptnHead(row.ptnClsf))} />
                  {row.excluded && (
                    <StatusChip
                      tone="neutral"
                      label={t('fabrication.judgment.trace.excluded')}
                      title={t('fabrication.judgment.trace.excludedHint')}
                      className="ml-2"
                    />
                  )}
                </Td>
                <Td mono muted={!row.workOrdNo}>{row.workOrdNo ?? none}</Td>
                <Td mono muted={!row.eqpClsf}>{row.eqpClsf ?? none}</Td>
                <Td mono muted={!row.fromAddr && !row.toAddr}>
                  {row.fromAddr ?? none} → {row.toAddr ?? none}
                </Td>
                <TimeCell iso={row.startDate} />
                <TimeCell iso={row.endDate} />
              </BodyRow>
            ))}
          </tbody>
        </DataTable>
      </div>

      {/* 판별 결과 원본 */}
      <div>
        <h3 className="mb-2 text-inshop-sm font-semibold text-foreground">{t('fabrication.judgment.trace.judgments')}</h3>
        <JudgmentTable
          label={t('fabrication.judgment.trace.judgments')}
          rows={trace.judgments}
          states={states}
          showTracking={false}
          emptyLabel={t('fabrication.judgment.trace.judgmentsEmpty')}
        />
      </div>
    </>
  )
}

function StepVerdict({
  hasBase,
  hasJudgment,
  issueUnconfirmed,
  emergencySkipped,
}: {
  hasBase: boolean
  hasJudgment: boolean
  issueUnconfirmed: boolean
  emergencySkipped: boolean
}) {
  const { t } = useTranslation()
  if (hasJudgment) {
    return <StatusChip tone="good" label={t('fabrication.judgment.trace.judged')} />
  }
  if (!hasBase) {
    return (
      <StatusChip
        tone="neutral"
        label={t('fabrication.judgment.trace.notReached')}
        title={emergencySkipped ? t('fabrication.judgment.trace.skippedHint') : undefined}
      />
    )
  }
  return (
    <StatusChip
      tone="warning"
      label={t('fabrication.judgment.trace.notJudged')}
      title={issueUnconfirmed ? t('fabrication.judgment.rolls.issueUnconfirmedHint') : t('fabrication.judgment.trace.droppedHint')}
    />
  )
}
