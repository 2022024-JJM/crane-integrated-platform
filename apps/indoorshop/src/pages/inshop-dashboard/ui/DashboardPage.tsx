import { Link } from 'react-router-dom'
import { useTranslation } from '../../../dashboard/shared/lib/i18n/useTranslation'
import type { Zone } from '../../../dashboard/entities/zone/model/types'
import { listDocs } from '../../../dashboard/entities/doc/api/docsRegistry'
import { ZoneGrid } from '../../../dashboard/features/zone-monitoring/ui/organisms/ZoneGrid'
import { StatusLegend } from '../../../dashboard/features/zone-monitoring/ui/molecules/StatusLegend'
import { Card, SectionHeading } from '../../../dashboard/shared/ui/atoms/Card'
import { DocsIcon } from '../../../dashboard/shared/ui/icons'

/*
 * 목업 데이터.
 *
 * 판정 값(상태·건전성·건수)만 여기 두고, 사람이 읽는 문구는 전부 **번역 키**로
 * 가리킨다 — 실제 API 가 붙으면 키 자리에 서버 값이 들어온다.
 */
const mockZones: Zone[] = [
  {
    id: 'assembly',
    displayNameKey: 'zoneData.assembly.displayName',
    status: 'running',
    health: 'healthy',
    processingCount: 24,
    lastUpdateKey: 'zoneData.assembly.lastUpdate',
    source: 'LiDAR · RFID',
    statusDetailKey: 'zoneData.assembly.statusDetail',
    healthDetailKey: 'zoneData.assembly.healthDetail',
    checks: [
      { labelKey: 'zone.checkLabel.ingest', state: 'ok', detailKey: 'zoneData.assembly.ingest' },
      { labelKey: 'zone.checkLabel.judge', state: 'ok', detailKey: 'zoneData.assembly.judge' },
      { labelKey: 'zone.checkLabel.store', state: 'ok', detailKey: 'zoneData.assembly.store' },
    ],
  },
  {
    id: 'fabrication',
    displayNameKey: 'zoneData.fabrication.displayName',
    status: 'running',
    health: 'healthy',
    processingCount: 15,
    lastUpdateKey: 'zoneData.fabrication.lastUpdate',
    source: 'Legacy DB',
    statusDetailKey: 'zoneData.fabrication.statusDetail',
    healthDetailKey: 'zoneData.fabrication.healthDetail',
    checks: [
      { labelKey: 'zone.checkLabel.ingest', state: 'ok', detailKey: 'zoneData.fabrication.ingest' },
      { labelKey: 'zone.checkLabel.judge', state: 'ok', detailKey: 'zoneData.fabrication.judge' },
      { labelKey: 'zone.checkLabel.store', state: 'ok', detailKey: 'zoneData.fabrication.store' },
    ],
  },
  {
    id: 'outfitting',
    displayNameKey: 'zoneData.outfitting.displayName',
    status: 'running',
    health: 'degraded',
    processingCount: 8,
    lastUpdateKey: 'zoneData.outfitting.lastUpdate',
    source: 'RFID',
    statusDetailKey: 'zoneData.outfitting.statusDetail',
    healthDetailKey: 'zoneData.outfitting.healthDetail',
    checks: [
      { labelKey: 'zone.checkLabel.ingest', state: 'fail', detailKey: 'zoneData.outfitting.ingest' },
      { labelKey: 'zone.checkLabel.judge', state: 'warn', detailKey: 'zoneData.outfitting.judge' },
      { labelKey: 'zone.checkLabel.store', state: 'ok', detailKey: 'zoneData.outfitting.store' },
    ],
  },
  {
    id: 'painting',
    displayNameKey: 'zoneData.painting.displayName',
    status: 'running',
    health: 'healthy',
    processingCount: 12,
    lastUpdateKey: 'zoneData.painting.lastUpdate',
    source: 'PLC · Modbus',
    statusDetailKey: 'zoneData.painting.statusDetail',
    healthDetailKey: 'zoneData.painting.healthDetail',
    checks: [
      { labelKey: 'zone.checkLabel.ingest', state: 'ok', detailKey: 'zoneData.painting.ingest' },
      { labelKey: 'zone.checkLabel.judge', state: 'ok', detailKey: 'zoneData.painting.judge' },
      { labelKey: 'zone.checkLabel.store', state: 'ok', detailKey: 'zoneData.painting.store' },
    ],
  },
]

export function DashboardPage() {
  const { t } = useTranslation()
  // 문서는 레포에서 그대로 읽는다 — 목록에는 앞의 몇 건만 내고 나머지는 문서 화면으로
  const docs = listDocs()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-inshop-xl font-semibold text-foreground">{t('dashboard.title')}</h1>
        <p className="mt-1 text-inshop-sm text-foreground/68">{t('dashboard.subtitle')}</p>
      </div>

      {/* 공정존 상태 섹션 */}
      <section>
        <SectionHeading
          description={t('dashboard.zoneSectionDescription')}
          action={<StatusLegend />}
        >
          {t('dashboard.zoneSection')}
        </SectionHeading>
        <ZoneGrid zones={mockZones} />
      </section>

      {/* 문서 섹션 — 링크가 아니라 화면 안에서 읽는다 */}
      <section>
        <SectionHeading
          description={t('dashboard.docsSectionDescription')}
          action={
            <Link
              to="/indoorshop/docs"
              className="text-inshop-xs font-medium text-foreground/63 transition-colors hover:text-accent"
            >
              {t('dashboard.docsAll', { count: docs.length })}
            </Link>
          }
        >
          {t('dashboard.docsSection')}
        </SectionHeading>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {docs.slice(0, 3).map((doc) => (
            <Link
              key={doc.id}
              to={`/indoorshop/docs/${encodeURIComponent(doc.id)}`}
              className="rounded-inshop-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Card interactive className="h-full">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-inshop-sm bg-accent/10 text-accent">
                    <DocsIcon size={16} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-inshop-sm font-semibold text-foreground">{doc.title}</h3>
                    <p className="mt-1 line-clamp-2 text-inshop-xs leading-relaxed text-foreground/63">
                      {doc.summary || t('docs.noSummary')}
                    </p>
                    <p className="mt-2 truncate font-mono text-2xs text-foreground/50">
                      {doc.repoPath}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
