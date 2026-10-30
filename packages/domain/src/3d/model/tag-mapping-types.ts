import { buildCraneTagKey } from '@crane/core/lib/crane-tag-key';
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
 * 태그는 **코드**(`tl_distance`)로만 참조한다. 크레인은 모델의 `craneId` 가
 * 들고, 값 버스 키 `크레인ID.코드` 는 런타임이 `resolveMappingTagKey` 로
 * 조립한다. 실시간·리플레이·시나리오 러너가 모두 같은 키로 값을 내보내므로
 * 맵핑은 소스를 모른다 — 어느 소스가 흐를지는 버스의 활성 소스 게이트가
 * 정한다(features `setActiveTagSource`).
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
  /** 태그 코드 — 키의 뒷부분. 공백·콜론 없음, 점은 된다(`normalizeTagCode`). */
  code: string;
  /**
   * 이 맵핑만 다른 크레인을 읽을 때의 크레인 ID. 편집 UI 가 쓰지 않는 보존용
   * 필드다 — 레거시 키의 크레인이 모델 craneId 와 달랐을 때 sanitize 가
   * 남긴다. 모델 craneId 와 같으면 sanitize 가 뗀다.
   */
  craneId?: string;
  /** 단위 변환 계수. 생략 시 1. */
  scale?: number;
  /** 태그 값 0 에 대응하는 Δ. 생략 시 0. */
  offset?: number;
  /**
   * 모델 라벨 위에 이 태그의 **원시값**(scale·offset 적용 전, PLC 값 그대로)을
   * 보인다. true 만 저장. 값 읽기·표기는 lib/label-reading.ts.
   */
  showOnLabel?: boolean;
  /**
   * 라벨 값 앞에 붙는 짧은 이름(예: `주행`). 비면 숫자만 보인다. 표시를 꺼도
   * 보존해 다시 켜면 되살아난다. 최대 TAG_MAPPING_CAPTION_MAX 자.
   */
  caption?: string;
}

/** 라벨 값 이름의 최대 길이 — 라벨이 모델을 가리지 않을 만큼만. */
export const TAG_MAPPING_CAPTION_MAX = 12;

/**
 * 코드에 올 수 없는 글자 — 옛 구분자(콜론)·공백. 점은 된다: 외업 태그는 원본
 * 이름(`4_Crane.4_CR01.4_POS.04_Center_POS_y1`)이 점으로 마디를 나눈다. 키
 * `크레인ID.코드` 는 첫 점에서 나누고 크레인 ID 에는 점이 없으므로 코드의 점과
 * 겹치지 않는다(`parseCraneTagKey`).
 */
const TAG_CODE_FORBIDDEN = /[\s:]/;

/** 태그 코드 정규화 — trim 뒤 비었거나 금지 글자가 있으면 null. */
export function normalizeTagCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim();
  if (code.length === 0 || TAG_CODE_FORBIDDEN.test(code)) return null;
  return code;
}

/** 맵핑·상태 태그가 키를 조립하는 데 필요한 모델 필드. */
export interface TagKeyModel {
  craneId?: string;
}

/**
 * 맵핑의 값 버스 키 `크레인ID.코드`. 맵핑에 `craneId` 가 있으면 그것, 아니면
 * 모델 craneId. 둘 다 없으면 undefined — 그 맵핑은 어느 소스에서도 값을 받지
 * 않는다(인덱스·라벨·상태 판정이 전부 이 함수를 쓴다).
 */
export function resolveMappingTagKey(
  model: TagKeyModel,
  mapping: Pick<TagMapping, 'code' | 'craneId'>,
): string | undefined {
  const craneId = mapping.craneId ?? model.craneId;
  if (!craneId || !mapping.code) return undefined;
  return buildCraneTagKey(craneId, mapping.code);
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
