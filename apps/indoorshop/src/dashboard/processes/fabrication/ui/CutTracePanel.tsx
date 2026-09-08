import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { Card, SectionHeading } from '../../../shared/ui/atoms/Card'
import { Button } from '../../../shared/ui/atoms/Button'
import { Spinner } from '../../../shared/ui/atoms/Spinner'
import { StatusChip } from '../../../shared/ui/atoms/StatusChip'
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import { cn } from '../../../shared/lib/utils'
import { fetchCutTrace } from '../api/fabricationApi'
import type { StateInfo } from '../model/dashboard'
import { stateLabel } from '../lib/labels'
import { useCompactTime } from '../lib/useCompactTime'
import { BodyRow, DataTable, EmptyRow, HeadRow, IdentityPill, Td, Th, TimeCell } from './parts'

/** 도면 하나의 절단BOM 부재 전개와 부재별 PART_CUT 판별 — ROLL→PART 추적축 전환 지점 */
export function CutTracePanel({
  dwgNo,
  states,
  refreshTick,
  onClose,
}: {
  dwgNo: string
  states: StateInfo[]
  refreshTick: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { date, time } = useCompactTime()
  const { data, loading, error } = useAsyncData(() => fetchCutTrace(dwgNo), [dwgNo, refreshTick])
  const none = t('common.none')

  return (
    <Card className="border-accent/40">
      <SectionHeading
        action={
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t('fabrication.judgment.trace.close')}
          </Button>
        }
      >
        {t('fabrication.judgment.cutTrace.title', { dwgNo })}
      </SectionHeading>

      {error && <p className="text-inshop-sm text-status-unhealthy">{t('fabrication.judgment.cutTrace.notFound')}</p>}
      {!data && loading && (
        <div className="flex justify-center py-8">
          <Spinner size={22} label={t('fabrication.judgment.cutTrace.loading')} className="text-accent" />
        </div>
      )}
      {data && (
        <div className={cn('space-y-4 transition-opacity', loading && 'opacity-70')}>
          <div className="flex flex-wrap items-center gap-1.5">
            <IdentityPill label={t('fabrication.judgment.cuts.bay')} value={data.cut.cut.cutBayNo} code="CUT_BAY_NO" />
            <IdentityPill label={t('fabrication.judgment.cuts.machine')} value={data.cut.cut.cutMchCode} code="CUT_MCH_CODE" />
            <IdentityPill label={t('fabrication.judgment.cuts.cutMfgFd')} value={date(data.cut.cut.cutMfgFd)} code="CUT_MFG_FD" />
            <IdentityPill
              label={t('fabrication.judgment.cuts.prcsStusCode')}
              value={data.cut.cut.prcsStusCode ?? none}
              code="PRCS_STUS_CODE"
              muted={!data.cut.cut.prcsStusCode}
            />
            <IdentityPill label="updated_at" value={time(data.cut.cut.updatedAt)} />
          </div>
          <DataTable label={t('fabrication.judgment.cutTrace.title', { dwgNo })}>
            <thead>
              <HeadRow>
                <Th>{t('fabrication.judgment.cutTrace.partNo')}</Th>
                <Th align="right">{t('fabrication.judgment.cutTrace.qty')}</Th>
                <Th>{t('fabrication.judgment.cutTrace.judged')}</Th>
                <Th>{t('fabrication.judgment.cutTrace.occurredAt')}</Th>
                <Th>{t('fabrication.judgment.cutTrace.judgedAt')}</Th>
              </HeadRow>
            </thead>
            <tbody>
              {data.parts.length === 0 && <EmptyRow colSpan={5}>{t('fabrication.judgment.cutTrace.empty')}</EmptyRow>}
              {data.parts.map((part) => (
                <BodyRow key={part.partNo}>
                  <Td mono className="font-semibold">{part.partNo}</Td>
                  <Td align="right" mono>{part.cutReqQty}</Td>
                  <Td>
                    {part.judgment ? (
                      <StatusChip tone="good" label={stateLabel(states, part.judgment.stateId, part.judgment.stateId)} title={part.judgment.eventId} />
                    ) : (
                      <StatusChip tone="neutral" label={t('fabrication.judgment.cutTrace.notJudged')} />
                    )}
                  </Td>
                  <TimeCell iso={part.judgment?.occurredAt ?? null} />
                  <TimeCell iso={part.judgment?.judgedAt ?? null} />
                </BodyRow>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}
    </Card>
  )
}
