import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import { useMapEntryData, useShopDeepLink } from '../../../../shared/features/process-map-entry'
import { FixedViewport } from '../../../../shared/lib/fixed-viewport/FixedViewport'
import { Spinner } from '../../../../shared/ui/atoms/Spinner'
import { fetchPaintingEquipment, paintingFactories } from '../../api/paintingRepository'
import { usePolledEquipmentStatus } from '../../lib/usePolledEquipmentStatus'
import { PaintingYardMap } from '../PaintingYardMap'
import { nowMs } from '../../../../shared/lib/now'

/*
 * 선행도장 공정 화면 — 맵 중심 레이아웃.
 *
 * 도장 공장을 **painting 지번 폴리곤**(E 토대)으로 그리는 큰 지도가 화면 주 영역이다.
 * 그 위에 설비를 상태색 마커로 얹고, 설비를 누르면 우측에 상세 카드가 오버레이로 뜬다.
 * 상태값(6종 태그)은 폴링 mock(6초)이라 화면에서 값·수신 시각이 갱신된다.
 *
 * 딥링크: 야드/대시보드에서 도장 공장을 누르면 `?shop=<공장명>` 으로 온다 — 그 공장을
 * 자동으로 골라 지도가 그 공장으로 날아간다.
 */
export function PaintingWorkspace() {
  const { t } = useTranslation()

  const allEquipment = useMemo(() => fetchPaintingEquipment(), [])
  const allIds = useMemo(() => allEquipment.map((e) => e.id), [allEquipment])
  const factories = useMemo(() => paintingFactories(), [])

  // 전 공장(86대) 폴링 — 요약이 공장별 가동/온라인을 세야 하고 86대뿐이라 한 번에 받아도 가볍다.
  const { byId: statusById, polledAt } = usePolledEquipmentStatus(allIds)

  // 신선도("…초 전")가 흐르도록 1초 시계 — 폴링(6초)과 별개
  const [now, setNow] = useState(() => nowMs())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(nowMs()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // ?shop= 딥링크 → 공장 선택 (야드가 encodeURIComponent(공장명) 로 보낸다).
  // 딥링크 없이 들어오면 대시보드처럼 도장 전체 보기로 연다 — 공통 프레임의 훅이 맡는다.
  const { selectedFactory, setSelectedFactory, initialOverview } = useShopDeepLink(factories)

  // 고른 설비 상세 — 공장이 바뀌면 접는다
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    setSelectedId(null)
  }, [selectedFactory])

  // 지번/공장(lazy)·베이스맵 배경(야드 provides) — 배경이 없어도 지번은 그린다
  const { parcels, basemapLayers, yardExtent } = useMapEntryData()

  return (
    <div className="flex flex-col gap-3 xl:h-full xl:min-h-0">
      <FixedViewport />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-inshop-lg font-semibold text-foreground">
          {t('painting.workspace.title')}
        </h1>
        <p className="text-inshop-xs text-foreground/55">{t('painting.workspace.subtitle')}</p>
      </div>

      <div className="relative min-h-[70vh] xl:min-h-0 xl:flex-1">
        {parcels ? (
          <PaintingYardMap
            parcels={parcels}
            factories={factories}
            selectedFactory={selectedFactory}
            onSelectFactory={setSelectedFactory}
            equipment={allEquipment}
            statusById={statusById}
            selectedId={selectedId}
            onSelectEquipment={setSelectedId}
            now={now}
            polledAt={polledAt}
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
