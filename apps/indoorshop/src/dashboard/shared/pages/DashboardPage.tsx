import { Link } from 'react-router-dom'
import { useTranslation } from '../lib/i18n/useTranslation'
import { listDocs } from '../entities/doc/api/docsRegistry'
import { getProcessZones } from '../model/processRegistry'
import { ZoneGrid } from '../features/zone-monitoring/ui/organisms/ZoneGrid'
import { StatusLegend } from '../features/zone-monitoring/ui/molecules/StatusLegend'
import { Card, SectionHeading } from '../ui/atoms/Card'
import { DocsIcon } from '../ui/icons'

export function DashboardPage() {
  const { t } = useTranslation()
  // 문서는 레포에서 그대로 읽는다 — 목록에는 앞의 몇 건만 내고 나머지는 문서 화면으로
  const docs = listDocs()
  /*
   * 공정존 카드는 각 공정 모듈이 스스로 낸다 — 대시보드가 공정 목록을 들고 있으면
   * 공정이 늘거나 판정 값이 바뀔 때마다 이 파일이 함께 바뀌어, 네 공정의 작업이
   * 전부 여기서 부딪힌다. (판정 값이 서버에서 오면 각 모듈의 몫으로 남는다.)
   */
  const zones = getProcessZones()

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
        <ZoneGrid zones={zones} />
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
