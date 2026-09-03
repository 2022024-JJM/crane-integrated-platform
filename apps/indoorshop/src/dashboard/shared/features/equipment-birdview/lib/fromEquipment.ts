import { YARD_EQUIPMENT, pairIdOf, type YardEquipment } from '../../../entities/equipment'
import type { YardParcelBay } from '../../../entities/yard-parcels'
import type { StatusMeaning } from '../../../ui/statusPalette'
import type { BirdviewBay, BirdviewPoint } from '../model/types'

/*
 * 설비 엔티티 → 버드뷰 입력. 세 공정이 같은 규칙을 쓰도록 여기 한 번만 적는다.
 *
 * ⚠️ **라이다-틸팅 페어는 한 점**이다. 그리드의 셀이 한 칸인 것과 같은 이유이고(1.7m 안에
 * 한 자리), 두 점으로 찍으면 그림에서 겹쳐 얼룩이 되며 링킹의 id 도 갈린다.
 * ⚠️ 판넬은 **캐비닛 자신의 자리**에 찍는다 — 담당 베이가 아니라 그 판이 실제로 선 곳이다.
 */

/** 이 공장의 베이 외곽 — 지번 fixture 의 헐을 그대로 쓴다 */
export function birdviewBaysOf(
  bays: readonly YardParcelBay[],
  factory: string
): BirdviewBay[] {
  return bays
    .filter((bay) => bay.factory === factory && bay.hull.length >= 3)
    .map((bay) => ({
      id: bay.id,
      label: bay.bay,
      /* 그리드 구획 키는 베이명 — 두 층이 같은 열쇠를 써야 점프가 성립한다 */
      groupKey: bay.bay,
      hull: bay.hull,
    }))
}

export interface BirdviewPointInput {
  /** 종류별 상태 — 공정이 자기 판정으로 답한다 */
  severityOf: (equipment: YardEquipment) => StatusMeaning
  /** 툴팁 세 줄 — 화면이 번역해 넣는다 */
  tooltipOf: (equipment: YardEquipment) => { title: string; status: string; freshness: string }
  /** 이 종류만 찍는다. 생략하면 그 공장의 설비 전부 */
  typeIds?: readonly string[]
}

/**
 * 이 공장의 설비 점.
 *
 * 틸팅(`TILT`)은 **빼고** 라이다에 접는다 — 라이다가 없는 고아 틸팅만 제 점으로 선다
 * (도면이 그런 경우를 만들지 않지만, 데이터가 갈렸을 때 조용히 사라지면 안 된다).
 */
export function birdviewPointsOf(
  factory: string,
  options: BirdviewPointInput
): BirdviewPoint[] {
  const wanted = options.typeIds ? new Set(options.typeIds) : null
  const inFactory = YARD_EQUIPMENT.filter((e) => e.factory === factory)
  const lidarIds = new Set(inFactory.filter((e) => e.typeId === 'LIDAR').map((e) => e.id))

  return inFactory
    .filter((equipment) => {
      if (wanted && !wanted.has(equipment.typeId)) return false
      if (equipment.typeId !== 'TILT') return true
      /* 짝이 있는 틸팅은 라이다 점에 접힌다 */
      const mate = pairIdOf(equipment)
      return !(mate && lidarIds.has(mate))
    })
    .map(
      (equipment): BirdviewPoint => ({
        id: equipment.id,
        typeId: equipment.typeId,
        position: { lat: equipment.lat, lon: equipment.lon },
        severity: options.severityOf(equipment),
        tooltip: options.tooltipOf(equipment),
        bay: equipment.bay || undefined,
      })
    )
}
