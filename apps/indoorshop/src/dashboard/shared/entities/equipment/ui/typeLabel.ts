import { equipmentTypeOf } from '../index'

/*
 * 설비 종류의 **화면 이름** — 레지스트리 이름과 화면 라벨을 잇는 한 겹 (W7-6D).
 *
 * 레지스트리(`equipmentFixture`)의 `name` 은 **도면의 이름**이다: `Network Panel`,
 * `Edge PC`, `Switch Hub`. 그 이름은 도면 대조의 근거라 바꿀 수 없고(생성물이기도 하다),
 * 동시에 **화면에 그대로 내보내면 안 된다** — 현장에서 그 판을 부르는 말은 '판넬'이고,
 * 화면 다른 곳(구획 제목·알람)이 이미 그렇게 부르고 있었다. 그래서 같은 설비가 지도
 * 범례에서는 `Network Panel`, 목록 제목에서는 `캐비닛`, 상세에서는 `판넬` 이 되어 있었다.
 *
 * 이 파일이 그 어긋남을 한 자리로 모은다 — 화면은 레지스트리 `name` 을 직접 읽지 않고
 * 여기서 받은 **번역 키**를 쓴다. 규칙 둘:
 *  · 종류에 화면 이름이 정해져 있으면 그 키를 낸다.
 *  · 정해지지 않은 종류는 레지스트리 이름을 그대로 쓴다(없는 이름을 지어내지 않는다).
 *
 * ⚠️ 여기서 `t()` 를 부르지 않는다 — 키만 낸다. 엔티티는 번역기를 모른다(레포 관례).
 */

/** 화면 이름이 따로 정해진 종류 — 그 밖의 종류는 레지스트리 이름 그대로 */
const LABEL_KEY: Readonly<Record<string, string>> = {
  /* 도면 이름 `Network Panel` → 현장 호칭 '판넬'. 코드의 파생 개념어 '캐비닛'(PNL+Edge PC)은
     화면에 내지 않는다 — 사용자가 없는 설비 종류를 찾게 된다. */
  PNL: 'equipment.type.PNL',
  EDGE: 'equipment.type.EDGE',
  HUB: 'equipment.type.HUB',
  PLC: 'equipment.type.PLC',
  CONV: 'equipment.type.CONV',
  VCAM: 'equipment.type.VCAM',
  RFID: 'equipment.type.RFID',
}

/** 이 종류에 화면 이름이 따로 있는가 */
export function hasEquipmentTypeLabel(typeId: string): boolean {
  return typeId in LABEL_KEY
}

/**
 * 종류ID → 화면에 쓸 번역 키. 화면 이름이 없는 종류는 `null` 이고, 호출부는
 * `equipmentTypeFallback` 로 물러선다.
 */
export function equipmentTypeLabelKey(typeId: string): string | null {
  return LABEL_KEY[typeId] ?? null
}

/** 번역 키가 없을 때 쓸 이름 — 레지스트리 이름, 그것도 없으면 종류ID */
export function equipmentTypeFallback(typeId: string): string {
  return equipmentTypeOf(typeId)?.name ?? typeId
}
