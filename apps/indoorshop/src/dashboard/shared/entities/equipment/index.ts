/**
 * 야드 설비 — 단일 소스 진입점.
 *
 * 설비를 그리는 화면(지금은 도장 SCADA, 다음은 조립 LiDAR 배치)은 **이 파일만** import
 * 한다. 503대 정도는 가벼워 정적 import 로 두고 모듈 로드 때 한 번만 디코딩한다 —
 * yard-parcels 처럼 dynamic import 로 미루면 소비자(도장 repository)가 비동기가 되어
 * 화면 계층까지 파급되는데, 그 무게를 치를 크기가 아니다. 목록·맵이 같은 배열을
 * 참조하므로 필터 결과를 참조 비교로 가릴 수 있다.
 *
 * 실연동(설비 마스터를 API 로 받는) 시 이 파일의 데이터 소스만 교체하면 되고,
 * 소비자는 손대지 않는다.
 *
 * ⚠️ LiDAR(LD-*)·틸팅(PT-*) 204쌍·패널(PNL-*) 9대는 **Network Panel_260901_Rev.1 도면**
 * (조립 9공장 EQUIPMENT LAYOUT) 기준 — 도면 개정 시 painting `gen-assembly-lidar.py`
 * 재실행 → `equipment.js` 갱신 → `scripts/build-equipment-fixture.mjs` 재실행으로 다시 굽는다.
 * ⚠️ CAS·PAS 공장은 공정 분류 '가공' 그대로, 실적 권역만 조립 취급(사용자 확정) — 재분류 금지.
 */
import { RAW_EQUIPMENT, RAW_EQUIPMENT_TYPES } from './equipmentFixture'
import type { YardEquipment, YardEquipmentType } from './types'

export type { YardEquipment, YardEquipmentType } from './types'

/** 설비 종류 레지스트리 — 원본 equipment-types.js 순서 그대로 */
export const EQUIPMENT_TYPES: readonly YardEquipmentType[] = RAW_EQUIPMENT_TYPES.map(
  ([id, name, symbol, color, note]) => ({ id, name, symbol, color, note })
)

const typeById = new Map(EQUIPMENT_TYPES.map((t) => [t.id, t]))

/** 야드 설비 전체 (503대) — 원본 equipment.js 순서 그대로 */
export const YARD_EQUIPMENT: readonly YardEquipment[] = RAW_EQUIPMENT.map(
  ([id, typeId, factory, bay, lat, lon, x, y]) => ({ id, typeId, factory, bay, lat, lon, x, y })
)

/** 종류ID → 종류 (모르는 ID 는 null — 없는 종류를 지어내지 않는다) */
export function equipmentTypeOf(typeId: string): YardEquipmentType | null {
  return typeById.get(typeId) ?? null
}

/** 특정 종류들의 설비만 — 도장(DH/GH)·조립(LIDAR/TILT) 화면이 자기 몫을 거를 때 쓴다 */
export function equipmentOfTypes(typeIds: readonly string[]): YardEquipment[] {
  const wanted = new Set(typeIds)
  return YARD_EQUIPMENT.filter((e) => wanted.has(e.typeId))
}
