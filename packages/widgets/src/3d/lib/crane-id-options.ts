import { normalizeCraneKey } from '@crane/core/lib/crane-tag-key';
import type { CraneRegistryEntry } from '@crane/domain/crane';
import { compareCraneIds } from '@crane/domain/monitoring';
import type { ComboboxOption } from '@crane/ui/molecules/combobox';

/**
 * 인스펙터 크레인 콤보박스의 선택지 — 크레인 레지스트리 전부. 왼쪽은 크레인
 * 번호(`C-171`), 설명은 지역. 정규화 키(`-`→`_`)가 같은 항목은 첫 것만 남기고
 * 번호 순(`compareCraneIds`)으로 정렬한다. 레지스트리 밖 ID 는 선택지에 없다
 * — 자유 입력은 없다.
 */
export function buildCraneIdOptions(
  registry: readonly CraneRegistryEntry[],
): ComboboxOption[] {
  const seen = new Set<string>();
  const entries: CraneRegistryEntry[] = [];
  for (const entry of registry) {
    const key = normalizeCraneKey(entry.craneId);
    if (!entry.craneId || seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }
  entries.sort((a, b) => compareCraneIds(a.craneId, b.craneId));
  return entries.map((entry) => ({
    value: entry.craneId,
    label: entry.craneNo || entry.craneId,
    description: entry.regionId,
  }));
}

/** 현재값이 선택지에 있는가 — 정규화 키로 비교한다. */
export function isRegisteredCraneId(
  options: readonly ComboboxOption[],
  craneId: string | undefined,
): boolean {
  if (!craneId) return false;
  const key = normalizeCraneKey(craneId);
  return options.some((o) => normalizeCraneKey(o.value) === key);
}
