import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import { useMapEntryData, useShopDeepLink } from '../../../../shared/features/process-map-entry'
import { FixedViewport } from '../../../../shared/lib/fixed-viewport/FixedViewport'
import { Spinner } from '../../../../shared/ui/atoms/Spinner'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import { fetchAllBlocks, fetchFactoryOverviews } from '../../api/outfittingApi'
import { OUTFITTING_FACTORIES } from '../../api/outfittingFactoryFixture'
import { OutfittingMapEntry } from '../OutfittingMapEntry'

/*
 * 선행의장 공정 화면 — 맵 중심 레이아웃 (도장과 같은 3단 진입: 맵 → 공장 → 베이).
 *
 * 의장 7공장을 지번 폴리곤 위 주황 네온으로 세우는 큰 지도가 화면 주 영역이다. 공장을
 * 고르면 베이로 갈라지고, 베이를 누르면 그 베이의 **블록 목록**이 카드에 선다(의장은
 * 블록이 작업 단위다). 기존 공장 목록은 `/zones/outfitting/list`, 설비 상태는
 * `/zones/outfitting/equipment` 에 병존하며 둘 다 머리의 링크로 나간다.
 *
 * 딥링크: 야드/대시보드에서 의장 공장을 누르면 `?shop=<공장명>` 으로 온다 — 그 공장을
 * 자동으로 골라 지도가 그 공장으로 날아간다.
 */
export function OutfittingMapEntryPage() {
  const { t } = useTranslation()

  /* 주인공 공장 — 의장 fixture 의 7공장. 이름이 지번 fixture(process==='의장')의 공장명과
     같다(같은 원본에서 파생) — 지번 로드를 기다리지 않고 딥링크 훅을 세울 수 있다 */
  const factories = useMemo(() => OUTFITTING_FACTORIES.map((factory) => factory.name), [])

  // ?shop= 딥링크 → 공장 선택. 딥링크 없이 들어오면 의장 전체 보기로 연다.
  const { selectedFactory, setSelectedFactory, initialOverview } = useShopDeepLink(factories)

  // 지번/공장(lazy)·베이스맵 배경(야드 provides) — 배경이 없어도 지번은 그린다
  const { parcels, basemapLayers, yardExtent } = useMapEntryData()

  /* 집계가 실패했을 때 **같은 요청만** 다시 건다 — 화면 새로고침이 아니라(states 계약) */
  const [overviewRetry, setOverviewRetry] = useState(0)
  // 목록 화면과 같은 집계(카드 요약·본문) + 전 공장 블록(베이 카드의 블록 목록)
  const {
    data: overviews,
    loading: overviewsLoading,
    error: overviewsError,
  } = useAsyncData(() => fetchFactoryOverviews(), [overviewRetry])
  const { data: blocks } = useAsyncData(() => fetchAllBlocks(), [])

  const overviewByName = useMemo(
    () => new Map((overviews ?? []).map((overview) => [overview.factory.name, overview])),
    [overviews]
  )

  return (
    <div className="flex flex-col gap-3 xl:h-full xl:min-h-0">
      <FixedViewport />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-inshop-lg font-semibold text-foreground">{t('outfitting.mapEntry.title')}</h1>
        <div className="flex items-center gap-3">
          <p className="text-inshop-xs text-foreground/55">{t('outfitting.mapEntry.subtitle')}</p>
          <Link
            to="/indoorshop/zones/outfitting/equipment"
            className="shrink-0 rounded-inshop-md border border-border px-2.5 py-1 text-inshop-xs text-foreground/68 transition-colors hover:bg-surface-secondary hover:text-foreground"
          >
            {t('outfitting.mapEntry.equipmentLink')}
          </Link>
          <Link
            to="/indoorshop/zones/outfitting/list"
            className="shrink-0 rounded-inshop-md border border-border px-2.5 py-1 text-inshop-xs text-foreground/68 transition-colors hover:bg-surface-secondary hover:text-foreground"
          >
            {t('outfitting.mapEntry.listLink')}
          </Link>
        </div>
      </div>

      <div className="relative min-h-[70vh] xl:min-h-0 xl:flex-1">
        {parcels ? (
          <OutfittingMapEntry
            parcels={parcels}
            factories={factories}
            selectedFactory={selectedFactory}
            onSelectFactory={setSelectedFactory}
            overviewByName={overviewByName}
            overviewsLoading={overviewsLoading}
            overviewsError={overviewsError}
            onRetryOverviews={() => setOverviewRetry((count) => count + 1)}
            blocks={blocks ?? []}
            basemapLayers={basemapLayers}
            yardExtent={yardExtent}
            initialOverview={initialOverview}
            className="absolute inset-0"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center rounded-inshop-lg border border-dashed border-border">
            <Spinner size={24} label={t('common.loading')} className="text-accent" />
          </div>
        )}
      </div>
    </div>
  )
}
