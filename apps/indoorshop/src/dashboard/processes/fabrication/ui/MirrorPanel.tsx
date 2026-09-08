import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { Card, SectionHeading } from '../../../shared/ui/atoms/Card'
import { useLanguage } from '../../../shared/lib/i18n/useLanguage'
import type { DashboardSummary } from '../model/dashboard'
import { BodyRow, DataTable, HeadRow, Td, Th, TimeCell } from './parts'

/** 기반 데이터가 얼마나·언제까지 들어왔는가 + 수집기가 어디까지 읽었는가 */
export function MirrorPanel({ summary }: { summary: DashboardSummary }) {
  const { t } = useTranslation()
  const { locale } = useLanguage()

  return (
    <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
      <Card>
        <SectionHeading description={t('fabrication.judgment.mirror.description')}>
          {t('fabrication.judgment.mirror.title')}
        </SectionHeading>
        <DataTable label={t('fabrication.judgment.mirror.title')}>
          <thead>
            <HeadRow>
              <Th>{t('fabrication.judgment.mirror.table')}</Th>
              <Th align="right">{t('fabrication.judgment.mirror.rows')}</Th>
              <Th align="right">{t('fabrication.judgment.mirror.lastUpdated')}</Th>
            </HeadRow>
          </thead>
          <tbody>
            {summary.mirrorTables.map((stat) => (
              <BodyRow key={stat.table}>
                <Td mono>{stat.table}</Td>
                <Td align="right" mono muted={stat.rowCount === 0}>
                  {stat.rowCount.toLocaleString(locale)}
                </Td>
                <TimeCell iso={stat.lastUpdatedAt} align="right" />
              </BodyRow>
            ))}
          </tbody>
        </DataTable>
      </Card>

      <Card>
        <SectionHeading description={t('fabrication.judgment.mirror.watermarkDescription')}>
          {t('fabrication.judgment.mirror.watermarkTitle')}
        </SectionHeading>
        <DataTable label={t('fabrication.judgment.mirror.watermarkTitle')}>
          <thead>
            <HeadRow>
              <Th>{t('fabrication.judgment.mirror.table')}</Th>
              <Th align="right">last_polled_at</Th>
            </HeadRow>
          </thead>
          <tbody>
            {summary.watermarks.length === 0 ? (
              <BodyRow>
                <Td muted>{t('fabrication.judgment.mirror.notPolled')}</Td>
                <Td align="right" muted>
                  {t('common.none')}
                </Td>
              </BodyRow>
            ) : (
              summary.watermarks.map((watermark) => (
                <BodyRow key={watermark.sourceTable}>
                  <Td mono>{watermark.sourceTable}</Td>
                  <TimeCell iso={watermark.lastPolledAt} align="right" />
                </BodyRow>
              ))
            )}
          </tbody>
        </DataTable>
      </Card>
    </div>
  )
}
