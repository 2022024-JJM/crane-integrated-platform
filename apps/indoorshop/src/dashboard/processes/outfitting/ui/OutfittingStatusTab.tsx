import { useMemo, type ReactNode } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { Link } from 'react-router-dom'
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import { useClock } from '../../../shared/lib/useClock'
import { loadYardParcels } from '../../../shared/entities/yard-parcels'
import { edgePcStatusIn, linkIn, type YardEquipment } from '../../../shared/entities/equipment'
import { useFactoryEquipmentStatus } from '../../../shared/entities/equipment/useEquipmentStatus'
import { useEquipmentTypeLabel } from '../../../shared/entities/equipment/ui/useEquipmentTypeLabel'
import type { StatusMeaning } from '../../../shared/ui/statusPalette'
import { heartbeatElapsedMinutes } from '../../../shared/features/bay-viewer/lib/freshness'
import { birdviewBaysOf, birdviewPointsOf } from '../../../shared/features/equipment-birdview'
import { EquipmentStatusBoard, type BoardGroup } from '../../../shared/features/equipment-status-board'
import { devicesByBay, deviceSummaryOf, outfittingDevices, outfittingFactoryNames, tiltDetailOf } from '../lib/equipmentStatus'
import { outfittingCells } from '../lib/equipmentCells'
import type { OutfittingDevice } from '../model/equipment'

/*
 * 선행의장 '현황' 탭 — 공용 보드(`equipment-status-board`)의 의장 소비자.
 *
 * 이 파일이 하는 일은 **번역과 변환**뿐이다: 의장 설비를 보드가 아는 어휘(공장 줄·베이
 * 외곽·설비 점·그리드 셀)로 옮긴다. 화면 문법은 세 공정이 공유한다.
 */

const LINK_LABEL_KEY = {
  online: '온라인',
  offline: '오프라인',
  error: '통신 오류',
} as const

/** 링크 3분류 → 상태 의미 */
function meaningOfLink(link: string | null): StatusMeaning {
  if (link === 'online') return 'done'
  if (link === 'error') return 'error'
  if (link === 'offline') return 'warning'
  return 'idle'
}

