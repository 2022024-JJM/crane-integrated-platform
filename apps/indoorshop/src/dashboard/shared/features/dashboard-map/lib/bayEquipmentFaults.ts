import {
  equipmentLinkOf,
  equipmentTypeOf,
  YARD_EQUIPMENT,
  type YardEquipment,
} from '../../../entities/equipment'
import type { YardParcelBay } from '../../../entities/yard-parcels'
import { processRank } from './factoryNav'

/*
 * 베이별 **설비 장애** — 공장 상세가 "손봐야 하는 칸"을 표시하고, 야드 맵 오른쪽 목록이
 * 장애 베이를 모아 보이는 근거.
 *
 * 원천은 설비 마스터(`YARD_EQUIPMENT`)와 그 링크 상태(`equipmentLinkOf`) 하나다 — 설비
 * 현황 화면·공정 화면의 설비 패널이 전부 같은 자리에 묻는다. 여기서 공정별 센서 API 를
 * 따로 부르면 화면마다 아픈 설비가 달라진다(라이다만 세면 조립의 틸팅·Edge PC 장애는
 * 지도에서 사라진다).
 *
 * 설비의 `factory`·`bay` 가 곧 지도 베이 id(`{공장}#{베이}`)다 — 같은 원본에서 나왔다.
 */

/** 장애 설비 한 대 — 목록 한 줄의 근거 */
export interface FaultEquipment {
  id: string
  typeId: string
  /** 사람이 읽는 종류 이름 (설비 마스터의 것 그대로 — 라이다·틸팅모듈·Edge PC…) */
  typeName: string
  link: 'offline' | 'error'
}

/** 장애 베이 한 칸 — 야드 맵 오른쪽 목록의 한 줄 */
export interface FaultBay {
  bayId: string
  factory: string
  label: string
  process: string
  lotCodes: readonly string[]
  equipment: FaultEquipment[]
}

/** 장애로 치는 링크 — 끊김·오류. 정상(online)만 빠진다 */
function faultLinkOf(equipment: YardEquipment): FaultEquipment['link'] | null {
  const link = equipmentLinkOf(equipment)
  return link === 'online' ? null : link
}

/** 베이 id → 그 베이의 장애 설비들 */
function faultEquipmentByBay(equipment: readonly YardEquipment[]): Map<string, FaultEquipment[]> {
  const byBay = new Map<string, FaultEquipment[]>()
  for (const item of equipment) {
    if (!item.bay || item.bay === '-') continue
    const link = faultLinkOf(item)
    if (!link) continue
    const bayId = `${item.factory}#${item.bay}`
    const list = byBay.get(bayId) ?? []
    list.push({
      id: item.id,
      typeId: item.typeId,
      typeName: equipmentTypeOf(item.typeId)?.name ?? item.typeId,
      link,
    })
    byBay.set(bayId, list)
  }
  return byBay
}

/** 베이 id → 장애 설비 수. 장애가 없는 베이는 키가 없다 */
export function equipmentFaultsByBay(
  equipment: readonly YardEquipment[] = YARD_EQUIPMENT
): Map<string, number> {
  return new Map(
    [...faultEquipmentByBay(equipment)].map(([bayId, list]) => [bayId, list.length])
  )
}

/**
 * 야드 전체의 장애 베이 — 지도에 있는 베이만(지도에 없는 칸은 눌러 갈 곳이 없다).
 * 순서는 **공정 순**(가공 → 조립 → 의장 → 도장 — 왼쪽 공장 목록과 같다, 사용자 확정), 같은
 * 공정 안에서는 오류가 있는 베이 먼저, 그다음 장애 수가 많은 순, 같으면 공장·베이 이름 순 —
 * 다시 그려도 줄이 흔들리지 않게.
 */
export function faultBaysOf(
  bays: readonly YardParcelBay[],
  equipment: readonly YardEquipment[] = YARD_EQUIPMENT
): FaultBay[] {
  const byBay = faultEquipmentByBay(equipment)
  const errorsOf = (bay: FaultBay) => bay.equipment.filter((e) => e.link === 'error').length
  return bays
    .flatMap((bay): FaultBay[] => {
      const list = byBay.get(bay.id)
      if (!list) return []
      return [
        {
          bayId: bay.id,
          factory: bay.factory,
          label: bay.label,
          process: bay.process,
          lotCodes: bay.lotCodes,
          equipment: list,
        },
      ]
    })
    .sort(
      (a, b) =>
        processRank(a.process) - processRank(b.process) ||
        Number(errorsOf(b) > 0) - Number(errorsOf(a) > 0) ||
        b.equipment.length - a.equipment.length ||
        a.factory.localeCompare(b.factory) ||
        a.label.localeCompare(b.label)
    )
}
