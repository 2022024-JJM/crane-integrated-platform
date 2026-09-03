import { useMemo, useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { BasemapLayer, LatLonBounds, MapTheme } from '../../../shared/features/yard-map'
import type { YardParcels } from '../../../shared/entities/yard-parcels'
import {
  PanelModeTabs,
  ProcessMapEntry,
  type MapEntryLabels,
  type MapEntryMarker,
  type MarkerRenderCtx,
} from '../../../shared/features/process-map-entry'
import { cn } from '../../../shared/lib/utils'
import { STATUS_STYLE } from '../../../shared/ui/statusPalette'
import { paintingCollectionOf } from '../lib/collection'
import { useFactoriesEquipmentStatus } from '../../../shared/entities/equipment/useEquipmentStatus'
import { paintingInventoryOf } from '../lib/equipmentInventory'
import { PaintingCollectionBody } from './PaintingCollectionBody'
import { PaintingEquipmentPanel } from './PaintingEquipmentPanel'
import type { PaintingEquipment } from '../model/equipment'
import { type PaintingEquipmentStatus } from '../model/equipmentStatus'
import { ScadaModuleDetail } from './scada'
import {
  DEHUMIDIFIER,
  DEHUMIDIFIER_DEEP,
  EquipmentChip,
  EquipmentGlyph,
  GAS_HEATER,
  GAS_HEATER_DEEP,
} from './equipmentIcon'
import { useBaseDate } from '../../../shared/lib/useBaseDate'

/*
 * 도장 공정 배치 맵 — '맵 진입 공정 화면' 공통 프레임(process-map-entry)의 소비자.
 *
 * 맵 로딩·타 공정 지번 강등·공장 포커스/fly-to·베이 드릴다운·좌상단 한 자리 오버레이·
 * 우측 접이식 카드 패널은 전부 프레임의 몫이다(원래 이 파일에 있던 골격을 승격했다 —
 * 문법·카메라 잣대·성능 구조는 그대로다). 이 파일에 남는 것은 **도장 고유부**뿐이다:
 * 설비(제습기·가스히터) 마커의 생김새와 상태 표현, 공장 카드의 SCADA 요약·랙 본문,
 * 설비 SCADA 상세, 범례, 그리고 도장 문구(i18n 은 여기서 끝낸다 — 프레임은 t() 를
 * 모른다).
 *
 * 우측 패널은 조립·의장과 **같은 2단 토글**이다(panelHeaderExtra 슬롯):
 *  ① 설비 상태 — SCADA 자산(제습기·가스히터 86대)의 가동·온습도 랙에, 설비 마스터가
 *     데려오는 **이관 설비**(판넬·Edge PC·PLC·허브)를 같은 카드 안에 이어 붙인다.
 *  ② 수집 현황 — 이 공장에 BTS 로 귀속된 블록의 W/O·스텝 절점·일일공정률. 산식은
 *     통합실적(`shared/features/performance`)의 것을 그대로 읽는다(중복 구현 금지).
 *
 * 카드에서 '공장 현황 보기'로 나가면 그 공장의 현황 화면(`/zones/painting/{id}`)이 선다 —
 * 조립의 공장 카드 → 워크스페이스와 같은 이동 문법이다.
 */

type PanelMode = 'equipment' | 'collection'

const PAINTING_PROCESS = '도장'

/*
 * 홈 범위 잣대 — **모듈 상수여야 한다.** 이 화면은 SCADA 시계(now, 1초)·폴링 때문에
 * 매초 다시 그리는데, 이 함수를 JSX 인라인으로 넘기면 프레임의 extent 메모가 매초
 * 깨져 카메라 목표(focusBounds)가 새 객체가 되고, 지도가 매초 공장 프레이밍으로
 * 되돌아 난다 — 확대할 때마다 화면이 튕기는 깜빡임(B1)의 원인이었다.
 */
const PAINTING_LOT_FILTER = (lot: YardParcels['lots'][number]) =>
  lot.process === PAINTING_PROCESS

/** 프레임 마커 계약에 맞춘 설비 — 버튼 title/aria 문구까지 데이터로 싣는다 */
type PaintingMarker = MapEntryMarker & PaintingEquipment

interface PaintingYardMapProps {
  parcels: YardParcels
  factories: string[]
  selectedFactory: string
  /** `null` = 전체 보기로 나간다 (프레임의 드릴다운 URL 계약) */
  onSelectFactory: (factory: string | null) => void
  equipment: readonly PaintingEquipment[]
  statusById: Map<string, PaintingEquipmentStatus>
  selectedId: string | null
  onSelectEquipment: (id: string | null) => void
  now: number
  polledAt: number | null
  basemapLayers: Record<MapTheme, BasemapLayer[]>
  /** 야드 전체 범위 — 미니맵의 프레임. 없으면 도장 지번 범위로 대신한다 */
  yardExtent?: LatLonBounds | null
  /** true 면 처음을 도장 전체 보기로 연다 (딥링크 `?shop=` 진입은 false 로 그 공장을 연다) */
  initialOverview?: boolean
  className?: string
}

export function PaintingYardMap({
  parcels,
  factories,
  selectedFactory,
  onSelectFactory,
  equipment,
  statusById,
  selectedId,
  onSelectEquipment,
  now,
  polledAt,
  basemapLayers,
  yardExtent,
  initialOverview = false,
  className,
}: PaintingYardMapProps) {
  const { t } = useTranslation()

  const markers = useMemo<PaintingMarker[]>(
    () =>
      equipment.map((item) => ({
        ...item,
        title: `${item.id} · ${item.kind}`,
        ariaLabel: `${item.id} ${item.kind}`,
      })),
    [equipment]
  )

  /* 설비 마커의 생김새 — 상태색(가동 그라데이션·오프라인 감쇄·이상 펄스)은 도장의 의미론 */
  const renderMarker = useMemo(
    () =>
      function PaintingMarkerGlyph(item: PaintingMarker, ctx: MarkerRenderCtx) {
        const status = statusById.get(item.id)
        const isHeater = item.kind === '가스히터'
        const color = isHeater ? GAS_HEATER : DEHUMIDIFIER
        const deep = isHeater ? GAS_HEATER_DEEP : DEHUMIDIFIER_DEEP
        const online = !status || status.modbusLink === 'OK'
        const operating = status?.operatingMode ?? false
        const fault = (status?.faultCode ?? 0) !== 0
        return (
          <span
            className={cn(
              'flex items-center justify-center rounded-inshop-md border transition-transform duration-150',
              ctx.inOverview ? 'h-[12px] w-[12px]' : 'h-[18px] w-[18px]',
              ctx.selected ? 'scale-125' : !ctx.inOverview && 'hover:scale-110',
              fault && online && 'animate-pulse'
            )}
            style={{
              background: operating
                ? `linear-gradient(180deg, ${color} 0%, ${deep} 100%)`
                : 'rgba(9,14,20,0.85)',
              borderColor: operating ? 'rgba(255,255,255,0.4)' : color,
              color: operating ? '#fff' : color,
              opacity: online ? 1 : 0.35,
              boxShadow: [
                operating ? `0 0 10px ${color}b3` : '0 1px 3px rgba(0,0,0,0.5)',
                fault ? '0 0 0 2px #ff5252' : ctx.selected ? `0 0 0 3px ${color}59` : null,
              ]
                .filter(Boolean)
                .join(', '),
            }}
          >
            <EquipmentGlyph heater={isHeater} size={ctx.inOverview ? 8 : 11} />
          </span>
        )
      },
    [statusById]
  )

  /* 공장별 설비 목록 — 카드가 펴질 때 그 공장의 SCADA 랙 본문에 들어간다 */
  const equipmentByFactory = useMemo(() => {
    const map = new Map<string, PaintingEquipment[]>()
    for (const item of equipment) {
      const list = map.get(item.factory)
      if (list) list.push(item)
      else map.set(item.factory, [item])
    }
    for (const list of map.values()) list.sort((a, b) => a.id.localeCompare(b.id))
    return map
  }, [equipment])

  // 공장별 상태 요약 — 카드의 접힌 한 줄(가동 수·이상 점)이 폴링으로 갱신된다
  const statsByFactory = useMemo(() => {
    const map = new Map<
      string,
      { operating: number; online: number; issues: number; total: number }
    >()
    for (const factory of factories) {
      map.set(factory, { operating: 0, online: 0, issues: 0, total: 0 })
    }
    for (const item of equipment) {
      const row = map.get(item.factory)
      if (!row) continue
      const s = statusById.get(item.id)
      row.total += 1
      if (s?.operatingMode) row.operating += 1
      if (!s || s.modbusLink === 'OK') row.online += 1
      if (s && (s.modbusLink !== 'OK' || s.faultCode !== 0)) row.issues += 1
    }
    return map
  }, [factories, equipment, statusById])

  const selectedEquipment = selectedId
    ? (equipment.find((e) => e.id === selectedId) ?? null)
    : null

  /* 프레임 문구 — 도장 로케일에서 번역을 끝내 문자열로 내린다 (프레임은 t() 를 모른다) */
  const labels = useMemo<MapEntryLabels>(
    () => ({
      panelTitle: t('painting.workspace.factoriesTitle'),
      viewAll: t('painting.workspace.viewAll'),
      viewAllHint: t('painting.workspace.viewAllHint'),
      expand: t('painting.workspace.expand'),
      collapse: t('painting.workspace.collapse'),
      viewOnMap: t('painting.workspace.viewOnMap'),
      bayCount: (n) => t('dashboard.map.bayCount', { count: n }),
      breadcrumbLabel: t('common.breadcrumbNav'),
      breadcrumbYard: t('common.breadcrumbYard'),
      breadcrumbProcess: t('painting.nav.label'),
    }),
    [t]
  )

  /* ── 우측 패널 2단 — 도장 몫의 state. 프레임은 이 토글의 존재를 모른다 ── */
  const [panelMode, setPanelMode] = useState<PanelMode>('equipment')

  /*
   * 수집 현황 집계 — 기준일(오늘) 하루치라 **하루에 한 번만** 세면 된다. 이 화면은 SCADA
   * 시계(now, 1초) 때문에 매초 다시 그리므로, 기준일을 마운트 때 한 번 굳혀 두지 않으면
   * 매초 40여 블록의 스텝 실적을 다시 생성하게 된다.
   */
  /* 기준일 — `?date=` 를 따라온다(예전에는 마운트 시점의 오늘로 굳었다) */
  const { baseDate } = useBaseDate()
  const collectionByFactory = useMemo(() => {
    const map = new Map<string, ReturnType<typeof paintingCollectionOf>>()
    for (const factory of factories) map.set(factory, paintingCollectionOf(factory, baseDate))
    return map
  }, [factories, baseDate])

  /* 이관 설비 상태는 공용 설비 계약에서 **구독**한다 — SCADA 폴링(제습기·가스히터)과는
     계약이 다르므로 한 통에 담지 않는다. 스냅샷이 바뀔 때만 다시 센다(매초가 아니다). */
  const { snapshot: equipmentStatus } = useFactoriesEquipmentStatus(factories)
  const inventoryByFactory = useMemo(() => {
    const map = new Map<string, ReturnType<typeof paintingInventoryOf>>()
    for (const factory of factories) {
      map.set(factory, paintingInventoryOf(factory, equipmentStatus))
    }
    return map
  }, [factories, equipmentStatus])

  const panelHeaderExtra = (
    <PanelModeTabs<PanelMode>
      tabs={[
        { id: 'equipment', label: t('painting.mapEntry.modeEquipment') },
        { id: 'collection', label: t('painting.mapEntry.modeCollection') },
      ]}
      value={panelMode}
      onChange={setPanelMode}
      ariaLabel={t('painting.mapEntry.modeLabel')}
    />
  )

  return (
    <ProcessMapEntry<PaintingMarker>
      parcels={parcels}
      factoryNames={factories}
      /* 도장 홈 범위의 기존 잣대 — 공장에 안 묶인 도장 지번까지 담는다 (회귀 0) */
      extentLotFilter={PAINTING_LOT_FILTER}
      basemapLayers={basemapLayers}
      yardExtent={yardExtent}
      selectedFactory={selectedFactory}
      onSelectFactory={onSelectFactory}
      initialOverview={initialOverview}
      markers={markers}
      selectedMarkerId={selectedId}
      onSelectMarker={onSelectEquipment}
      renderMarker={renderMarker}
      detailOverlay={
        selectedEquipment ? (
          <ScadaModuleDetail
            equipment={selectedEquipment}
            status={statusById.get(selectedEquipment.id)}
            now={now}
            onBack={() => onSelectEquipment(null)}
          />
        ) : undefined
      }
      panelHeaderExtra={panelHeaderExtra}
      /* 요약 한 줄은 **지금 보고 있는 단**을 말한다 — 설비 단이면 가동 n/n, 수집 단이면
         절점 n/n. 카드를 펴지 않고도 토글이 무엇을 바꿨는지 읽히게 하려는 것이다. */
      factorySummary={(factory) => {
        if (panelMode === 'collection') {
          const collection = collectionByFactory.get(factory)
          const inProgress = collection?.inProgressBlocks ?? 0
          return (
            <>
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  inProgress > 0 ? STATUS_STYLE.inProgress.glassFill : 'bg-white/25'
                )}
                title={t('painting.mapEntry.collection.inProgressBlocks', { count: inProgress })}
              />
              <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-white/55">
                {collection?.stepsDone ?? 0}/{collection?.stepsTotal ?? 0}{' '}
                {t('painting.mapEntry.collection.stepsUnit')}
              </span>
            </>
          )
        }
        const stats = statsByFactory.get(factory) ?? {
          operating: 0,
          online: 0,
          issues: 0,
          total: 0,
        }
        const transferredIssues = inventoryByFactory.get(factory)?.transferredIssues ?? 0
        const issues = stats.issues + transferredIssues
        return (
          <>
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                issues > 0 ? 'bg-status-degraded' : 'bg-status-healthy'
              )}
              title={`${issues} ${t('painting.workspace.summary.issues')}`}
            />
            <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-white/55">
              {stats.operating}/{stats.total} {t('painting.workspace.summary.running')}
            </span>
          </>
        )
      }}
      factoryBody={(factory) => {
        /* ② 수집 현황 — 이 공장에 BTS 로 귀속된 블록의 스텝 절점·일일공정률 */
        if (panelMode === 'collection') {
          const collection = collectionByFactory.get(factory)
          if (!collection) return null
          return <PaintingCollectionBody collection={collection} />
        }
        /* ① 설비 상태 — SCADA 자산과 이관 설비를 한 목록 체계로 (조립·의장과 같은 겉테) */
        return (
          <PaintingEquipmentPanel
            factory={factory}
            equipment={equipmentByFactory.get(factory) ?? []}
            statusById={statusById}
            selectedId={selectedId}
            polledAt={polledAt}
            onSelect={onSelectEquipment}
          />
        )
      }}
      legend={
        <>
          <span className="flex items-center gap-1.5">
            <EquipmentChip kind="제습기" size={14} />
            {t('painting.workspace.legend.dehumidifier')}
          </span>
          <span className="flex items-center gap-1.5">
            <EquipmentChip kind="가스히터" size={14} />
            {t('painting.workspace.legend.gasHeater')}
          </span>
          <span className="mt-0.5 text-foreground/45">{t('painting.workspace.approxNote')}</span>
          <span className="text-foreground/45">{t('painting.workspace.hint3d')}</span>
          {polledAt && (
            <span className="text-foreground/45">
              {t('painting.workspace.polledAt', { time: new Date(polledAt).toLocaleTimeString() })}
            </span>
          )}
        </>
      }
      labels={labels}
      className={className}
    />
  )
}
