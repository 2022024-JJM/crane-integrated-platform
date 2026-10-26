import type { VirtualEquipment, VirtualTagDefinition } from '../model/types';
import { buildVirtualTagKey } from './virtual-tag-key';

/**
 * 장비 계층을 평탄하게 — 러너·카탈로그·칩이 "키 하나 = 태그 하나" 로 본다.
 * 키는 조립값이라 저장본에 없고 여기서만 만든다.
 */
export interface VirtualTagEntry {
  key: string;
  equipment: VirtualEquipment;
  tag: VirtualTagDefinition;
}

/**
 * 모든 장비의 모든 태그. `enabledOnly` 면 장비·태그 둘 다 켜진 것만 — 러너가
 * 내보낼 목록이다. 순서는 장비 순 › 태그 순.
 */
export function collectVirtualTagEntries(
  equipments: readonly VirtualEquipment[],
  { enabledOnly = false }: { enabledOnly?: boolean } = {},
): VirtualTagEntry[] {
  const out: VirtualTagEntry[] = [];
  for (const equipment of equipments) {
    if (enabledOnly && !equipment.enabled) continue;
    for (const tag of equipment.tags) {
      if (enabledOnly && !tag.enabled) continue;
      out.push({
        key: buildVirtualTagKey(equipment.craneId, tag.code),
        equipment,
        tag,
      });
    }
  }
  return out;
}

/** 키로 항목 하나를 찾는다. 없으면 undefined. */
export function findVirtualTagEntry(
  equipments: readonly VirtualEquipment[],
  key: string,
): VirtualTagEntry | undefined {
  for (const equipment of equipments) {
    for (const tag of equipment.tags) {
      if (buildVirtualTagKey(equipment.craneId, tag.code) === key) {
        return { key, equipment, tag };
      }
    }
  }
  return undefined;
}
