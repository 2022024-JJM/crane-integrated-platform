import {
  getDrivenJointIds,
  RIG_AXES,
  type RigAxis,
  type RigDefinition,
} from '../model/rig-types';
import {
  getTagMappingTargetKey,
  TAG_MAPPING_CAPTION_MAX,
  TAG_MAPPING_CHANNELS,
  type TagKeySlots,
  type TagMapping,
  type TagMappingChannel,
  type TagMappingTarget,
} from '../model/tag-mapping-types';
import type { ValueMapType } from '../model/types';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 태그 맵핑 정규화 + 레거시(valueMapList·rigBindings) 변환.
 * sanitize-scene-info 가 모델마다 부른다.
 *
 * 원칙은 리그와 같다 — 깨진 항목은 개별로 버리고 나머지는 살린다. 같은
 * 대상(노드·채널·축 또는 관절)을 가리키는 항목은 **첫 것만** 남긴다(first-
 * wins). 런타임이 last-write 로 뒤섞이면 순서에 따라 결과가 달라져 디버깅이
 * 불가능하므로, 데이터 경계에서 하나로 고정한다.
 */

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isRigAxis(value: unknown): value is RigAxis {
  return (RIG_AXES as readonly unknown[]).includes(value);
}

function trimKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * 단일 키 시절의 실시간 키 `크레인:코드` 를 지금 표기 `크레인.코드` 로. 이미
 * 점이 있거나 콜론이 없으면 그대로. `@crane/domain/monitoring` 의
 * `normalizeLegacyCraneTagKey` 와 같은 규칙이다 — 같은 레이어 슬라이스 간
 * import 를 하지 않아 여기 한 번 더 적는다. 바꾸면 둘 다 고친다.
 */
function toDottedLegacyKey(key: string): string {
  if (key.includes('.')) return key;
  const colon = key.indexOf(':');
  if (colon <= 0 || colon >= key.length - 1) return key;
  return `${key.slice(0, colon)}.${key.slice(colon + 1)}`;
}

function legacyKey(value: unknown): string | undefined {
  const trimmed = trimKey(value);
  return trimmed === undefined ? undefined : toDottedLegacyKey(trimmed);
}

/**
 * 두 슬롯 키를 정규화한다. 레거시 `tagKey`(단일 키 시절)는 실시간 슬롯으로
 * 옮기며 콜론 표기를 점으로 바꾼다 — 그 시절 배포 씬(dock-in)의 키가 서버
 * 키였다. 가상 키였던 배포 씬(philly)은 데이터를 `virtualTagKey` 로 직접
 * 옮겼다. 둘 다 비면 null.
 *
 * 맵핑과 상태 태그 역할이 같은 함수를 쓴다.
 */
export function sanitizeTagKeySlots(raw: unknown): TagKeySlots | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const realtimeTagKey = trimKey(r.realtimeTagKey) ?? legacyKey(r.tagKey);
  const virtualTagKey = trimKey(r.virtualTagKey);
  if (!realtimeTagKey && !virtualTagKey) return null;
  const out: TagKeySlots = {};
  if (realtimeTagKey) out.realtimeTagKey = realtimeTagKey;
  if (virtualTagKey) out.virtualTagKey = virtualTagKey;
  return out;
}

function isChannel(value: unknown): value is TagMappingChannel {
  return (TAG_MAPPING_CHANNELS as readonly unknown[]).includes(value);
}

function sanitizeTarget(raw: unknown): TagMappingTarget | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (t.kind === 'joint') {
    return isNonEmptyString(t.jointId)
      ? { kind: 'joint', jointId: t.jointId }
      : null;
  }
  if (t.kind === 'node') {
    // node 는 '' (모델 루트) 도 유효하다 — 문자열이기만 하면 된다.
    if (typeof t.node !== 'string') return null;
    if (!isChannel(t.channel) || !isRigAxis(t.axis)) return null;
    return { kind: 'node', node: t.node, channel: t.channel, axis: t.axis };
  }
  return null;
}

interface SanitizeTagMappingsContext {
  /** 모델에 실제로 할당된 리그(rigId 가 유효할 때만). joint 대상 검증용. */
  rig?: RigDefinition;
}

/**
 * 배열을 정규화한다. 반환이 undefined 면 필드 자체를 생략하라는 뜻 —
 * 맵핑이 없는 씬은 JSON diff 가 없어야 한다.
 */
export function sanitizeTagMappings(
  raw: unknown,
  { rig }: SanitizeTagMappingsContext = {},
): TagMapping[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const driven = rig ? getDrivenJointIds(rig) : new Set<string>();
  const seenIds = new Set<string>();
  const seenTargets = new Set<string>();
  const out: TagMapping[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    if (!isNonEmptyString(m.id) || seenIds.has(m.id)) continue;
    const slots = sanitizeTagKeySlots(m);
    if (!slots) continue;
    const target = sanitizeTarget(m.target);
    if (!target) continue;
    if (target.kind === 'joint') {
      if (!rig || !rig.joints.some((j) => j.id === target.jointId)) continue;
      // driven 관절은 구속조건이 값을 정한다 — 태그를 꽂아도 매 프레임 덮인다.
      if (driven.has(target.jointId)) continue;
    }
    const targetKey = getTagMappingTargetKey(target);
    if (seenTargets.has(targetKey)) continue;

    const mapping: TagMapping = { id: m.id, target, ...slots };
    if (isFiniteNumber(m.scale)) mapping.scale = m.scale;
    if (isFiniteNumber(m.offset)) mapping.offset = m.offset;
    // 라벨 표시는 true 만, 이름은 trim 해서 비지 않을 때만 싣는다.
    if (m.showOnLabel === true) mapping.showOnLabel = true;
    if (typeof m.caption === 'string') {
      const caption = m.caption.trim().slice(0, TAG_MAPPING_CAPTION_MAX);
      if (caption.length > 0) mapping.caption = caption;
    }
    seenIds.add(mapping.id);
    seenTargets.add(targetKey);
    out.push(mapping);
  }

  return out.length > 0 ? out : undefined;
}

