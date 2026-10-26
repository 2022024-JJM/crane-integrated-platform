import {
  findPresetGroup,
  normalizeVirtualTagCode,
  toGroupPreset,
  type VirtualTagDefinition,
  type VirtualTagGroup,
  type VirtualTagGroupPreset,
} from '@crane/domain/virtual-tag';
import type { CraneSnapshotEntry } from './crane-snapshot-stats';
import { buildTagRows, type TagRow } from './tag-rows';

/**
 * 실시간 크레인 스냅샷 → 가상 태그 정의(1회 스냅샷 복제). 장비 등록
 * 다이얼로그와 실시간 상세의 "가상 장비로 복제" 가 같은 변환을 쓴다.
 *
 * - 코드·표시명·단위는 태그 카탈로그 메타(`buildTagRows`) 그대로.
 * - 불리언 값은 bool 형식(0~1, 수동), 숫자는 number 형식.
 * - 초깃값은 현재값, 범위는 접속 후 관측 범위. 관측이 한 점이면 값 기준 기본
 *   폭(`fallbackRange`) — 사용자가 바로 고칠 기본값이지 측정 한계가 아니다.
 * - 패턴은 수동 — 복제 직후 값이 머물러 있어야 실시간과 비교가 된다.
 * - 그룹은 카탈로그 묶음을 기본 그룹 표식으로 옮긴다. 장비에 그 표식의 그룹이
 *   없으면 새로 만들어 함께 돌려준다(이름은 호출자가 번역해 넘긴다).
 *
 * 순수 함수 — id 는 `nextId` 로 받아 테스트가 결정론이다.
 */
export interface CloneTagsOptions {
  /** 복제할 코드. 생략하면 전부. */
  codes?: ReadonlySet<string>;
  /** 대상 장비가 이미 가진 그룹 — 표식으로 찾는다. */
  existingGroups: readonly VirtualTagGroup[];
  /** 없는 표식 그룹을 만들 때의 이름. */
  groupNames: Record<VirtualTagGroupPreset, string>;
  nextId: () => string;
}

export interface CloneTagsResult {
  /** 장비에 새로 붙여야 하는 그룹(이미 있던 것은 없음). */
  groups: VirtualTagGroup[];
  tags: VirtualTagDefinition[];
}

/** 관측이 없거나 한 점일 때의 범위 — 값이 들어가고 폭이 0 이 아니게. */
export function fallbackRange(value: number): { min: number; max: number } {
  const span = Math.max(Math.abs(value) * 2, 100);
  return value >= 0 ? { min: 0, max: span } : { min: -span, max: 0 };
}

/** 관측 범위를 쓰되 현재값이 밖이면 넓히고, 폭이 없으면 기본 폭. */
export function cloneRange(
  value: number,
  observed: { min: number | null; max: number | null },
): { min: number; max: number } {
  if (
    observed.min !== null &&
    observed.max !== null &&
    Number.isFinite(observed.min) &&
    Number.isFinite(observed.max) &&
    observed.max > observed.min
  ) {
    return {
      min: Math.min(observed.min, value),
      max: Math.max(observed.max, value),
    };
  }
  return fallbackRange(value);
}

function cloneTag(
  row: TagRow,
  groupId: string | undefined,
  nextId: () => string,
): VirtualTagDefinition | null {
  const code = normalizeVirtualTagCode(row.code);
  if (code === null) return null;
  const base = {
    id: nextId(),
    code,
    name: row.name,
    enabled: true,
    pattern: { kind: 'manual' } as const,
    ...(groupId ? { groupId } : {}),
  };
  if (typeof row.value === 'boolean') {
    return {
      ...base,
      dataType: 'bool',
      min: 0,
      max: 1,
      initial: row.value ? 1 : 0,
    };
  }
  const value = Number.isFinite(row.value) ? row.value : 0;
  const range = cloneRange(value, row.stat);
  return {
    ...base,
    dataType: 'number',
    ...(row.unit ? { unit: row.unit } : {}),
    min: range.min,
    max: range.max,
    initial: value,
  };
}

export function cloneTagsFromSnapshot(
  entry: Pick<CraneSnapshotEntry, 'snapshot' | 'stats'>,
  options: CloneTagsOptions,
): CloneTagsResult {
  const newGroups: VirtualTagGroup[] = [];
  const groupFor = (preset: VirtualTagGroupPreset): string => {
    const existing =
      findPresetGroup(options.existingGroups, preset) ??
      findPresetGroup(newGroups, preset);
    if (existing) return existing.id;
    const group: VirtualTagGroup = {
      id: options.nextId(),
      name: options.groupNames[preset],
      preset,
    };
    newGroups.push(group);
    return group.id;
  };

  const tags: VirtualTagDefinition[] = [];
  for (const row of buildTagRows(entry)) {
    if (options.codes && !options.codes.has(row.code)) continue;
    const tag = cloneTag(
      row,
      groupFor(toGroupPreset(row.category)),
      options.nextId,
    );
    if (tag) tags.push(tag);
  }
  return { groups: newGroups, tags };
}
