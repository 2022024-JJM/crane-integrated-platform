import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import {
  ProcessMapEntry,
  useMapEntryData,
  useShopDeepLink,
  type BayBodyCtx,
  type MapEntryLabels,
  type MarkerRenderCtx,
} from '../../../../shared/features/process-map-entry'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import { FixedViewport } from '../../../../shared/lib/fixed-viewport/FixedViewport'
import { Spinner } from '../../../../shared/ui/atoms/Spinner'
import { cn } from '../../../../shared/lib/utils'
import type { FactoryOverview } from '../../../../shared/entities/factory/model/overview'
import { fetchFactoryOverviews } from '../../api/assemblyApi'
import { LidarSensorStatusList } from '../LidarSensorStatusList'
import {
  assemblyFactoryIdOf,
  assemblyLidarMarkers,
  assemblyLocationIdOfBay,
  assemblyMapFactoryNames,
  isFabricationLine,
  isRealScanBay,
  lidarColor,
  lidarsByBay,
  lidarSummaryOf,
  toLidarSensor,
  type AssemblyLidarMarker,
} from '../../lib/mapEntry'

/*
 * 조립 공정 엔트리 — '맵 진입' 화면 (process-map-entry 프레임의 소비자).
 *
 * 도장 배치 맵과 같은 문법으로 야드 지도에서 시작한다: 조립 7공장은 조립 파랑 네온,
 * **CAS·PAS(가공 라인)는 가공 초록 그대로** 함께 선다(accentOf 생략 — 소속을 색으로
 * 속이지 않는다). 마커는 설비 엔티티의 LiDAR 실좌표·실대수이고 상태만 결정론 mock 이다.
 *
 * 우측 패널은 조립 몫의 **2단**이다(panelHeaderExtra + factoryBody):
 *  ① 센서 상태 — 공장별 베이·센서 목록(기존 LidarSensorStatusList 문법 재사용)
 *  ② 수집 현황 — 감지 블록·오늘 판별·최근 수집(기존 assemblyApi mock 집계).
 *     CAS/PAS 는 수집이 아직 없다 — 모드B 라인 카운팅 예정임을 문구로 말한다.
 *
 * 베이를 드릴하면 카드의 지번 목록 아래(bayBody)에 그 베이의 센서 대수·블록 요약과
 * 기존 정반 현황(뷰어) 라우트로 나가는 문이 선다. PBS 5BAY 는 실측 스캔이라 '실측' 칩을
 * 달고 진입해 확인하게 한다. 기존 공장 목록(그리드)은 /zones/assembly/list 로 병존한다.
 */

type PanelMode = 'sensors' | 'collection'

const LIDAR_COLOR = lidarColor()

/** 상태 → 마커 표현 — 온라인은 라이다색 채움, 오프라인은 꺼짐, 오류는 붉은 링 펄스 */
function markerLook(status: AssemblyLidarMarker['status']) {
  if (status === 'error')
    return { fill: 'rgba(9,14,20,0.85)', border: '#ff5252', glow: '0 0 0 2px #ff5252', pulse: true, dim: false }
  if (status === 'offline')
    return { fill: 'rgba(9,14,20,0.85)', border: LIDAR_COLOR, glow: '0 1px 3px rgba(0,0,0,0.5)', pulse: false, dim: true }
  return {
    fill: `linear-gradient(180deg, ${LIDAR_COLOR} 0%, #4a35a5 100%)`,
    border: 'rgba(255,255,255,0.4)',
    glow: `0 0 10px ${LIDAR_COLOR}b3`,
    pulse: false,
    dim: false,
  }
}

