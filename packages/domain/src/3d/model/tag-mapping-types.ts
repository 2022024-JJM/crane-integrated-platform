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
 * 태그는 키 문자열로만 참조하고, 슬롯이 둘이다 — 실시간(서버) 키는 모니터링
 * 실시간·3D 플레이 리플레이가, 가상 키는 시뮬레이션이 읽는다. 어느 슬롯을
 * 읽을지는 features 의 `resolveActiveTagSlot` 한 곳이 정한다. 둘 다 비면
 * sanitize 가 맵핑을 버린다.
 */

/** 맵핑이 드는 두 태그 슬롯. */
export type TagSlot = 'realtime' | 'virtual';
export const TAG_SLOTS = [
  'realtime',
  'virtual',
] as const satisfies readonly TagSlot[];

/** 슬롯별 태그 키 — 맵핑과 상태 태그 역할이 같은 모양을 쓴다. */
export interface TagKeySlots {
  /** 실시간(서버) 태그 키 `${craneId}.${tagCode}`. */
  realtimeTagKey?: string;
  /** 가상 태그 키 — 시뮬레이션. */
  virtualTagKey?: string;
}
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

export interface TagMapping extends TagKeySlots {
  /** 모델 안에서 고유. 값 저장소 주소(`${modelId}/${id}`)로도 쓰인다. */
  id: string;
  target: TagMappingTarget;
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

/** 슬롯의 키. 비어 있으면 undefined. */
export function getSlotTagKey(
  slots: TagKeySlots | undefined,
  slot: TagSlot,
): string | undefined {
  const key =
    slot === 'realtime' ? slots?.realtimeTagKey : slots?.virtualTagKey;
  return key ? key : undefined;
}

/** 두 슬롯 중 하나라도 키가 있는가. */
export function hasAnyTagKey(slots: TagKeySlots | undefined): boolean {
  return Boolean(slots?.realtimeTagKey || slots?.virtualTagKey);
}

/**
 * 표시용 대표 키 — 실시간 우선, 없으면 가상. 어느 소스가 활성인지와 무관한
 * 곳(관절 배지·대시보드 목록)에서만 쓴다. 런타임 바인딩은 `getSlotTagKey`.
 */
export function getPrimaryTagKey(
  slots: TagKeySlots | undefined,
): string | undefined {
  return getSlotTagKey(slots, 'realtime') ?? getSlotTagKey(slots, 'virtual');
}

/** 슬롯 필드명 — 편집 UI 가 패치를 만들 때 쓴다. */
export function getSlotField(slot: TagSlot): keyof TagKeySlots {
  return slot === 'realtime' ? 'realtimeTagKey' : 'virtualTagKey';
}

/**
 * 한 슬롯의 키를 바꾼 새 객체. 빈 키(공백 포함)는 그 슬롯 필드를 뗀다. 바뀌는
 * 것이 없으면 **같은 참조**를 돌려준다 — 편집 채널이 참조로 no-op 을 가려
 * 히스토리·dirty 에 남기지 않는다.
 */
export function setSlotTagKey(
  slots: TagKeySlots,
  slot: TagSlot,
  key: string,
): TagKeySlots {
  const next = key.trim();
  const field = getSlotField(slot);
  if ((slots[field] ?? '') === next) return slots;
  const rest: TagKeySlots = { ...slots };
  delete rest[field];
  return next.length > 0 ? { ...rest, [field]: next } : rest;
}

/** 두 슬롯 키가 같은가 — 없음과 빈 문자열은 같다(sanitize 가 둘 다 필드를 생략). */
export function isTagKeySlotsEqual(
  a: TagKeySlots | undefined,
  b: TagKeySlots | undefined,
): boolean {
  return (
    (a?.realtimeTagKey ?? '') === (b?.realtimeTagKey ?? '') &&
    (a?.virtualTagKey ?? '') === (b?.virtualTagKey ?? '')
  );
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
