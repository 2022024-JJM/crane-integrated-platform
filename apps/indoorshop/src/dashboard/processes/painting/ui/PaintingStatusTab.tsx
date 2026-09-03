import { useMemo } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import { useClock } from '../../../shared/lib/useClock'
import { loadYardParcels } from '../../../shared/entities/yard-parcels'
import { linkIn, type YardEquipment } from '../../../shared/entities/equipment'
import { useFactoryEquipmentStatus } from '../../../shared/entities/equipment/useEquipmentStatus'
import { useEquipmentTypeLabel } from '../../../shared/entities/equipment/ui/useEquipmentTypeLabel'
import type { StatusMeaning } from '../../../shared/ui/statusPalette'
import { birdviewBaysOf, birdviewPointsOf } from '../../../shared/features/equipment-birdview'
import { EquipmentStatusBoard, type BoardGroup } from '../../../shared/features/equipment-status-board'
import { fetchEquipmentByFactory } from '../api/paintingRepository'
import { mockEquipmentStatus } from '../lib/equipmentStatusMock'
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

/** 이상인가 — 목록의 '점검 필요' 와 셀의 붉은 램프가 같은 규칙을 봐야 한다 */
function isIssue(status: PaintingEquipmentStatus): boolean {
  return status.faultCode !== 0 || status.modbusLink !== 'OK'
}

export function PaintingStatusTab({
  selectedFactory,
  onSelectFactory,
}: {
  selectedFactory: string
  onSelectFactory: (factory: string) => void
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

  return (
    <EquipmentStatusBoard
      factories={factories}
      selectedFactory={selectedFactory}
      onSelectFactory={onSelectFactory}
      bays={bays}
      points={points}
      groups={groups}
    />
  )
}

/** 설비ID → 그 공장의 도장 설비 (SCADA 자산이 아니면 null) */
function paintingOf(id: string, factory: string): PaintingEquipment | null {
  return fetchEquipmentByFactory(factory).find((item) => item.id === id) ?? null
}
