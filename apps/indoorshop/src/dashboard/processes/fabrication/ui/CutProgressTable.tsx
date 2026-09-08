import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { Card, SectionHeading } from '../../../shared/ui/atoms/Card'
import { StatusChip } from '../../../shared/ui/atoms/StatusChip'
import type { CutProgress } from '../model/dashboard'
import { useCompactTime } from '../lib/useCompactTime'
import { BodyRow, DataTable, EmptyRow, HeadRow, Td, Th, TimeCell } from './parts'

function CutVerdict({ cut }: { cut: CutProgress }) {
  const { t } = useTranslation()
  const ratio = t('fabrication.judgment.cuts.ratio', { judged: cut.judgedPartCount, total: cut.bomPartCount })
  if (cut.bomPartCount === 0 || cut.judgedPartCount === 0) {
    return <StatusChip tone="neutral" label={`${t('fabrication.judgment.cuts.none')} ${ratio}`} />
  }
  if (cut.judgedPartCount < cut.bomPartCount) {
    return <StatusChip tone="warning" label={`${t('fabrication.judgment.cuts.partial')} ${ratio}`} />
  }
  return <StatusChip tone="good" label={`${t('fabrication.judgment.cuts.complete')} ${ratio}`} />
}

/** legacy_ypwc310m 절단 완료(도면) ↔ 절단BOM 부재의 PART_CUT 판별 */
export function CutProgressTable({
  cuts,
  selectedDwgNo,
  onSelect,
}: {
  cuts: CutProgress[]
  selectedDwgNo: string | null
  onSelect: (dwgNo: string) => void
}) {
  const { t } = useTranslation()
  const { date } = useCompactTime()

  return (
    <Card>
      <SectionHeading
        description={t('fabrication.judgment.cuts.description')}
        action={
          <span className="text-inshop-xs text-foreground/58">{t('fabrication.judgment.cuts.showing', { count: cuts.length })}</span>
        }
      >
        {t('fabrication.judgment.cuts.title')}
      </SectionHeading>
      <DataTable label={t('fabrication.judgment.cuts.title')}>
        <thead>
          <HeadRow>
            <Th>{t('fabrication.judgment.cuts.dwgNo')}</Th>
            <Th>{t('fabrication.judgment.cuts.bay')}</Th>
            <Th>{t('fabrication.judgment.cuts.machine')}</Th>
            <Th>{t('fabrication.judgment.cuts.cutMfgFd')}</Th>
            <Th>{t('fabrication.judgment.cuts.prcsStusCode')}</Th>
            <Th>updated_at</Th>
            <Th align="right">{t('fabrication.judgment.cuts.bomParts')}</Th>
            <Th>{t('fabrication.judgment.cuts.judgedParts')}</Th>
          </HeadRow>
        </thead>
        <tbody>
          {cuts.length === 0 && <EmptyRow colSpan={8}>{t('fabrication.judgment.cuts.empty')}</EmptyRow>}
          {cuts.map((row) => {
            const key = `${row.cut.mandt}/${row.cut.cutBayNo}/${row.cut.cutMchCode}/${row.cut.dwgNo}`
            return (
              <BodyRow key={key} onClick={() => onSelect(row.cut.dwgNo)} selected={selectedDwgNo === row.cut.dwgNo}>
                <Td mono className="font-semibold">{row.cut.dwgNo}</Td>
                <Td mono>{row.cut.cutBayNo}</Td>
                <Td mono>{row.cut.cutMchCode}</Td>
                <Td mono muted={!row.cut.cutMfgFd} title={row.cut.cutMfgFd ?? undefined}>
                  {date(row.cut.cutMfgFd)}
                </Td>
                <Td mono muted={!row.cut.prcsStusCode}>{row.cut.prcsStusCode ?? t('common.none')}</Td>
                <TimeCell iso={row.cut.updatedAt} />
                <Td align="right" mono>{row.bomPartCount}</Td>
                <Td>
                  <CutVerdict cut={row} />
                </Td>
              </BodyRow>
            )
          })}
        </tbody>
      </DataTable>
    </Card>
  )
}
