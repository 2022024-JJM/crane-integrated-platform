import { WORKSPACE_TAB_PARAM } from './workspaceTabUrl'

/*
 * 설비 딥링크 — **알람 당사자를 화면에 세운다** (링크 스모크 ⑥).
 *
 * 알람은 설비 한 대를 가리키는데, 링크는 그 공장·베이까지만 데려다 놓았다. 도착한 화면은
 * 자기 규칙대로 목록을 접는다 — 조립 현황 그리드는 **짝 있는 틸팅을 라이다 칸에 접는다**.
 * 그래서 틸팅 알람(PT-N11)을 눌러 도착하면 당사자가 화면에 아예 없다. "여기 문제가 있다"고
 * 부른 뒤 그 자리에 데려다 놓고 아무것도 안 보여 주는 셈이다.
 *
 * 고치는 자리는 링크와 화면 둘 다다:
 *  - 링크는 **누구 때문에 왔는지**(`?equip=`) 함께 싣는다.
 *  - 화면은 그 대상이 제 접는 규칙에 걸리면 **그 한 대만 펴서** 세우고 짚어 준다.
 *
 * 접힘을 통째로 끄지 않는 것이 요점이다 — 알람 하나 때문에 화면 전체가 평소와 다른
 * 모양이 되면, 방금 본 화면과 지금 화면이 왜 다른지 설명할 수 없다.
 */

/** 딥링크가 실어 오는 설비 id 키 */
export const EQUIPMENT_FOCUS_PARAM = 'equip'

/** URL 이 가리키는 설비 — 없으면 null */
export function equipmentFocusOf(search: URLSearchParams | string): string | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const raw = params.get(EQUIPMENT_FOCUS_PARAM)?.trim()
  return raw ? raw : null
}

/** 이 경로에 설비 초점을 실어 준다 — 이미 쿼리가 붙어 있으면 이어 붙인다 */
export function withEquipmentFocus(path: string, equipmentId: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}${EQUIPMENT_FOCUS_PARAM}=${encodeURIComponent(equipmentId)}`
}

/**
 * 접는 규칙에 **예외**를 낸다 — 초점 대상은 접지 않는다.
 *
 * `fold` 는 화면의 원래 판정("이 설비를 접을 것인가")이다. 초점이 그 설비를 가리키면
 * 그 한 대만 예외로 편다. 초점이 없거나 다른 설비면 화면 규칙 그대로다.
 */
export function foldExceptFocus<T>(
  items: readonly T[],
  fold: (item: T) => boolean,
  idOf: (item: T) => string,
  focusId: string | null
): T[] {
  return items.filter((item) => !fold(item) || idOf(item) === focusId)
}

/** 착지 탭까지 함께 실어 보낼 때 — 두 키를 손으로 이어 붙이지 않게 */
export function withEquipmentLanding(path: string, equipmentId: string, tab?: string): string {
  const withEquip = withEquipmentFocus(path, equipmentId)
  return tab ? `${withEquip}&${WORKSPACE_TAB_PARAM}=${tab}` : withEquip
}
