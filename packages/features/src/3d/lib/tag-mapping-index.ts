import {
  getDrivenJointIds,
  type RigDefinition,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import {
  makeJointAddress,
  type TagBindingTarget,
} from '../model/rig-value-store';

export type TagMappingIndex = ReadonlyMap<string, readonly TagBindingTarget[]>;

const EMPTY: readonly TagBindingTarget[] = [];

/**
 * 씬의 tagMappings 를 "태그 키 → 값 저장소 주소 목록" 으로 뒤집는다.
 * createTagBindingSource 의 resolve 가 매 값마다 이걸 조회한다.
 *
 * - joint 대상: 주소 = `${modelId}/${jointId}` — 드라이버가 관절 값으로 읽어
 *   한계·구속조건 체인을 그대로 탄다. driven 관절·없는 관절은 sanitize 가
 *   이미 버렸지만, 세션 중 편집(리그 해제 등)으로 어긋날 수 있어 한 번 더
 *   거른다.
 * - node 대상: 주소 = `${modelId}/${mapping.id}` — 드라이버가 맵핑 채널로 읽는다.
 */
export function buildTagMappingIndex(
  sceneInfo: SavedSceneInfo | null | undefined,
): TagMappingIndex {
  const index = new Map<string, TagBindingTarget[]>();
  if (!sceneInfo) return index;

  const rigsById = new Map<string, RigDefinition>(
    (sceneInfo.rigs ?? []).map((r) => [r.id, r]),
  );

  for (const model of sceneInfo.models ?? []) {
    const mappings = model.tagMappings;
    if (!mappings || mappings.length === 0) continue;
    const rig = model.rigId ? rigsById.get(model.rigId) : undefined;
    const driven = rig ? getDrivenJointIds(rig) : null;

    for (const mapping of mappings) {
      let slot: string;
      if (mapping.target.kind === 'joint') {
        const jointId = mapping.target.jointId;
        if (!rig || !rig.joints.some((j) => j.id === jointId)) continue;
        if (driven?.has(jointId)) continue;
        slot = jointId;
      } else {
        slot = mapping.id;
      }
      const target: TagBindingTarget = {
        address: makeJointAddress(model.id, slot),
        scale: mapping.scale ?? 1,
        offset: mapping.offset ?? 0,
      };
      const list = index.get(mapping.tagKey);
      if (list) list.push(target);
      else index.set(mapping.tagKey, [target]);
    }
  }
  return index;
}

export function resolveFromIndex(
  index: TagMappingIndex,
  key: string,
): readonly TagBindingTarget[] {
  return index.get(key) ?? EMPTY;
}

/** 씬이 참조하는 태그 키 전부(중복 제거, 등장 순). 라이브 패널·삭제 경고용. */
export function collectSceneTagKeys(
  sceneInfo: SavedSceneInfo | null | undefined,
): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const model of sceneInfo?.models ?? []) {
    for (const mapping of model.tagMappings ?? []) {
      if (seen.has(mapping.tagKey)) continue;
      seen.add(mapping.tagKey);
      keys.push(mapping.tagKey);
    }
  }
  return keys;
}
