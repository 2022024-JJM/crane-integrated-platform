import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import type { InshopKey } from '../../../../shared/lib/i18n/keys'
import {
  CollectionSummaryBody,
  PanelModeTabs,
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
import { CheckIcon } from '../../../../shared/ui/icons'
import { cn } from '../../../../shared/lib/utils'
import type { FactoryOverview } from '../../../../shared/entities/factory/model/overview'
import { fetchFactoryOverviews } from '../../api/assemblyApi'
import { LidarSensorStatusList } from '../LidarSensorStatusList'
import { EquipmentInventoryPanel } from '../EquipmentInventoryPanel'
import { useFactoryEquipmentStatus } from '../../../../shared/entities/equipment/useEquipmentStatus'
import { useEquipmentTypeLabel } from '../../../../shared/entities/equipment/ui/useEquipmentTypeLabel'
import { EquipmentGlyph, symbolOfType } from '../../../../shared/entities/equipment/ui/EquipmentSymbol'
import {
  ASSEMBLY_EQUIPMENT_TYPES,
  assemblyEquipmentMarkers,
  assemblyFactoryIdOf,
  assemblyLocationIdOfBay,
  collectionRowsOf,
  factoryStatusHref,
  assemblyMapFactoryNames,
  equipmentColorOf,
  isFabricationLine,
  isRealScanBay,
  lidarSummaryOf,
  tiltOfLidar,
  toLidarSensor,
  type AssemblyEquipmentMarker,
} from '../../lib/mapEntry'
import { useBaseDate } from '../../../../shared/lib/useBaseDate'

/*
 * 조립 공정 엔트리 — '맵 진입' 화면 (process-map-entry 프레임의 소비자).
 *
 * 도장 배치 맵과 같은 문법으로 야드 지도에서 시작한다: 조립 7공장은 조립 파랑 네온,
 * **CAS·PAS(가공 라인)는 가공 초록 그대로** 함께 선다(accentOf 생략 — 소속을 색으로
 * 속이지 않는다). 마커는 설비 엔티티의 LiDAR 실좌표·실대수이고 상태만 결정론 mock 이다.
 *
 * 우측 패널은 조립 몫의 **2단**이다(panelHeaderExtra + factoryBody):
 *  ① 설비 상태 — 그 공장의 설비 전부를 종류 구획으로(라이다는 베이별). 라이다도 설비라
 *     예전의 '센서 상태'와 '설비'를 한 단으로 합쳤다(W6-5) — 같은 공장의 장비를 두 군데서
 *     따로 세면 "뭐가 몇 대 있고 지금 몇 대가 이상인가"를 한 번에 볼 수 없다.
 *  ② 수집 현황 — 감지 블록·오늘 판별·최근 수집(기존 assemblyApi mock 집계).
 *     CAS/PAS 는 수집이 아직 없다 — 모드B 라인 카운팅 예정임을 문구로 말한다.
 *
 * 베이를 드릴하면 카드의 지번 목록 아래(bayBody)에 그 베이의 센서 대수·블록 요약과
 * 기존 정반 현황(뷰어) 라우트로 나가는 문이 선다. PBS 5BAY 는 실측 스캔이라 '실측' 칩을
 * 달고 진입해 확인하게 한다. 기존 공장 목록(그리드)은 /zones/assembly/list 로 병존한다.
 */

type PanelMode = 'equipment' | 'collection'

const LIDAR_COLOR = equipmentColorOf('LIDAR')

/**
 * 지도에 세울 종류의 기본값 — 라이다·Edge PC·Network Panel.
 *
 * ⚠️ 틸팅은 기본으로 끈다. 페어 라이다에서 **1.7m** 떨어져 서기 때문에 함께 켜면 두 점이
 * 겹쳐 어느 쪽을 눌렀는지 알 수 없다. 틸팅 상태는 라이다 마커 상세에서 페어로 읽히고,
 * 그래도 지도에서 보고 싶으면 아래 종류 토글로 켠다.
 */
const DEFAULT_MARKER_TYPES: string[] = ['LIDAR', 'EDGE', 'PNL']

/** 패널 안의 '더 볼 곳' 문 — 수집 요약 본문이 라우터를 모르게 렌더 함수로 넘긴다 */
function PanelLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="mt-1 flex items-center justify-between rounded-inshop-md px-2 py-1.5 text-2xs font-medium text-white/75 transition-colors hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }}
    >
      <span>{label}</span>
      <span aria-hidden="true">→</span>
    </Link>
  )
}