export function AssemblyMapEntryPage() {
  const { t } = useTranslation()
  const { parcels, basemapLayers, yardExtent } = useMapEntryData()

  const factoryNames = useMemo(() => assemblyMapFactoryNames(), [])
  const { selectedFactory, setSelectedFactory, initialOverview } = useShopDeepLink(factoryNames)

  /* 우측 패널의 단 — 조립 모듈 소유 state. 프레임은 이 토글의 존재를 모른다 */
  const [panelMode, setPanelMode] = useState<PanelMode>('sensors')

  const markers = useMemo(() => assemblyLidarMarkers(factoryNames), [factoryNames])
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  useEffect(() => {
    setSelectedMarkerId(null)
  }, [selectedFactory])
  const selectedMarker = selectedMarkerId
    ? (markers.find((m) => m.id === selectedMarkerId) ?? null)
    : null

  /* 수집 현황(②)·베이 블록 요약의 원천 — 기존 목록 화면과 같은 집계 mock 을 그대로 쓴다 */
  const { data: overviews } = useAsyncData<FactoryOverview[]>(() => fetchFactoryOverviews(), [])
  const overviewOf = useMemo(() => {
    const byId = new Map((overviews ?? []).map((o) => [o.factory.id, o]))
    return (mapKey: string): FactoryOverview | null => {
      const id = assemblyFactoryIdOf(mapKey)
      return id ? (byId.get(id) ?? null) : null
    }
  }, [overviews])

  const labels = useMemo<MapEntryLabels>(
    () => ({
      panelTitle: t('assembly.mapEntry.panelTitle'),
      viewAll: t('assembly.mapEntry.viewAll'),
      viewAllHint: t('assembly.mapEntry.viewAllHint'),
      expand: t('assembly.mapEntry.expand'),
      collapse: t('assembly.mapEntry.collapse'),
      viewOnMap: t('assembly.mapEntry.viewOnMap'),
      bayCount: (n) => t('dashboard.map.bayCount', { count: n }),
    }),
    [t]
  )

  const renderMarker = useMemo(
    () =>
      function AssemblyLidarGlyph(m: AssemblyLidarMarker, ctx: MarkerRenderCtx) {
        const look = markerLook(m.status)
        return (
          <span
            className={cn(
              'flex items-center justify-center rounded-full border transition-transform duration-150',
              ctx.inOverview ? 'h-[10px] w-[10px]' : 'h-[16px] w-[16px]',
              ctx.selected ? 'scale-125' : !ctx.inOverview && 'hover:scale-110',
              look.pulse && 'animate-pulse'
            )}
            style={{
              background: look.fill,
              borderColor: look.border,
              opacity: look.dim ? 0.4 : 1,
              boxShadow: [look.glow, ctx.selected ? `0 0 0 3px ${LIDAR_COLOR}59` : null]
                .filter(Boolean)
                .join(', '),
            }}
          >
            {/* 라이다 픽토그램 — 회전 스캔을 뜻하는 부챗살 점 */}
            <svg aria-hidden="true" viewBox="0 0 12 12" width={ctx.inOverview ? 6 : 9} height={ctx.inOverview ? 6 : 9}>
              <circle cx="6" cy="7" r="1.6" fill="currentColor" color="#fff" />
              <path d="M2.5 4.5A4.6 4.6 0 0 1 9.5 4.5" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </span>
        )
      },
    []
  )

  /* 좌상단 상세 — 고른 LiDAR 한 대의 상태 카드 (베이 카드와 같은 한 자리를 쓴다) */
  const detailOverlay = selectedMarker ? (
    <section className="pointer-events-auto flex flex-col overflow-hidden rounded-inshop-xl border border-white/12 bg-[#0b0e12]/95 text-white shadow-[0_18px_48px_rgba(0,0,0,0.38)] backdrop-blur-xl">
      <div className="h-0.5 w-full shrink-0" style={{ backgroundColor: LIDAR_COLOR }} />
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setSelectedMarkerId(null)}
            className="-ml-1 flex items-center gap-1 rounded-inshop-sm px-1 py-0.5 text-2xs text-white/55 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <span aria-hidden="true">←</span>
            <span>{t('assembly.mapEntry.sensorCard.back')}</span>
          </button>
          <h3 className="mt-1 truncate font-mono text-inshop-lg font-semibold tracking-[-0.02em]">
            {selectedMarker.id}
          </h3>
        </div>
      </div>
      <div className="border-t border-white/8 px-4 py-3">
        <LidarSensorStatusList sensors={[toLidarSensor({
          id: selectedMarker.id,
          typeId: 'LIDAR',
          factory: selectedMarker.factory,
          bay: selectedMarker.bay,
          lat: selectedMarker.lat,
          lon: selectedMarker.lon,
          x: 0,
          y: 0,
        })]} />
        <p className="mt-2 text-2xs text-white/45">
          {t('assembly.mapEntry.sensorCard.place', {
            factory: selectedMarker.factory,
            bay: selectedMarker.bay,
          })}
        </p>
      </div>
    </section>
  ) : undefined

  /* ── 우측 패널 2단 토글 — 조립 몫 (panelHeaderExtra 슬롯) ── */
  const panelHeaderExtra = (
    <div
      role="tablist"
      aria-label={t('assembly.mapEntry.modeLabel')}
      className="flex gap-1 rounded-inshop-md border border-white/10 bg-white/[0.03] p-1"
    >
      {(
        [
          ['sensors', t('assembly.mapEntry.modeSensors')],
          ['collection', t('assembly.mapEntry.modeCollection')],
        ] as const
      ).map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={panelMode === mode}
          onClick={() => setPanelMode(mode)}
          className={cn(
            'flex-1 rounded px-2 py-1 text-2xs font-bold tracking-[-0.01em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
            panelMode === mode ? 'bg-white/14 text-white' : 'text-white/50 hover:text-white/80'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )

  const factorySummary = (factory: string) => {
    const { total, issues } = lidarSummaryOf(factory)
    return (
      <>
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            issues > 0 ? 'bg-status-degraded' : 'bg-status-healthy'
          )}
          title={t('assembly.mapEntry.issueCount', { count: issues })}
        />
        <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-white/55">
          {t('assembly.mapEntry.lidarCount', { count: total })}
        </span>
      </>
    )
  }

  const factoryBody = (factory: string) => {
    if (panelMode === 'sensors') {
      const bays = lidarsByBay(factory)
      if (bays.size === 0)
        return <p className="px-3 py-3 text-2xs text-white/45">{t('assembly.mapEntry.noSensors')}</p>
      return (
        <div className="flex flex-col gap-2 px-2 py-2">
          {[...bays.entries()].map(([bay, list]) => (
            <div key={bay}>
              <p className="mb-1 px-1 text-2xs font-semibold text-white/55">
                {t('assembly.mapEntry.bayHeading', { bay })}
                <span className="ml-1.5 font-mono text-white/35">{list.length}</span>
              </p>
              <LidarSensorStatusList sensors={list.map(toLidarSensor)} />
            </div>
          ))}
        </div>
      )
    }
    /* ② 수집 현황 — CAS/PAS 는 아직 수집이 없다(모드B 라인 카운팅 자리) */
    if (isFabricationLine(factory)) {
      return (
        <p className="px-3 py-3 text-2xs leading-relaxed text-white/50">
          {t('assembly.mapEntry.noCollection')}
        </p>
      )
    }
    const overview = overviewOf(factory)
    if (!overview)
      return <p className="px-3 py-3 text-2xs text-white/45">{t('common.loading')}</p>
    const detectedBays = overview.bays.filter((b) => b.projNo != null)
    const factoryId = assemblyFactoryIdOf(factory)
    return (
      <div className="flex flex-col gap-1.5 px-3 py-2.5 text-inshop-xs">
        <div className="flex items-center justify-between">
          <span className="text-white/50">{t('assembly.mapEntry.collection.detected')}</span>
          <span className="font-mono tabular-nums text-white/90">
            {t('assembly.mapEntry.collection.detectedValue', { count: detectedBays.length })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/50">{t('assembly.mapEntry.collection.judgedToday')}</span>
          <span className="font-mono tabular-nums text-white/90">
            {t('assembly.mapEntry.collection.judgedTodayValue', { count: overview.todayCount })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/50">{t('assembly.mapEntry.collection.lastScan')}</span>
          <span className="font-mono tabular-nums text-white/90">
            {/* 실측 정반은 ISO 시각을 준다 — 목업(HH:MM)과 같은 낱말로 줄인다 */}
            {overview.lastScanAt
              ? overview.lastScanAt.includes('T')
                ? overview.lastScanAt.slice(11, 16)
                : overview.lastScanAt
              : '—'}
          </span>
        </div>
        {factoryId && (
          <Link
            to={`/indoorshop/zones/assembly/${factoryId}`}
            className="mt-1 flex items-center justify-between rounded-inshop-md px-2 py-1.5 text-2xs font-medium text-white/75 transition-colors hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }}
          >
            <span>{t('assembly.mapEntry.collection.openFactory')}</span>
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    )
  }

  /* ── 베이 카드 본문(bayBody 슬롯) — 센서 대수·블록 요약·정반 현황으로 나가는 문 ── */
  const bayBody = ({ bay, factory }: BayBodyCtx) => {
    const bayNo = bay.id.split('#')[1] ?? ''
    const sensorCount = markers.filter((m) => m.factory === factory && m.bay === bayNo).length
    const locationId = assemblyLocationIdOfBay(bay.id)
    const factoryId = assemblyFactoryIdOf(factory)
    const overviewBay = locationId
      ? (overviewOf(factory)?.bays.find((b) => b.locationId === locationId) ?? null)
      : null
    const real = isRealScanBay(bay.id)
    return (
      <div className="flex flex-col gap-1.5 text-inshop-xs">
        <div className="flex items-center justify-between">
          <span className="text-white/50">{t('assembly.mapEntry.bayCard.sensors')}</span>
          <span className="font-mono tabular-nums text-white/90">
            {t('assembly.mapEntry.lidarCount', { count: sensorCount })}
          </span>
        </div>
        {overviewBay?.projNo && (
          <div className="flex items-center justify-between">
            <span className="text-white/50">{t('assembly.mapEntry.bayCard.block')}</span>
            <span className="font-mono tabular-nums text-white/90">
              {overviewBay.projNo}-{overviewBay.blkNo}
            </span>
          </div>
        )}
        {isFabricationLine(factory) && (
          <p className="text-2xs leading-relaxed text-white/45">
            {t('assembly.mapEntry.noCollection')}
          </p>
        )}
        {real && (
          <p className="flex items-center gap-1.5 text-2xs text-white/60">
            <span className="rounded border border-sky-400/50 bg-sky-400/15 px-1.5 py-px font-bold text-sky-200">
              {t('viewer.bayStatus.realScanBadge')}
            </span>
            {t('assembly.mapEntry.bayCard.realHint')}
          </p>
        )}
        {locationId && factoryId && (
          <Link
            to={`/indoorshop/zones/assembly/${factoryId}/${locationId}`}
            className="mt-0.5 flex items-center justify-between rounded-inshop-md px-2 py-1.5 text-2xs font-medium text-white/75 transition-colors hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }}
          >
            <span>
              {real
                ? t('assembly.mapEntry.bayCard.openReal')
                : t('assembly.mapEntry.bayCard.openBay')}
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 xl:h-full xl:min-h-0">
      <FixedViewport />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-inshop-lg font-semibold text-foreground">{t('assembly.mapEntry.title')}</h1>
        <div className="flex items-center gap-3">
          <p className="text-inshop-xs text-foreground/55">{t('assembly.mapEntry.subtitle')}</p>
          <Link
            to="/indoorshop/zones/assembly/list"
            className="rounded-inshop-md border border-border px-2.5 py-1 text-inshop-xs font-medium text-foreground/75 transition-colors hover:bg-foreground/5 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t('assembly.mapEntry.listLink')}
          </Link>
        </div>
      </div>

      <div className="relative min-h-[70vh] xl:min-h-0 xl:flex-1">
        {parcels ? (
          <ProcessMapEntry<AssemblyLidarMarker>
            parcels={parcels}
            factoryNames={factoryNames}
            basemapLayers={basemapLayers}
            yardExtent={yardExtent}
            selectedFactory={selectedFactory}
            onSelectFactory={setSelectedFactory}
            initialOverview={initialOverview}
            markers={markers}
            selectedMarkerId={selectedMarkerId}
            onSelectMarker={setSelectedMarkerId}
            renderMarker={renderMarker}
            detailOverlay={detailOverlay}
            panelHeaderExtra={panelHeaderExtra}
            factorySummary={factorySummary}
            factoryBody={factoryBody}
            bayBody={bayBody}
            legend={
              <>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-white/40"
                    style={{ background: `linear-gradient(180deg, ${LIDAR_COLOR} 0%, #4a35a5 100%)` }}
                  />
                  {t('assembly.mapEntry.legend.lidar')}
                </span>
                <span className="mt-0.5 text-foreground/45">
                  {t('assembly.mapEntry.legend.casPas')}
                </span>
                <span className="text-foreground/45">{t('assembly.mapEntry.legend.hint')}</span>
              </>
            }
            labels={labels}
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
