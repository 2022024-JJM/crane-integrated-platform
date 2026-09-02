import { useMemo } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { BasemapLayer, LatLonBounds, MapTheme } from '../../../shared/features/yard-map'
import type { YardParcels } from '../../../shared/entities/yard-parcels'
import {
  ProcessMapEntry,
  type MapEntryLabels,
  type MapEntryMarker,
  type MarkerRenderCtx,
} from '../../../shared/features/process-map-entry'
import { cn } from '../../../shared/lib/utils'
import type { PaintingEquipment } from '../model/equipment'
import { type PaintingEquipmentStatus } from '../model/equipmentStatus'
import { ScadaModuleDetail, ScadaRackBody } from './scada'
import {
  DEHUMIDIFIER,
  DEHUMIDIFIER_DEEP,
  EquipmentChip,
  EquipmentGlyph,
  GAS_HEATER,
  GAS_HEATER_DEEP,
} from './equipmentIcon'

/*
 * 도장 공정 배치 맵 — '맵 진입 공정 화면' 공통 프레임(process-map-entry)의 소비자.
 *
 * 맵 로딩·타 공정 지번 강등·공장 포커스/fly-to·베이 드릴다운·좌상단 한 자리 오버레이·
 * 우측 접이식 카드 패널은 전부 프레임의 몫이다(원래 이 파일에 있던 골격을 승격했다 —
 * 문법·카메라 잣대·성능 구조는 그대로다). 이 파일에 남는 것은 **도장 고유부**뿐이다:
 * 설비(제습기·가스히터) 마커의 생김새와 상태 표현, 공장 카드의 SCADA 요약·랙 본문,
 * 설비 SCADA 상세, 범례, 그리고 도장 문구(i18n 은 여기서 끝낸다 — 프레임은 t() 를
 * 모른다).
 */

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
  onSelectFactory: (factory: string) => void
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
    }),
    [t]
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
      factorySummary={(factory) => {
        const stats = statsByFactory.get(factory) ?? {
          operating: 0,
          online: 0,
          issues: 0,
          total: 0,
        }
        return (
          <>
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                stats.issues > 0 ? 'bg-status-degraded' : 'bg-status-healthy'
              )}
              title={`${stats.issues} ${t('painting.workspace.summary.issues')}`}
            />
            <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-white/55">
              {stats.operating}/{stats.total} {t('painting.workspace.summary.running')}
            </span>
          </>
        )
      }}
      factoryBody={(factory) => (
        <ScadaRackBody
          equipment={equipmentByFactory.get(factory) ?? []}
          statusById={statusById}
          selectedId={selectedId}
          polledAt={polledAt}
          onSelect={onSelectEquipment}
        />
      )}
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
