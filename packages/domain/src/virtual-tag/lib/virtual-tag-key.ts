import { VIRTUAL_EQUIPMENT_ID_MAX, VIRTUAL_TAG_CODE_MAX } from '../model/types';

/**
 * 가상 태그의 값 버스 키 `${장비키}:${코드}`.
 *
 * 구분자는 콜론이다 — 실시간 키는 점(`C_171.tl_distance`, monitoring 의
 * `buildCraneTagKey`)이라 글자가 같아질 수 없다. 장비키는 장비 ID 의 하이픈을
 * 밑줄로 바꾼 것(`GC-04` → `GC_04`)으로 실시간 쪽 `normalizeCraneKey` 와 같은
 * 규칙이다. 같은 레이어의 다른 슬라이스라 import 하지 않고 규칙을 여기 한 번 더
 * 둔다 — 바꾸면 둘 다 고친다.
 */
export const VIRTUAL_TAG_KEY_SEPARATOR = ':';

/** 식별자 안에 올 수 없는 글자 — 구분자와 공백. */
const FORBIDDEN = /[\s:]/;

/** 장비 ID 정규화 — trim 후 비었거나 길이 초과·공백·콜론이 있으면 null. */
export function normalizeVirtualEquipmentId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  if (id.length === 0 || id.length > VIRTUAL_EQUIPMENT_ID_MAX) return null;
  if (FORBIDDEN.test(id)) return null;
  return id;
}

/** 태그 코드 정규화 — 장비 ID 와 같은 규칙, 길이 상한만 다르다. */
export function normalizeVirtualTagCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim();
  if (code.length === 0 || code.length > VIRTUAL_TAG_CODE_MAX) return null;
  if (FORBIDDEN.test(code)) return null;
  return code;
}

/** 키 앞부분의 장비 표기. 장비 유일성 판정도 이 값으로 한다. */
export function normalizeVirtualEquipmentKey(craneId: string): string {
  return craneId.trim().replace(/-/g, '_');
}

export function buildVirtualTagKey(craneId: string, code: string): string {
  return `${normalizeVirtualEquipmentKey(craneId)}${VIRTUAL_TAG_KEY_SEPARATOR}${code}`;
}

export interface VirtualTagKeyParts {
  equipmentKey: string;
  code: string;
}

/**
 * 키를 장비키·코드로 나눈다. 첫 콜론 기준이며 어느 쪽이든 비면 null —
 * 실시간 키처럼 다른 표기일 수 있어 호출자가 null 을 처리한다.
 */
export function parseVirtualTagKey(key: string): VirtualTagKeyParts | null {
  const sep = key.indexOf(VIRTUAL_TAG_KEY_SEPARATOR);
  if (sep <= 0 || sep >= key.length - 1) return null;
  return { equipmentKey: key.slice(0, sep), code: key.slice(sep + 1) };
}
