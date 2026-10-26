import {
  normalizeVirtualEquipmentId,
  normalizeVirtualEquipmentKey,
  normalizeVirtualTagCode,
} from '@crane/domain/virtual-tag';

export type EquipmentIdError = 'invalid-id' | 'duplicate-id';
export type TagCodeError = 'invalid-code' | 'duplicate-code';

/**
 * 장비 ID 입력 커밋 전 판정 — 스토어(addEquipment·updateEquipment)가 거부하는
 * 이유를 UI 가 미리 알아 문구를 고른다. 규칙은 스토어와 같다: trim 후 빈
 * 값·길이 초과·공백·콜론은 invalid-id, 정규화 키(`GC-04` ≡ `GC_04`)가 다른
 * 장비와 같으면 duplicate-id. 자기 ID 그대로는 통과.
 */
export function getEquipmentIdError(
  value: string,
  currentCraneId: string | null,
  takenCraneIds: Iterable<string>,
): EquipmentIdError | null {
  const normalized = normalizeVirtualEquipmentId(value);
  if (normalized === null) return 'invalid-id';
  const key = normalizeVirtualEquipmentKey(normalized);
  if (
    currentCraneId !== null &&
    normalizeVirtualEquipmentKey(currentCraneId) === key
  ) {
    return null;
  }
  for (const taken of takenCraneIds) {
    if (normalizeVirtualEquipmentKey(taken) === key) return 'duplicate-id';
  }
  return null;
}

/**
 * 태그 코드 입력 커밋 전 판정 — 같은 장비 안 다른 태그의 코드와 겹치면
 * duplicate-code. 자기 코드 그대로는 통과.
 */
export function getTagCodeError(
  value: string,
  currentCode: string | null,
  takenCodes: Iterable<string>,
): TagCodeError | null {
  const normalized = normalizeVirtualTagCode(value);
  if (normalized === null) return 'invalid-code';
  if (normalized === currentCode) return null;
  for (const code of takenCodes) {
    if (code === normalized) return 'duplicate-code';
  }
  return null;
}
