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
  equipmentPanelOf,
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
import { equipmentSummaryOf, mockLastSignalAt } from '../lib/mapEntry'
import {
  edgePcCell,
  lidarPairCell,
  meaningOfLink,
  panelCell,
  tiltCell,
} from '../lib/equipmentCells'
import { LampVitals, LidarVitals } from './cellVitals'
import { EdgeDetail, PanelDetail, TiltDetail } from './cellDetails'

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

/*
 * 한 베이 안에서의 **종류 순서** — 관측(라이다·틸팅) 먼저, 그 뒤 수집·네트워크.
 *
 * 예전에는 설비ID 순이라 `ED-P2` 가 `LD-P17` 과 `LD-P07` 사이에 끼어 섰다. 종류가
 * 바뀌면 셀이 말하는 값의 문법도 통째로 바뀌는데(각도 / 온도·CPU / 소속 대수), 그것이
 * 한 줄 안에서 번갈아 나오면 눈이 훑는 리듬을 못 만든다. 종류로 묶어 두면 같은 문법이
 * 이어지고, 이상 정렬(그리드가 하는 안정 정렬)은 이 순서를 그대로 물려받는다.
 *
 * 의장 화면·설비 인벤토리 패널의 구획 순서와 같다 — 화면을 옮겨 다녀도 눈이 다시
 * 적응하지 않아도 된다.
 */
const TYPE_ORDER = ['LIDAR', 'TILT', 'EDGE', 'PNL'] as const

function typeRank(typeId: string): number {
  const index = (TYPE_ORDER as readonly string[]).indexOf(typeId)
  return index === -1 ? TYPE_ORDER.length : index
}

export function AssemblyStatusTab({
  selectedFactory,
  onSelectFactory,
  focusBay = null,
  className,
}: {
  /** 지금 보고 있는 공장 이름 — 탭 사이에서 공유되는 선택 */
  selectedFactory: string
  onSelectFactory: (factory: string) => void
  /**
   * 정반을 골라 들어와 있을 때 그 베이 키(`5`) — 보드가 그 구획을 고른 채로 선다.
   *
   * 이 탭은 정반을 골라 들어와 있어도 **공장 전체**를 보여 준다(여기서 묻는 것은 "이
   * 공장에 무엇이 몇 대 있고 어디가 이상인가" 이므로). 그렇다고 방금까지 보던 자리를
   * 잃을 이유는 없다 — 공장을 펴 놓되 그 베이는 골라 둔다.
   */
  focusBay?: string | null
  /** 바깥이 정하는 자리 — 뷰포트에 맞춘 화면에서 남는 높이를 받는다 */
  className?: string
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
          .sort(
            (a, b) =>
              typeRank(a.typeId) - typeRank(b.typeId) ||
              a.id.localeCompare(b.id, undefined, { numeric: true })
          )
          .map((equipment) => {
            /*
             * 셀을 고르면 **상세가 펴진다**. 예전에는 이 화면의 셀만 상세가 비어 있어,
             * 눌러도 테두리만 생기고 아무 말이 없었다 — 같은 설비를 지도 진입 패널에서
             * 열면 나오던 값들이다(`ui/cellDetails`). 두 화면이 같은 것을 말해야 한다.
             */
            if (equipment.typeId === 'EDGE') {
              const status = edgePcStatusIn(snapshot, equipment.id)
              return status
                ? edgePcCell(equipment, status, {
                    freshText: elapsedText(status.lastHeartbeatAt, now.getTime()),
                    figureOf: (lamps) => <LampVitals lamps={lamps} />,
                    detail: (edge) => <EdgeDetail status={edge} />,
                  })
                : null
            }
            if (equipment.typeId === 'PNL') {
              const status = panelStatusIn(snapshot, equipment.id)
              const panel = equipmentPanelOf(equipment.id)
              return status
                ? panelCell({
                    id: equipment.id,
                    typeId: equipment.typeId,
                    powered: status.powered,
                    uplink: status.uplink,
                    memberOnline: status.memberOnline,
                    memberTotal: status.memberTotal,
                    lidarPairs: status.lidarPairs,
                    figureOf: (lamps) => <LampVitals lamps={lamps} />,
                    detail: panel ? <PanelDetail entry={{ panel, status }} /> : undefined,
                  })
                : null
            }
            /*
             * 라이다·틸팅의 신선도는 **에폭**이다(`mockLastSignalAt`). 예전에는 벽시계
             * 문자열(`13:02`)이라 그리드의 흐름·침묵 판정이 켜지지 않았고, 보는 사람이
             * 칸마다 지금 시각과의 뺄셈을 해야 했다.
             */
            const link = linkIn(snapshot, equipment.id) ?? 'offline'
            const at = mockLastSignalAt(equipment.id, link, now.getTime())
            const freshText = elapsedText(at, now.getTime())

            if (equipment.typeId === 'TILT') {
              const tilt = tiltStatusIn(snapshot, equipment.id)
              return tiltCell(equipment, tilt, {
                freshText,
                group: bay,
                figureOf: (status, tiltLink) => <LidarVitals link={tiltLink} tilt={status} />,
                detail: <TiltDetail tilt={tilt} />,
              })
            }
            return lidarPairCell(equipment, snapshot, {
              freshText,
              at,
              group: bay,
              figureOf: (tilt, lidarLink) => <LidarVitals link={lidarLink} tilt={tilt} />,
              detail: (tilt) => <TiltDetail tilt={tilt} />,
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
      /* 한 베이에 라이다·Edge PC·캐비닛이 섞여 서므로 램프에 이름을 붙인다 —
         종류마다 램프 셋의 뜻이 달라 익명 점으로는 순서를 아는 사람만 읽는다 */
      namedLamps
      /* 라이다·틸팅·Edge PC·캐비닛이 한 배치도에 섞여 선다 — 종류색과 범례가 없으면
         12px 판 안의 8px 글리프 하나로 넷을 갈라야 한다(갈리지 않는다) */
      colorByType
      /* 배치를 키운 대가를 목록이 치르지 않게 — 넓은 화면에서는 둘을 나란히 세운다 */
      sideBySide
      /* 알람에서 넘어온 당사자를 골라 둔 채로 세운다 (equipmentFocus.ts) */
      focusEquipmentId={focusEquipmentId}
      /* 정반에서 건너왔으면 그 베이를 골라 둔 채로 (베이 → 현황 승계) */
      focusGroupKey={focusBay}
      className={className}
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