const LEGACY_VALUE_MAP_TARGET: Record<
  ValueMapType,
  { channel: TagMappingChannel; axis: RigAxis }
> = {
  PX: { channel: 'position', axis: 'x' },
  PY: { channel: 'position', axis: 'y' },
  PZ: { channel: 'position', axis: 'z' },
  RX: { channel: 'rotation', axis: 'x' },
  RY: { channel: 'rotation', axis: 'y' },
  RZ: { channel: 'rotation', axis: 'z' },
  SX: { channel: 'scale', axis: 'x' },
  SY: { channel: 'scale', axis: 'y' },
  SZ: { channel: 'scale', axis: 'z' },
};

const AXIS_INDEX: Record<RigAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

interface LegacyPlacement {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
}

/**
 * 레거시 `valueMapList` → 루트 node 맵핑.
 *
 * 옛 의미는 절대 대입이었다: `world = offset + value × scale` (회전·크기는
 * offset 없이 `value × scale` 그대로). 새 의미는 배치 transform 기준 Δ 다.
 * 그래서 `offset' = offset − placement[axis]` 로 옮기면 같은 태그 값이 같은
 * 좌표를 만든다. 회전은 배치 회전이 단일 축일 때만 정확히 같다 — 복합
 * 오일러 회전은 축별 Δ 로 분해되지 않는다. 현재 저장본에는 회전 맵핑이
 * 없어 실데이터 영향은 없다.
 *
 * id 는 결정론적(`legacy-pz`)이다 — 변환이 멱등해야 같은 파일을 두 번
 * 로드해도 히스토리·dirty 가 어긋나지 않는다. 키는 실시간 슬롯 — 이 형식을
 * 쓴 씬(dock-in)의 키가 서버 키다.
 */
export function convertLegacyValueMapList(
  raw: unknown,
  placement: LegacyPlacement,
): TagMapping[] {
  if (!Array.isArray(raw)) return [];
  const out: TagMapping[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const v = item as Record<string, unknown>;
    const type = v.type as ValueMapType;
    const spec = LEGACY_VALUE_MAP_TARGET[type];
    if (!spec) continue;
    if (typeof v.key !== 'string' || v.key.trim().length === 0) continue;
    const rest = placement[spec.channel][AXIS_INDEX[spec.axis]];
    const legacyOffset =
      spec.channel === 'position' && isFiniteNumber(v.offset) ? v.offset : 0;
    const mapping: TagMapping = {
      id: `legacy-${type.toLowerCase()}`,
      target: {
        kind: 'node',
        node: '',
        channel: spec.channel,
        axis: spec.axis,
      },
      realtimeTagKey: toDottedLegacyKey(v.key.trim()),
    };
    if (isFiniteNumber(v.scale)) mapping.scale = v.scale;
    const offset = legacyOffset - rest;
    if (offset !== 0) mapping.offset = offset;
    out.push(mapping);
  }
  return out;
}

/** 레거시 `rigBindings` → joint 맵핑. 검증은 sanitizeTagMappings 가 한다. */
export function convertLegacyRigBindings(raw: unknown): TagMapping[] {
  if (!Array.isArray(raw)) return [];
  const out: TagMapping[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const b = item as Record<string, unknown>;
    if (!isNonEmptyString(b.jointId)) continue;
    if (typeof b.key !== 'string' || b.key.trim().length === 0) continue;
    const mapping: TagMapping = {
      id: `legacy-joint-${b.jointId}`,
      target: { kind: 'joint', jointId: b.jointId },
      realtimeTagKey: toDottedLegacyKey(b.key.trim()),
    };
    if (isFiniteNumber(b.scale)) mapping.scale = b.scale;
    if (isFiniteNumber(b.offset)) mapping.offset = b.offset;
    out.push(mapping);
  }
  return out;
}

interface RawModelForMappings {
  tagMappings?: unknown;
  valueMapList?: unknown;
  rigBindings?: unknown;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
}

/**
 * 모델 하나의 맵핑을 최종 결정한다. `tagMappings` 가 배열이면 그것이 정본이고
 * 레거시 필드는 무시한다(저장 시 레거시는 이미 지워진다). 배열이 아니면
 * 레거시 두 필드를 변환해 합친 뒤 같은 규칙으로 정규화한다.
 */
export function resolveModelTagMappings(
  model: RawModelForMappings,
  rig: RigDefinition | undefined,
): TagMapping[] | undefined {
  if (Array.isArray(model.tagMappings)) {
    return sanitizeTagMappings(model.tagMappings, { rig });
  }
  const legacy = [
    ...convertLegacyValueMapList(model.valueMapList, model),
    ...convertLegacyRigBindings(model.rigBindings),
  ];
  return legacy.length > 0 ? sanitizeTagMappings(legacy, { rig }) : undefined;
}