/** 상태 → 마커 표현 — 온라인은 종류색 채움, 오프라인은 꺼짐, 오류는 붉은 링 펄스 */
function markerLook(state: AssemblyEquipmentMarker['state'], color: string) {
  if (state === 'error')
    return { fill: 'rgba(9,14,20,0.85)', border: '#ff5252', glow: '0 0 0 2px #ff5252', pulse: true, dim: false }
  if (state === 'offline')
    return { fill: 'rgba(9,14,20,0.85)', border: color, glow: '0 1px 3px rgba(0,0,0,0.5)', pulse: false, dim: true }
  return {
    fill: color,
    border: 'rgba(255,255,255,0.4)',
    glow: `0 0 10px ${color}b3`,
    pulse: false,
    dim: false,
  }
}

export function AssemblyMapEntryPage() {
  const { t } = useTranslation()
  /* 설비 종류의 화면 이름 — 레지스트리(도면 이름) 대신 라벨 층을 지난다 */
  const typeLabelOf = useEquipmentTypeLabel()
  const { parcels, basemapLayers, yardExtent } = useMapEntryData()

  const factoryNames = useMemo(() => assemblyMapFactoryNames(), [])
  const { selectedFactory, setSelectedFactory, initialOverview } = useShopDeepLink(factoryNames)

  /* 우측 패널의 단 — 조립 모듈 소유 state. 프레임은 이 토글의 존재를 모른다 */
  const [panelMode, setPanelMode] = useState<PanelMode>('equipment')

  const [markerTypes, setMarkerTypes] = useState<string[]>(DEFAULT_MARKER_TYPES)
  const markers = useMemo(
    () => assemblyEquipmentMarkers(factoryNames, markerTypes),
    [factoryNames, markerTypes]
  )
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  useEffect(() => {
    setSelectedMarkerId(null)
  }, [selectedFactory])
  const selectedMarker = selectedMarkerId
    ? (markers.find((m) => m.id === selectedMarkerId) ?? null)
    : null
  /* 마커 상세가 페어 틸팅의 각·모드를 말하려면 그 공장의 상태 스냅샷이 필요하다.
     우측 목록과 같은 스토어를 보므로 폴링이 두 번 돌지는 않는다. */
  const { snapshot: selectedStatus } = useFactoryEquipmentStatus(selectedMarker?.factory ?? '')

  /* 수집 현황(②)·베이 블록 요약의 원천 — 기존 목록 화면과 같은 집계 mock 을 그대로 쓴다 */
  const { baseDate } = useBaseDate()
  const { data: overviews } = useAsyncData<FactoryOverview[]>(
    () => fetchFactoryOverviews(baseDate),
    [baseDate]
  )
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
      breadcrumbLabel: t('common.breadcrumbNav'),
      breadcrumbYard: t('common.breadcrumbYard'),
      breadcrumbProcess: t('assembly.nav.label'),
    }),
    [t]
  )

  /*
   * 마커 글리프 — **종류 심볼**을 그대로 쓴다. 색만 다른 점 여럿을 세우면 지도에서
   * 라이다·Edge PC·판넬이 구분되지 않는다(색각 이상에서는 아예 같은 점이다).
   * 캐비닛(판넬·Edge PC)은 라이다보다 한 급 크게 세운다 — 아래를 거느리는 쪽이다.
   */
  const renderMarker = useMemo(
    () =>
      function AssemblyEquipmentGlyph(m: AssemblyEquipmentMarker, ctx: MarkerRenderCtx) {
        const color = equipmentColorOf(m.typeId)
        const look = markerLook(m.state, color)
        const cabinet = m.typeId === 'PNL' || m.typeId === 'EDGE'
        const size = ctx.inOverview ? (cabinet ? 12 : 10) : cabinet ? 19 : 16
        return (
          <span
            className={cn(
              'flex items-center justify-center border transition-transform duration-150',
              cabinet ? 'rounded-[4px]' : 'rounded-full',
              ctx.selected ? 'scale-125' : !ctx.inOverview && 'hover:scale-110',
              look.pulse && 'animate-pulse'
            )}
            style={{
              width: size,
              height: size,
              background: look.fill,
              borderColor: look.border,
              color: look.dim ? color : '#fff',
              opacity: look.dim ? 0.45 : 1,
              boxShadow: [look.glow, ctx.selected ? `0 0 0 3px ${color}59` : null]
                .filter(Boolean)
                .join(', '),
            }}
          >
            <EquipmentGlyph symbol={symbolOfType(m.typeId)} size={Math.round(size * 0.62)} />
          </span>
        )
      },
    []
  )

  /*
   * 좌상단 상세 — 고른 설비 한 대. 라이다는 기존 센서 카드 문법을 그대로 쓰고, 그 아래
   * **페어 틸팅**을 한 줄 붙인다(라이다가 지금 어디를 보고 있는지는 틸팅이 안다).
   * 라이다가 아닌 종류는 설비 목록과 같은 낱말로 요약한다.
   */
  const selectedTilt =
    selectedMarker?.typeId === 'LIDAR' ? tiltOfLidar(selectedMarker.id, selectedStatus) : null
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
        {selectedMarker.typeId === 'LIDAR' ? (
          <LidarSensorStatusList sensors={[toLidarSensor({
            id: selectedMarker.id,
            typeId: 'LIDAR',
            factory: selectedMarker.factory,
            bay: selectedMarker.bay,
            panelId: selectedMarker.panelId,
            lat: selectedMarker.lat,
            lon: selectedMarker.lon,
            x: 0,
            y: 0,
          })]} />
        ) : (
          <p className="flex items-center gap-1.5 text-inshop-xs text-white/70">
            <span className="font-medium">
              {typeLabelOf(selectedMarker.typeId)}
            </span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span className={cn(selectedMarker.state === 'online' ? 'text-status-healthy' : 'text-status-unhealthy')}>
              {t(`assembly.equipment.link.${selectedMarker.state === 'calibrating' ? 'online' : selectedMarker.state}`)}
            </span>
          </p>
        )}
        {selectedTilt && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-white/55">
            <span className="font-medium text-white/72">{t('assembly.equipment.pairTilt')}</span>
            <span className="font-mono text-white/80">{selectedTilt.id}</span>
            <span>{t(`assembly.equipment.tiltMode.${selectedTilt.mode}`)}</span>
            <span className="font-mono tabular-nums">
              pan {selectedTilt.panDeg}° / tilt {selectedTilt.tiltDeg}°
            </span>
            {!selectedTilt.atTarget && (
              <span className="text-status-degraded">{t('assembly.equipment.movingToTarget')}</span>
            )}
          </p>
        )}
        {/* 이 설비가 물린 캐비닛 — 여기가 죽으면 이 설비도 같이 죽는다 */}
        {selectedMarker.panelId && (
          <p className="mt-1.5 flex items-center gap-1.5 text-2xs text-white/45">
            <span>{t('assembly.equipment.hostPanel')}</span>
            <span className="font-mono text-white/70">{selectedMarker.panelId}</span>
          </p>
        )}
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
    <div className="flex flex-col gap-1.5">
      <PanelModeTabs<PanelMode>
        tabs={[
          { id: 'equipment', label: t('assembly.mapEntry.modeEquipment') },
          { id: 'collection', label: t('assembly.mapEntry.modeCollection') },
        ]}
        value={panelMode}
        onChange={setPanelMode}
        ariaLabel={t('assembly.mapEntry.modeLabel')}
      />
      {/* 지도에 세울 종류 — 틸팅은 라이다와 겹쳐 서므로 기본은 꺼 둔다 */}
      <div className="flex flex-wrap items-center gap-1" aria-label={t('assembly.mapEntry.markerTypesLabel')}>
        {ASSEMBLY_EQUIPMENT_TYPES.map((typeId) => {
          const on = markerTypes.includes(typeId)
          const color = equipmentColorOf(typeId)
          return (
            <button
              key={typeId}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setMarkerTypes((prev) =>
                  prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]
                )
              }
              title={
                typeId === 'TILT' ? t('assembly.mapEntry.tiltToggleHint') : undefined
              }
              /*
               * 켜짐/꺼짐이 **가는 테두리 하나로만** 갈렸다 — 3m 밖에서는 어느 층이
               * 켜져 있는지 알 수 없었다(감사 A3). 켜진 칩은 체크 + 진한 채움,
               * 꺼진 칩은 글리프까지 함께 감쇄해 두 상태를 형태로도 가른다.
               */
              className={cn(
                'flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                on ? 'font-medium text-white' : 'text-white/40 opacity-60 hover:opacity-100 hover:text-white/70'
              )}
              style={{
                borderColor: on ? color : 'rgba(255,255,255,0.12)',
                background: on ? `${color}59` : 'transparent',
              }}
            >
              {on ? (
                <CheckIcon size={9} className="shrink-0" />
              ) : (
                <EquipmentGlyph symbol={symbolOfType(typeId)} size={10} />
              )}
              {typeLabelOf(typeId)}
            </button>
          )
        })}
      </div>
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
    /* ① 설비 상태 — 라이다·틸팅·Edge PC·캐비닛을 한 목록 체계로 */
    if (panelMode === 'equipment') {
      return <EquipmentInventoryPanel factory={factory} />
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
    /* 줄 구성·값·나가는 경로는 lib 이 정한다 — 규칙이 UI 안에 있으면 검증할 수 없다 */
    const href = factoryStatusHref(factory)
    return (
      <CollectionSummaryBody
        rows={collectionRowsOf(overview).map((row) => ({
          label: t(row.labelKey as InshopKey),
          value: row.value,
        }))}
        link={
          href
            ? {
                to: href,
                label: t('assembly.mapEntry.collection.openFactory'),
                render: (to, label) => <PanelLink to={to} label={label} />,
              }
            : undefined
        }
      />
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
          <ProcessMapEntry<AssemblyEquipmentMarker>
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
                {/* 범례는 지금 켜 둔 종류만 — 지도에 없는 그림을 설명하지 않는다 */}
                {ASSEMBLY_EQUIPMENT_TYPES.filter((id) => markerTypes.includes(id)).map((typeId) => {
                  const cabinet = typeId === 'PNL' || typeId === 'EDGE'
                  return (
                    <span key={typeId} className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'inline-flex h-3.5 w-3.5 items-center justify-center border border-white/40 text-white',
                          cabinet ? 'rounded-[3px]' : 'rounded-full'
                        )}
                        style={{ background: equipmentColorOf(typeId) }}
                      >
                        <EquipmentGlyph symbol={symbolOfType(typeId)} size={9} />
                      </span>
                      {typeLabelOf(typeId)}
                    </span>
                  )
                })}
                <span className="mt-0.5 text-foreground/45">
                  {t('assembly.mapEntry.legend.equipment')}
                </span>
                <span className="text-foreground/45">
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
