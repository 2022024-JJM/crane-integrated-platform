import type { RigAxis, RigDefinition, RigNodePath } from './rig-types';

/**
 * 태그 맵핑 — "서버(PLC) 태그 값 하나 → 모델 트랜스폼 채널 하나".
 *
 * 예전에는 두 벌이었다: 모델 루트 6칸 고정의 `valueMapList`(PX…RZ, 절대
 * 대입)와 리그 관절에 꽂는 `rigBindings`. 이제는 이 하나로 합친다. 대상은
 * 둘 중 하나다.
 *
 * - node: GLB 노드 경로(mesh-path 형식, `''` = 모델 루트) + 채널 + 축.
 *   값은 **rest pose 기준 Δ** 로 적용한다(리그 관절과 같은 규칙).
 *   루트의 rest 는 씬에 저장된 배치 transform 이다.
 * - joint: 모델에 할당된 리그의 관절. 관절 값 저장소에 쓰므로 한계 클램프·
 *   구속조건 체인을 그대로 탄다. driven 관절에는 꽂을 수 없다(sanitize).
 *
 * 적용 공식은 `applied = offset + value × scale`. 단위는 채널이 정한다 —
 * rotation deg, position m, scale 은 rest 에 더하는 무차원 Δ.
 *
 * 태그는 `tagKey` 문자열로만 참조한다. 가상 태그든 실제 서버 태그든 키
 * 공간(`${craneId}:${tagCode}`)이 같아 소스를 바꿔도 맵핑이 살아남는다.
 */
export type TagMappingChannel = 'position' | 'rotation' | 'scale';
export const TAG_MAPPING_CHANNELS = [
  'position',
  'rotation',
  'scale',
] as const satisfies readonly TagMappingChannel[];

export interface TagMappingNodeTarget {
  kind: 'node';
  node: RigNodePath;
  channel: TagMappingChannel;
  axis: RigAxis;
}

export interface TagMappingJointTarget {
  kind: 'joint';
  jointId: string;
}

export type TagMappingTarget = TagMappingNodeTarget | TagMappingJointTarget;

export interface TagMapping {
  /** 모델 안에서 고유. 값 저장소 주소(`${modelId}/${id}`)로도 쓰인다. */
  id: string;
  target: TagMappingTarget;
  /** 값 버스 키. 비어 있으면 sanitize 가 버린다. */
  tagKey: string;
  /** 단위 변환 계수. 생략 시 1. */
  scale?: number;
  /** 태그 값 0 에 대응하는 Δ. 생략 시 0. */
  offset?: number;
}

/**
 * 같은 대상을 두 맵핑이 가리키는지 판정하는 키. UI 의 중복 경고와 sanitize
 * 의 first-wins 가 같은 함수를 쓴다.
 */
export function getTagMappingTargetKey(target: TagMappingTarget): string {
  return target.kind === 'joint'
    ? `joint:${target.jointId}`
    : `node:${target.node}:${target.channel}:${target.axis}`;
}

export type TagMappingUnit = 'deg' | 'm' | '';

/** 맵핑이 적용되는 값의 단위 — 표시용. joint 대상은 관절 타입이 정한다. */
export function getTagMappingUnit(
  target: TagMappingTarget,
  rig?: RigDefinition,
): TagMappingUnit {
  if (target.kind === 'joint') {
    const joint = rig?.joints.find((j) => j.id === target.jointId);
    if (!joint) return '';
    return joint.type === 'hinge' ? 'deg' : 'm';
  }
  if (target.channel === 'rotation') return 'deg';
  if (target.channel === 'position') return 'm';
  return '';
}

/**
 * 리그 관절이 이미 점유한 node 대상 키 — 같은 노드·채널·축에 맵핑을 더 얹으면
 * 드라이버는 리그를 우선하므로 맵핑이 무시된다. UI 가 이 집합으로 경고한다.
 */
export function getRigOccupiedTargetKeys(
  rig: RigDefinition | undefined,
): Set<string> {
  const keys = new Set<string>();
  if (!rig) return keys;
  for (const joint of rig.joints) {
    keys.add(
      getTagMappingTargetKey({
        kind: 'node',
        node: joint.node,
        channel: joint.type === 'hinge' ? 'rotation' : 'position',
        axis: joint.axis,
      }),
    );
  }
  return keys;
}
