import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import { useClock } from '../../../shared/lib/useClock'
import { loadYardParcels } from '../../../shared/entities/yard-parcels'
import { linkIn, type YardEquipment } from '../../../shared/entities/equipment'
import { useFactoryEquipmentStatus } from '../../../shared/entities/equipment/useEquipmentStatus'
import { useEquipmentTypeLabel } from '../../../shared/entities/equipment/ui/useEquipmentTypeLabel'
import type { StatusMeaning } from '../../../shared/ui/statusPalette'
import { cn } from '../../../shared/lib/utils'
import { birdviewBaysOf, birdviewPointsOf } from '../../../shared/features/equipment-birdview'
import { AxisIcon } from '../../../shared/ui/icons'
import { EquipmentStatusBoard, type BoardGroup } from '../../../shared/features/equipment-status-board'
import { fetchEquipmentByFactory } from '../api/paintingRepository'
import { mockEquipmentStatus } from '../lib/equipmentStatusMock'
import { bayAirModeOf, hazeIntensityOf, streakIntensityOf, type AirUnit } from '../lib/airEffect'
import { usePaintingAirScene, warmPaintingAirScene } from '../lib/useAirScene'
import { loadPaintingFloorPlan, type PaintingFloorPlan } from '../lib/floorPlan'
import { planStationPositions } from '../lib/planStations'
import { PaintingPlanFlow, type PlanFlowBay, type PlanFlowUnit } from './PlanAirFlow'
import { Spinner } from '../../../shared/ui/atoms/Spinner'
import { ViewportFullscreenButton } from '../../../shared/ui/atoms/ViewportFullscreenButton'
import { useFullscreen } from '../../../shared/lib/useFullscreen'
import { paintingCells } from '../lib/equipmentCells'
import { PAINTING_FACTORY_ROUTE_IDS } from '../lib/factoryRoutes'
import type { PaintingEquipment } from '../model/equipment'
import type { PaintingEquipmentStatus } from '../model/equipmentStatus'

/*
 * 도장 '현황' 탭 — 공용 설비 현황 보드(`equipment-status-board`)의 도장 소비자.
 *
 * 조립·의장과 같은 자리에 같은 문법으로 선다. 도장만 다른 것은 셀의 어휘다 —
 * 램프가 [전원 / 링크(Modbus) / 이상]이고 대표값이 실측값(PV)이다(`lib/equipmentCells`).
 *
 * 상태는 SCADA 화면과 **같은 생성기**(`mockEquipmentStatus`)를 쓴다. 여기서 다른 mock 을
 * 부르면 같은 제습기가 두 화면에서 다른 온도를 말하게 된다.
 */

/*
 * 3D 는 **뒤집을 때 받는다** — three 는 무겁고, 도면만 보는 사람이 대부분이다.
 * 문 앞에 손이 얹히면 미리 받아 두므로(`onPointerEnter`) 실제로는 기다림이 없다.
 */
const PaintingAirViewer = lazy(() =>
  import('./PaintingAirViewer').then((m) => ({ default: m.PaintingAirViewer }))
)

/** 이상인가 — 목록의 '점검 필요' 와 셀의 붉은 램프가 같은 규칙을 봐야 한다 */
function isIssue(status: PaintingEquipmentStatus): boolean {
  return status.faultCode !== 0 || status.modbusLink !== 'OK'
}

