import {
  getRigOccupiedTargetKeys,
  getTagMappingTargetKey,
  type RigDefinition,
  type TagMapping,
  type TagMappingTarget,
} from '@crane/domain/3d';
import { createId } from '@crane/core/lib/create-id';

/**
 * 태그 맵핑 섹션의 순수 로직 — ui/*.tsx 안에서 계산하지 않는다는 규칙
 * (AGENTS.md) 대로 여기서 판정·생성하고 컴포넌트는 그리기만 한다.
 */

export type TagMappingConflict =
  /** 같은 대상을 앞선 맵핑이 이미 쓴다(sanitize 가 뒤의 것을 버린다). */
  | 'duplicate'
  /** 리그 관절이 같은 노드·채널·축을 구동한다(드라이버는 관절을 우선한다). */
  | 'rig';

/** 맵핑 id → 충돌 종류. 충돌 없는 항목은 키가 없다. */
export function findTagMappingConflicts(
  mappings: readonly TagMapping[],
  rig: RigDefinition | undefined,
): Map<string, TagMappingConflict> {
  const conflicts = new Map<string, TagMappingConflict>();
  const rigKeys = getRigOccupiedTargetKeys(rig);
  const seen = new Set<string>();
  for (const mapping of mappings) {
    const key = getTagMappingTargetKey(mapping.target);
    if (seen.has(key)) {
      conflicts.set(mapping.id, 'duplicate');
      continue;
    }
    seen.add(key);
    if (mapping.target.kind === 'node' && rigKeys.has(key)) {
      conflicts.set(mapping.id, 'rig');
    }
  }
  return conflicts;
}

/** 새 맵핑 기본값 — 모델 루트 · 위치 · x · 태그 미선택. 카드 안에서 고른다. */
export function createTagMapping(
  target: TagMappingTarget = {
    kind: 'node',
    node: '',
    channel: 'position',
    axis: 'x',
  },
): TagMapping {
  return { id: `map-${createId().slice(0, 8)}`, target, tagKey: '' };
}

/** 카드 readout: 태그값 → 적용값(offset + value × scale). */
export function computeAppliedValue(
  mapping: Pick<TagMapping, 'scale' | 'offset'>,
  tagValue: number | undefined,
): number | undefined {
  if (tagValue === undefined || !Number.isFinite(tagValue)) return undefined;
  return (mapping.offset ?? 0) + tagValue * (mapping.scale ?? 1);
}

/** 대상 변경 시 kind 가 바뀌면 나머지 필드를 기본값으로 채운다. */
export function switchTargetKind(
  target: TagMappingTarget,
  kind: TagMappingTarget['kind'],
  rig: RigDefinition | undefined,
): TagMappingTarget {
  if (target.kind === kind) return target;
  if (kind === 'joint') {
    return { kind: 'joint', jointId: rig?.joints[0]?.id ?? '' };
  }
  return { kind: 'node', node: '', channel: 'position', axis: 'x' };
}

/** 값 표시용 — 소수 3자리, 비유한수는 대시. */
export function formatMappingValue(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return Number(value.toFixed(3)).toString();
}
