import { useMemo } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { useSearchParams } from 'react-router-dom'
import { equipmentFocusOf } from '../../../shared/lib/equipmentFocus'
import { foldExceptFocus } from '../../../shared/lib/equipmentFocus'
import { Link } from 'react-router-dom'
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import { useClock } from '../../../shared/lib/useClock'
import { loadYardParcels } from '../../../shared/entities/yard-parcels'
import {
  YARD_EQUIPMENT,
  edgePcStatusIn,
  linkIn,
  pairIdOf,
  panelStatusIn,
  tiltStatusIn,
  type YardEquipment,
} from '../../../shared/entities/equipment'
import { useFactoryEquipmentStatus } from '../../../shared/entities/equipment/useEquipmentStatus'
import { useEquipmentTypeLabel } from '../../../shared/entities/equipment/ui/useEquipmentTypeLabel'
import type { StatusMeaning } from '../../../shared/ui/statusPalette'
import { birdviewBaysOf, birdviewPointsOf } from '../../../shared/features/equipment-birdview'
import { EquipmentStatusBoard, type BoardGroup } from '../../../shared/features/equipment-status-board'
import { ASSEMBLY_FACTORIES } from '../api/assemblyFactoryFixture'
import { equipmentSummaryOf, mockScanTime } from '../lib/mapEntry'
import {
  edgePcCell,
  lidarPairCell,
  meaningOfLink,
  panelCell,
  tiltCell,
} from '../lib/equipmentCells'

/*
 * 조립 '현황' 탭 — 공용 설비 현황 보드(`equipment-status-board`)의 조립 소비자.
 *
 * 의장의 `OutfittingStatusTab` 과 같은 자리에 같은 문법으로 선다. 이 파일이 하는 일은
 * **번역과 변환**뿐이다: 조립 설비를 보드가 아는 어휘(공장 줄·베이 외곽·설비 점·셀)로
 * 옮긴다. 화면의 모양·링킹·정렬은 공용 층이 정한다.
 *
 * ⚠️ 대수·좌표·소속은 실데이터(도면 유도), **상태는 mock** 이다.
 */

const LINK_TEXT = { online: '온라인', offline: '오프라인', error: '통신 오류' } as const

/**
 * 그리드에 칸을 얻는 종류 — 짝 있는 틸팅은 라이다 칸에 접힌다(레퍼런스 §3.4).
 *
 * `focusId`(알람 딥링크가 실어 온 당사자)만은 **예외로 편다** — 접힘 때문에 "여기 문제가
 * 있다"고 부른 설비가 도착 화면에 없는 일이 없도록. 접힘 자체를 끄지는 않는다: 알람 하나
 * 때문에 화면 전체가 평소와 다른 모양이 되면 왜 다른지 설명할 수 없다.
 */
function gridEquipmentOf(factory: string, focusId: string | null): YardEquipment[] {
  const inFactory = YARD_EQUIPMENT.filter((e) => e.factory === factory)
  const lidarIds = new Set(inFactory.filter((e) => e.typeId === 'LIDAR').map((e) => e.id))
  return foldExceptFocus(
    inFactory,
    (e) => {
      if (e.typeId !== 'TILT') return false
      const mate = pairIdOf(e)
      return Boolean(mate && lidarIds.has(mate))
    },
    (e) => e.id,
    focusId
  )
}