export function PaintingStatusTab({
  selectedFactory,
  onSelectFactory,
  className,
}: {
  selectedFactory: string
  onSelectFactory: (factory: string) => void
  /** 바깥이 정하는 자리 — 뷰포트에 맞춘 화면에서 남는 높이를 받는다 */
  className?: string
}) {
  const { t } = useTranslation()
  const typeLabelOf = useEquipmentTypeLabel()
  /* 이관 설비(PNL·EDGE…)의 링크는 공용 계약에서 온다 — 도장 공장은 아직 0대지만
     도면이 데려오는 날 화면을 손대지 않으려고 축을 미리 이어 둔다 */
  const { snapshot } = useFactoryEquipmentStatus(selectedFactory)
  const now = useClock(6_000)
  const at = now.getTime()

  const { data: parcels } = useAsyncData(() => loadYardParcels(), [])

  /** 지금 이 순간의 도장 설비 상태 — 공장별 요약과 셀이 같은 값을 본다 */
  const statusOf = useMemo(() => {
    const cache = new Map<string, PaintingEquipmentStatus>()
    return (item: PaintingEquipment) => {
      const hit = cache.get(item.id)
      if (hit) return hit
      const made = mockEquipmentStatus(item, at)
      cache.set(item.id, made)
      return made
    }
  }, [at])

  const factories = useMemo(
    () =>
      Object.values(PAINTING_FACTORY_ROUTE_IDS).map((name) => {
        const items = fetchEquipmentByFactory(name)
        return {
          name,
          total: items.length,
          issues: items.filter((item) => isIssue(mockEquipmentStatus(item, at))).length,
        }
      }),
    [at]
  )

  const groups = useMemo((): BoardGroup[] => {
    const byBay = new Map<string, PaintingEquipment[]>()
    for (const item of fetchEquipmentByFactory(selectedFactory)) {
      const list = byBay.get(item.bay)
      if (list) list.push(item)
      else byBay.set(item.bay, [item])
    }
    return [...byBay.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([bay, list]) => ({
        key: bay,
        title: bay,
        cells: paintingCells(list, {
          statusOf,
          pendingText: t('painting.workspace.scada.pending'),
        }),
      }))
  }, [selectedFactory, statusOf, t])

  const bays = useMemo(
    () => (parcels ? birdviewBaysOf(parcels.bays, selectedFactory) : []),
    [parcels, selectedFactory]
  )

  const points = useMemo(
    () =>
      birdviewPointsOf(selectedFactory, {
        severityOf: (equipment: YardEquipment): StatusMeaning => {
          const painting = paintingOf(equipment.id, selectedFactory)
          if (painting) {
            const status = mockEquipmentStatus(painting, at)
            if (status.faultCode !== 0 || status.modbusLink === 'CRC_ERROR') return 'error'
            if (status.modbusLink === 'TIMEOUT') return 'warning'
            return status.operatingMode ? 'done' : 'idle'
          }
          const link = linkIn(snapshot, equipment.id)
          return link === 'online' ? 'done' : link === 'error' ? 'error' : 'warning'
        },
        tooltipOf: (equipment: YardEquipment) => {
          const painting = paintingOf(equipment.id, selectedFactory)
          const status = painting ? mockEquipmentStatus(painting, at) : null
          return {
            title: `${equipment.id} · ${typeLabelOf(equipment.typeId)}`,
            status: status
              ? status.operatingMode
                ? t('painting.workspace.status.operating')
                : t('painting.workspace.status.stopped')
              : (linkIn(snapshot, equipment.id) ?? '-'),
            freshness: equipment.bay || '-',
          }
        },
      }),
    [selectedFactory, snapshot, at, t, typeLabelOf]
  )

  /*
   * ── 도면이 **제자리에서** 3D 로 뒤집힌다 (R45) ──
   *
   * 처음에는 이 버튼이 '가동 뷰' 탭으로 건너뛰게 했다. 그런데 탭을 옮기는 것은 화면을
   * **바꾸는** 일이라, 방금 읽던 배치도는 사라지고 다른 화면이 새로 뜬다 — 사용자가
   * 원한 것은 그게 아니었다("2D 가 3D 로 전환되면서"). 같은 액자 안에서 같은 공장이
   * 일어서야 그 둘이 한 그림으로 읽힌다.
   *
   * 그래서 자리를 옮기지 않는다. '설비 배치' 판 안의 그림만 바뀌고, 제목도 높이도 옆의
   * 목록도 그대로다. 다시 누르면 도면으로 돌아온다.
   */
  const [live3d, setLive3d] = useState(false)
  /* 공장을 갈아타면 도면으로 돌아온다 — 다른 공장을 3D 한가운데로 던져 넣지 않는다 */
  useEffect(() => {
    setLive3d(false)
  }, [selectedFactory])

  /** 3D 장면 — 가동 뷰 탭과 **같은 재료**다(`lib/useAirScene`). 뒤집혔을 때만 모은다 */
  const { scene } = usePaintingAirScene(selectedFactory, { enabled: live3d })

  /*
   * 전체 화면 — 조립·의장 3D 와 같은 손잡이다(`f` 키 포함). 도면 자리는 판의 한 칸이라
   * 공장 하나가 베이 수십 면인 화면에서는 한 면이 손톱만 하게 남는다. `viewport-frame`
   * 은 가장자리 오버레이(요약·범례·도움말·기즈모)의 여백을 정하는 액자다 — 전체 화면에서
   * 그 여백이 커져 도구가 모니터 모서리에 붙지 않는다.
   */
  const {
    ref: viewportRef,
    isFullscreen,
    toggle: toggleFullscreen,
    supported: fullscreenSupported,
  } = useFullscreen<HTMLDivElement>()

  /* 문 앞에 손이 얹히면 미리 받아 둔다 — 누른 뒤의 빈 화면이 이어짐을 끊는다 */
  const warm = useCallback(() => {
    void import('./PaintingAirViewer')
    warmPaintingAirScene(selectedFactory)
  }, [selectedFactory])

  /*
   * 실형상 바닥 배치 — **도면도 이것을 쓴다** (R45).
   *
   * 한때 바닥 배치는 3D 만의 것이었다. 그래서 같은 EQ039 가 도면에서는 베이 가운데 줄에
   * (공용 청사진 배치), 3D 에서는 코너에(도장 관례 자리) 섰다 — 두 그림을 나란히 두고
   * "저 대가 어디 있나"를 묻는 화면에서 그건 틀린 그림이다. 이제 도면이 3D 의 자리를
   * 그대로 받아 쓴다(`lib/planStations`).
   *
   * fixture 는 캐시되므로(공장별) 3D 로 뒤집을 때 다시 받지 않는다.
   */
  const [floor, setFloor] = useState<PaintingFloorPlan | null>(null)
  useEffect(() => {
    let alive = true
    setFloor(null)
    const bayNames = [...new Set(fetchEquipmentByFactory(selectedFactory).map((i) => i.bay))].sort()
    if (bayNames.length === 0) return
    void loadPaintingFloorPlan(selectedFactory, bayNames).then((plan) => {
      if (alive) setFloor(plan)
    })
    return () => {
      alive = false
    }
  }, [selectedFactory])

  /*
   * 도면 위에 흐를 기류 — **그리드·심볼과 같은 상태값**에서 나온다(`statusOf`).
   * 세기 규칙은 3D 가동 뷰가 쓰는 것 그대로다(`lib/airEffect`) — 두 화면이 같은 값을
   * 같은 속도로 말해야 한 공장의 이야기가 된다.
   */
  const flowUnits = useMemo((): PlanFlowUnit[] => {
    return fetchEquipmentByFactory(selectedFactory).flatMap((item) => {
      const status = statusOf(item)
      const intensity =
        item.kind === '가스히터' ? hazeIntensityOf(status) : streakIntensityOf(status)
      if (intensity <= 0) return []
      return [{ id: item.id, kind: item.kind, intensity }]
    })
  }, [selectedFactory, statusOf])

  /** 베이명 → 그 베이의 설비 — 기류·물빛·도면 자리가 **한 목록**을 본다 */
  const unitsByBay = useMemo((): Map<string, AirUnit[]> => {
    const byBay = new Map<string, AirUnit[]>()
    for (const item of fetchEquipmentByFactory(selectedFactory)) {
      const status = statusOf(item)
      const intensity =
        item.kind === '가스히터' ? hazeIntensityOf(status) : streakIntensityOf(status)
      const unit: AirUnit = {
        id: item.id,
        kind: item.kind,
        x: item.x,
        y: item.y,
        running: intensity > 0,
        intensity,
        value: status.actualValue,
        setpoint: status.setpoint,
      }
      const list = byBay.get(item.bay)
      if (list) list.push(unit)
      else byBay.set(item.bay, [unit])
    }
    return byBay
  }, [selectedFactory, statusOf])

  /** 칸 하나가 지금 하는 일 — 바닥 물빛의 근거 (모드 판정도 3D 와 같은 함수다) */
  const flowBays = useMemo(
    (): PlanFlowBay[] =>
      [...unitsByBay.entries()].map(([groupKey, units]) => ({
        groupKey,
        mode: bayAirModeOf(units),
        intensity: units.reduce((max, unit) => Math.max(max, unit.intensity), 0),
      })),
    [unitsByBay]
  )

  /*
   * 도면 위 설비 자리 — 3D 의 관례 자리(`bayStations`)를 도면 좌표로 옮긴 것 (R45).
   * 투영은 버드뷰가 정하므로(그릇 크기에 맞춘다) 그쪽이 재료를 건네줄 때 푼다.
   */
  const placementFor = useCallback(
    (context: { bays: { groupKey: string; points: { x: number; y: number }[] }[] }) =>
      planStationPositions({ bays: context.bays, floor, unitsByBay }),
    [floor, unitsByBay]
  )

  return (
    <EquipmentStatusBoard
      factories={factories}
      selectedFactory={selectedFactory}
      onSelectFactory={onSelectFactory}
      bays={bays}
      points={points}
      groups={groups}
      /* 조립·의장 현황 탭과 같은 옵션 — 히터와 제습기가 한 베이에 섞여 서고(종류색·이름표),
         배치를 키운 대가를 목록이 치르지 않게 넓은 화면에서는 나란히 세운다 */
      namedLamps
      colorByType
      sideBySide
      /* 도면 위 기류 — 이 그림이 정지 화면이 아니게 하는 한 겹 (R45) */
      birdviewOverlay={(context) => (
        <PaintingPlanFlow context={context} units={flowUnits} bays={flowBays} />
      )}
      /* 설비 자리 — 3D 의 관례 자리를 도면 좌표로 옮긴 것 (R45) */
      birdviewPlacement={placementFor}
      /* '설비 배치' 제목 옆의 손잡이 — 같은 자리에서 2D ↔ 3D 를 뒤집는다 */
      birdviewActions={
        <button
          type="button"
          aria-pressed={live3d}
          onClick={() => setLive3d((on) => !on)}
          onPointerEnter={warm}
          onFocus={warm}
          title={t(live3d ? 'painting.airView.backToPlanHint' : 'painting.airView.openFromPlanHint')}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-inshop-md border px-2 py-0.5 text-2xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            live3d
              ? 'border-accent bg-accent text-on-accent hover:bg-accent/85'
              : 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
          )}
        >
          <AxisIcon size={12} />
          {t(live3d ? 'painting.airView.backToPlan' : 'painting.airView.openFromPlan')}
        </button>
      }
      /*
       * 뒤집힌 동안 도면 자리에 서는 것 — 액자는 도면의 것을 그대로 쓴다.
       * 링킹도 도면이 하던 그대로다: 3D 에서 칸을 누르면 옆 목록이 따라오고(`onSelectBay`),
       * 목록에서 칸을 누르면 3D 가 그 자리로 날아간다(`focusBay`).
       */
      birdviewReplacement={
        live3d
          ? ({ activeGroupKey, onSelectBay, selectedId }) => (
              <div
                ref={viewportRef}
                className={cn('viewport-frame absolute inset-0', isFullscreen && 'bg-[#0a0e13]')}
              >
                <Suspense fallback={<PlanFlipFallback />}>
                  {scene ? (
                    <PaintingAirViewer
                      scene={scene}
                      tiltIntro
                      focusBay={activeGroupKey}
                      onSelectBay={onSelectBay}
                      focusUnit={selectedId}
                      className="absolute inset-0"
                      topRight={
                        fullscreenSupported ? (
                          <ViewportFullscreenButton
                            isFullscreen={isFullscreen}
                            onToggle={toggleFullscreen}
                          />
                        ) : null
                      }
                    />
                  ) : (
                    <PlanFlipFallback />
                  )}
                </Suspense>
              </div>
            )
          : undefined
      }
      className={className}
    />
  )
}

/**
 * 뒤집히는 동안의 자리 — **도면과 같은 어두운 바탕**이다.
 *
 * 흰 판에 스피너를 세우면 도면(밝음) → 흰 판 → 3D(어두움) 로 명암이 두 번 뒤집혀,
 * 이어지는 한 장면이 아니라 화면 세 개가 지나간 것처럼 보인다.
 */
function PlanFlipFallback() {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className="absolute inset-0 flex items-center justify-center bg-[#0a0e13] text-2xs text-white/45"
    >
      <div className="flex flex-col items-center gap-2">
        <Spinner size={22} label={t('painting.airView.preparing')} className="text-accent" />
        <p className="text-2xs text-white/60">{t('painting.airView.preparing')}</p>
      </div>
    </div>
  )
}

/** 설비ID → 그 공장의 도장 설비 (SCADA 자산이 아니면 null) */
function paintingOf(id: string, factory: string): PaintingEquipment | null {
  return fetchEquipmentByFactory(factory).find((item) => item.id === id) ?? null
}
