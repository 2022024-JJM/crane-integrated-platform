import type {
  VirtualEquipment,
  VirtualTagDataType,
  VirtualTagDefinition,
} from '@crane/domain/virtual-tag';

/**
 * 가상 태그 화면(목록·상세)의 순수 로직 — ui/*.tsx 안에서 계산하지 않는다는
 * 규칙(AGENTS.md) 대로 여기서 거르고 적는다.
 */

export interface VirtualBayOption {
  bay: string;
  count: number;
}

/** 구역 칩 — 구역이 있는 장비만, 이름순. */
export function collectVirtualBays(
  equipments: readonly VirtualEquipment[],
): VirtualBayOption[] {
  const counts = new Map<string, number>();
  for (const equipment of equipments) {
    if (!equipment.bay) continue;
    counts.set(equipment.bay, (counts.get(equipment.bay) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([bay, count]) => ({ bay, count }))
    .sort((a, b) => a.bay.localeCompare(b.bay, 'en', { numeric: true }));
}

/**
 * 장비 목록 — 구역 칩('all' 이면 전부)과 검색어(장비 ID·구역 부분 일치,
 * 대소문자·앞뒤 공백 무시). 순서는 저장 순 그대로.
 */
export function filterVirtualEquipments(
  equipments: readonly VirtualEquipment[],
  bay: string | 'all',
  query: string,
): VirtualEquipment[] {
  const needle = query.trim().toLowerCase();
  return equipments.filter((equipment) => {
    if (bay !== 'all' && equipment.bay !== bay) return false;
    if (!needle) return true;
    return (
      equipment.craneId.toLowerCase().includes(needle) ||
      (equipment.bay ?? '').toLowerCase().includes(needle)
    );
  });
}

/** 코드·이름 부분 일치(대소문자·앞뒤 공백 무시). 빈 검색어는 전부(새 배열). */
export function filterVirtualTags(
  tags: readonly VirtualTagDefinition[],
  query: string,
): VirtualTagDefinition[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...tags];
  return tags.filter(
    (tag) =>
      tag.code.toLowerCase().includes(needle) ||
      tag.name.toLowerCase().includes(needle),
  );
}

/** 현재값 표기 — 소수 셋째 자리까지, 꼬리 0 제거. 없으면 대시. */
export function formatVirtualValue(
  value: number | undefined,
  dataType: VirtualTagDataType = 'number',
): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (dataType === 'bool') return value >= 0.5 ? '1' : '0';
  return Number(value.toFixed(3)).toString();
}

/** 값의 범위 안 위치(0~100). 범위가 없거나 값이 없으면 0. */
export function valuePercent(
  value: number | undefined,
  min: number,
  max: number,
): number {
  const range = max - min;
  if (value === undefined || !Number.isFinite(value) || range <= 0) return 0;
  return Math.min(100, Math.max(0, ((value - min) / range) * 100));
}

/** 수동 슬라이더의 step — 범위를 200 칸으로. 범위가 없으면 1. */
export function sliderStep(min: number, max: number): number {
  const range = max - min;
  return range > 0 ? range / 200 : 1;
}

/** 불리언 값이 켜진 것으로 보이는가(0.5 문턱). */
export function isBoolOn(value: number | undefined): boolean {
  return value !== undefined && value >= 0.5;
}

/** 다음 새 태그 코드 — `base`, `base_2` … 중 비어 있는 첫 것. */
export function nextTagCode(
  base: string,
  takenCodes: Iterable<string>,
): string {
  const taken = new Set(takenCodes);
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}