export function AssemblyStatusTab({
  selectedFactory,
  onSelectFactory,
}: {
  /** 지금 보고 있는 공장 이름 — 탭 사이에서 공유되는 선택 */
  selectedFactory: string
  onSelectFactory: (factory: string) => void
}) {
  const { t } = useTranslation()
  const typeLabelOf = useEquipmentTypeLabel()
  /* 알람에서 넘어온 당사자 — 접힘 예외이자 하이라이트 대상 (equipmentFocus.ts) */
  const [searchParams] = useSearchParams()
  const focusEquipmentId = equipmentFocusOf(searchParams)
  const { snapshot } = useFactoryEquipmentStatus(selectedFactory)
  /* 셀 안의 경과는 셀이 직접 흘린다 — 여기 시계는 문구 계산에만 쓴다 */
  const now = useClock(30_000)

  const { data: parcels } = useAsyncData(() => loadYardParcels(), [])

  const factories = useMemo(
    () =>
      ASSEMBLY_FACTORIES.map((spec) => {
        const summary = equipmentSummaryOf(spec.name)
        return { name: spec.name, total: summary.total, issues: summary.issues }
      }),
    []
  )

  const groups = useMemo((): BoardGroup[] => {
    const byBay = new Map<string, YardEquipment[]>()
    for (const equipment of gridEquipmentOf(selectedFactory, focusEquipmentId)) {
      const key = equipment.bay || '-'
      const list = byBay.get(key)
      if (list) list.push(equipment)
      else byBay.set(key, [equipment])
    }

    return [...byBay.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([bay, list]) => ({
        key: bay,
        title:
          bay === '-'
            ? t('assembly.status.unassignedBay')
            : t('assembly.mapEntry.bayHeading', { bay }),
        cells: list
          .slice()
          .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
          .map((equipment) => {
            if (equipment.typeId === 'EDGE') {
              const status = edgePcStatusIn(snapshot, equipment.id)
              return status
                ? edgePcCell(equipment, status, { freshText: elapsedText(status.lastHeartbeatAt, now.getTime()) })
                : null
            }
            if (equipment.typeId === 'PNL') {
              const status = panelStatusIn(snapshot, equipment.id)
              return status
                ? panelCell({
                    id: equipment.id,
                    typeId: equipment.typeId,
                    powered: status.powered,
                    uplink: status.uplink,
                    memberOnline: status.memberOnline,
                    memberTotal: status.memberTotal,
                    lidarPairs: status.lidarPairs,
                  })
                : null
            }
            if (equipment.typeId === 'TILT') {
              return tiltCell(equipment, tiltStatusIn(snapshot, equipment.id), {
                freshText: mockScanTime(equipment.id),
                group: bay,
              })
            }
            /* 라이다의 신선도는 아직 벽시계 문자열(`13:02`)이다 — 에폭이 아니므로
               경과를 흘리게 하지 않는다(가짜 에폭을 실으면 침묵 판정이 거짓말을 한다) */
            return lidarPairCell(equipment, snapshot, {
              freshText: mockScanTime(equipment.id),
              group: bay,
            })
          })
          .filter((cell): cell is NonNullable<typeof cell> => cell !== null),
      }))
      .filter((group) => group.cells.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFactory, focusEquipmentId, snapshot, now, t])

  const bays = useMemo(
    () => (parcels ? birdviewBaysOf(parcels.bays, selectedFactory) : []),
    [parcels, selectedFactory]
  )

  const points = useMemo(
    () =>
      birdviewPointsOf(selectedFactory, {
        severityOf: (equipment: YardEquipment): StatusMeaning =>
          meaningOfLink(linkIn(snapshot, equipment.id) ?? 'offline'),
        tooltipOf: (equipment: YardEquipment) => ({
          title: `${equipment.id} · ${typeLabelOf(equipment.typeId)}`,
          status: LINK_TEXT[linkIn(snapshot, equipment.id) ?? 'offline'],
          freshness: equipment.bay
            ? t('assembly.mapEntry.bayHeading', { bay: equipment.bay })
            : t('assembly.status.unassignedBay'),
        }),
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
      /* 알람에서 넘어온 당사자를 골라 둔 채로 세운다 (equipmentFocus.ts) */
      focusEquipmentId={focusEquipmentId}
      headerExtra={
        <Link
          to="/indoorshop/zones/assembly"
          className="shrink-0 rounded-inshop-md border border-border px-2 py-0.5 text-2xs text-foreground/68 transition-colors hover:bg-surface-secondary hover:text-foreground"
        >
          {t('assembly.status.toMapEntry')}
        </Link>
      }
    />
  )
}

/** 경과 문구 — 신선도 한 마디 */
function elapsedText(at: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - at) / 60000))
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  return `${Math.floor(minutes / 60)}시간 전`
}