export function OutfittingStatusTab({
  selectedFactory,
  onSelectFactory,
  headerExtra,
  factoryAside,
  focusBay = null,
  className,
}: {
  /** 지금 보고 있는 공장 — 탭 사이에서 공유되는 선택 */
  selectedFactory: string
  onSelectFactory: (factory: string) => void
  /**
   * 베이를 골라 들어와 있을 때 그 베이 키 — 보드가 그 구획을 고른 채로 선다.
   * 공장 전체를 펴 놓되 방금까지 보던 자리는 잃지 않는다 (조립과 같은 승계).
   */
  focusBay?: string | null
  /** 바깥이 정하는 자리 — 뷰포트에 맞춘 화면에서 남는 높이를 받는다 */
  className?: string
  /**
   * 버드뷰 위 오른쪽에 서는 문 — 기본은 '전체 설비 관제로'.
   *
   * 설비 관제 화면(`/indoorshop/zones/outfitting/equipment`)이 이 보드를 그대로 쓰는데, 거기서
   * 자기 자신으로 가는 문을 낼 수는 없다. 그래서 그 자리를 밖에서 갈아 끼운다.
   */
  headerExtra?: ReactNode
  /** 공장 목록 위에 덧붙는 것 — 설비 관제 화면의 '도면 보기' */
  factoryAside?: ReactNode
}) {
  const { t } = useTranslation()
  const typeLabelOf = useEquipmentTypeLabel()
  const { snapshot } = useFactoryEquipmentStatus(selectedFactory)
  /* 신선도가 흐르도록 — 셀 안의 경과는 셀이 직접 흘리고, 여기서는 문구 계산에만 쓴다 */
  const now = useClock(30_000)

  const { data: parcels } = useAsyncData(() => loadYardParcels(), [])

  const factories = useMemo(
    () =>
      outfittingFactoryNames().map((name) => {
        const summary = deviceSummaryOf(name)
        return { name, total: summary.total, issues: summary.issues }
      }),
    []
  )

  const devices = useMemo(() => outfittingDevices(selectedFactory), [selectedFactory])
  const freshTextOf = (device: OutfittingDevice) => {
    const minutes = heartbeatElapsedMinutes(device.lastHeartbeatAt, now)
    return minutes === null ? '-' : minutes < 1 ? t('common.justNow') : t('common.minutesAgo', { count: minutes })
  }

  const groups = useMemo((): BoardGroup[] => {
    const options = {
      freshTextOf,
      /*
       * 라이다·틸팅의 하트비트는 아직 벽시계 문자열(`HH:MM`)이라 **에폭을 싣지 않는다**.
       * 실려 있으면 셀이 경과를 스스로 흘리면서 "침묵"까지 판정하는데, mock 하트비트는
       * 늘 몇 시간 전이라 전 칸이 침묵으로 물든다 — 그러면 진짜 침묵이 묻힌다.
       * 실 에폭을 가진 것(Edge PC)만 그 축을 쓴다(`edgePcCell` 안에서).
       */
      tiltOf: (device: OutfittingDevice) => tiltDetailOf(device, snapshot),
      edgeOf: (device: OutfittingDevice) => edgePcStatusIn(snapshot, device.id),
    }
    return [...devicesByBay(devices).entries()].map(([bay, list]) => ({
      key: bay,
      title: bay === '-' ? t('outfitting.equipment.unassignedBay') : t('outfitting.equipment.bayHeading', { bay }),
      cells: outfittingCells(list, options),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, snapshot, now, t])

  const bays = useMemo(
    () => (parcels ? birdviewBaysOf(parcels.bays, selectedFactory) : []),
    [parcels, selectedFactory]
  )

  const points = useMemo(
    () =>
      birdviewPointsOf(selectedFactory, {
        severityOf: (equipment: YardEquipment) => meaningOfLink(linkIn(snapshot, equipment.id)),
        tooltipOf: (equipment: YardEquipment) => {
          const link = linkIn(snapshot, equipment.id)
          return {
            title: `${equipment.id} · ${typeLabelOf(equipment.typeId)}`,
            status: LINK_LABEL_KEY[link ?? 'offline'],
            freshness:
              equipment.bay
                ? t('outfitting.equipment.bayHeading', { bay: equipment.bay })
                : t('outfitting.equipment.unassignedBay'),
          }
        },
      }),
    [selectedFactory, snapshot, t, typeLabelOf]
  )

  return (
    <EquipmentStatusBoard
      factories={factories}
      selectedFactory={selectedFactory}
      onSelectFactory={onSelectFactory}
      bays={bays}
      points={points}
      groups={groups}
      /* 아래 세 가지는 조립 현황 탭과 같은 이유로 켠다 — 같은 화면 문법을 쓰는 이상
         한 공정에서만 꺼져 있을 근거가 없다(의장도 한 베이에 네 종류가 섞여 선다).

         · namedLamps  — 라이다[링크·틸팅] / Edge PC[링크·MQTT·수집] / 캐비닛[전원·업링크·소속]
                         은 램프 셋의 뜻이 서로 다르다. 익명 점이면 순서를 아는 사람만 읽는다.
         · colorByType — 네 종류가 한 배치도에 섞여 서므로, 종류색과 범례가 없으면 12px 판
                         안의 글리프 하나로 넷을 갈라야 한다.
         · sideBySide  — 위아래로 쌓으면 배치를 키운 대가를 목록이 치른다. */
      namedLamps
      colorByType
      sideBySide
      factoryAside={factoryAside}
      /* 베이에서 건너왔으면 그 구획을 골라 둔 채로 (베이 → 현황 승계) */
      focusGroupKey={focusBay}
      className={className}
      headerExtra={
        headerExtra ?? (
          <Link
            to={`/indoorshop/zones/outfitting/equipment?shop=${encodeURIComponent(selectedFactory)}`}
            className="shrink-0 rounded-inshop-md border border-border px-2 py-0.5 text-2xs text-foreground/68 transition-colors hover:bg-surface-secondary hover:text-foreground"
          >
            {t('outfitting.workspace.toEquipmentConsole')}
          </Link>
        )
      }
    />
  )
}
