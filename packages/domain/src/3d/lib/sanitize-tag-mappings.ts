import {
  normalizeCraneKey,
  normalizeLegacyCraneTagKey,
  parseCraneTagKey,
} from '@crane/core/lib/crane-tag-key';
import {
  getDrivenJointIds,
  RIG_AXES,
  type RigAxis,
  type RigDefinition,
} from '../model/rig-types';
import {
  STATUS_TAG_ROLES,
  type ModelStatusTags,
  type StatusTagRole,
} from '../model/status-tag-types';
import {
  getTagMappingTargetKey,
  normalizeTagCode,
  TAG_MAPPING_CAPTION_MAX,
  TAG_MAPPING_CHANNELS,
  type TagMapping,
  type TagMappingChannel,
  type TagMappingTarget,
} from '../model/tag-mapping-types';
import type { ValueMapType } from '../model/types';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 태그 맵핑 정규화 + 레거시(두 슬롯 키·단일 tagKey·valueMapList·rigBindings)
 * 변환. sanitize-scene-info 가 모델마다 부른다.
 *
 * 원칙은 리그와 같다 — 깨진 항목은 개별로 버리고 나머지는 살린다. 같은
 * 대상(노드·채널·축 또는 관절)을 가리키는 항목은 **첫 것만** 남긴다(first-
 * wins). 런타임이 last-write 로 뒤섞이면 순서에 따라 결과가 달라져 디버깅이
 * 불가능하므로, 데이터 경계에서 하나로 고정한다.
 *
 * 맵핑은 태그 **코드**만 든다. 레거시 키(`C_171.tl_distance`·`GC_04:gantry`)는
 * 코드와 크레인 접두어로 나뉘고, 접두어는 모델 단위 후처리
 * (`finalizeModelTagKeys`)가 모델 craneId 와 맞춘다 — 같으면 떼고, 모델에
 * craneId 가 없으면 접두어로 채우고, 다르면 맵핑에 `craneId` 로 남긴다.
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

/** 태그 참조의 중간형 — 크레인 접두어를 아직 모델과 맞추기 전. */
export interface TagCodeRef {
  code: string;
  /** 키에 있던 크레인(`C_171`). 코드만 있던 입력이면 없다. */
  craneKey?: string;
}

/**
 * 키 문자열(점 또는 옛 콜론 표기) → 참조. 첫 구분자 앞이 크레인, 뒤가 코드다
 * (코드에는 점이 남을 수 있다). 구분자가 없으면 통째로 코드다. 코드에 금지
 * 글자(공백·콜론)가 남으면 null.
 */
export function parseTagKeyRef(raw: unknown): TagCodeRef | null {
  const trimmed = trimKey(raw);
  if (!trimmed) return null;
  const dotted = normalizeLegacyCraneTagKey(trimmed);
  const parts = parseCraneTagKey(dotted);
  if (parts) {
    const code = normalizeTagCode(parts.tagCode);
    return code ? { code, craneKey: parts.craneKey } : null;
  }
  const code = normalizeTagCode(dotted);
  return code ? { code } : null;
}

/**
 * 맵핑·상태 태그 객체 하나의 태그 참조 — 새 포맷 `code`(+ 보존용 `craneId`) 가
 * 있으면 그것, 아니면 레거시 `realtimeTagKey` › `virtualTagKey` › `tagKey`
 * 순으로 첫 유효 키. 전부 비면 null.
 */
export function resolveTagRef(raw: Record<string, unknown>): TagCodeRef | null {
  const code = normalizeTagCode(raw.code);
  if (code) {
    const craneKey = trimKey(raw.craneId);
    return craneKey ? { code, craneKey } : { code };
  }
  for (const field of ['realtimeTagKey', 'virtualTagKey', 'tagKey'] as const) {
    const ref = parseTagKeyRef(raw[field]);
    if (ref) return ref;
  }
  return null;
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
 * 맵핑이 없는 씬은 JSON diff 가 없어야 한다. 레거시 키의 크레인 접두어는
 * `craneId` 로 실려 나온다 — 모델과 맞추는 것은 `finalizeModelTagKeys`.
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
    const ref = resolveTagRef(m);
    if (!ref) continue;
    const target = sanitizeTarget(m.target);
    if (!target) continue;
    if (target.kind === 'joint') {
      if (!rig || !rig.joints.some((j) => j.id === target.jointId)) continue;
      // driven 관절은 구속조건이 값을 정한다 — 태그를 꽂아도 매 프레임 덮인다.
      if (driven.has(target.jointId)) continue;
    }
    const targetKey = getTagMappingTargetKey(target);
    if (seenTargets.has(targetKey)) continue;

    const mapping: TagMapping = { id: m.id, target, code: ref.code };
    if (ref.craneKey) mapping.craneId = ref.craneKey;
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

function withRef(mapping: TagMapping, ref: TagCodeRef): TagMapping {
  if (ref.craneKey) mapping.craneId = ref.craneKey;
  return mapping;
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
 * 로드해도 히스토리·dirty 가 어긋나지 않는다.
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
    const ref = parseTagKeyRef(v.key);
    if (!ref) continue;
    const rest = placement[spec.channel][AXIS_INDEX[spec.axis]];
    const legacyOffset =
      spec.channel === 'position' && isFiniteNumber(v.offset) ? v.offset : 0;
    const mapping = withRef(
      {
        id: `legacy-${type.toLowerCase()}`,
        target: {
          kind: 'node',
          node: '',
          channel: spec.channel,
          axis: spec.axis,
        },
        code: ref.code,
      },
      ref,
    );
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
    const ref = parseTagKeyRef(b.key);
    if (!ref) continue;
    const mapping = withRef(
      {
        id: `legacy-joint-${b.jointId}`,
        target: { kind: 'joint', jointId: b.jointId },
        code: ref.code,
      },
      ref,
    );
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

/** 상태 태그 역할 → 참조(크레인 접두어 포함). sanitize-status-tags 가 만든다. */
export type StatusTagEntries = Partial<Record<StatusTagRole, TagCodeRef>>;

export interface FinalizedModelTagKeys {
  craneId?: string;
  tagMappings?: TagMapping[];
  statusTags?: ModelStatusTags;
}

/**
 * 모델 단위로 크레인 접두어를 정리한다.
 *
 * - 모델에 craneId 가 없고 맵핑·상태 태그의 접두어가 (정규화 기준) 하나뿐이면
 *   그것을 craneId 로 채운다 — 옛 저장본(philly)은 키에만 크레인이 있었다.
 * - 맵핑의 접두어가 모델 craneId 와 같으면 `craneId` 필드를 뗀다. 다르면
 *   남긴다(그 맵핑만 다른 크레인을 읽는다).
 * - 상태 태그는 역할 값이 코드 하나라 다른 크레인을 들 자리가 없다 — 접두어가
 *   모델과 다르면 버리고 경고한다.
 */
export function finalizeModelTagKeys(
  modelCraneId: string | undefined,
  mappings: TagMapping[] | undefined,
  statusEntries: StatusTagEntries | undefined,
): FinalizedModelTagKeys {
  let craneId = modelCraneId;
  if (!craneId) {
    const prefixes = new Map<string, string>();
    for (const mapping of mappings ?? []) {
      if (mapping.craneId) {
        prefixes.set(normalizeCraneKey(mapping.craneId), mapping.craneId);
      }
    }
    for (const role of STATUS_TAG_ROLES) {
      const entry = statusEntries?.[role];
      if (entry?.craneKey) {
        prefixes.set(normalizeCraneKey(entry.craneKey), entry.craneKey);
      }
    }
    if (prefixes.size === 1) {
      craneId = prefixes.values().next().value;
    }
  }
  const craneKey = craneId ? normalizeCraneKey(craneId) : undefined;

  const tagMappings = mappings?.map((mapping) => {
    if (
      mapping.craneId &&
      craneKey &&
      normalizeCraneKey(mapping.craneId) === craneKey
    ) {
      const { craneId: _same, ...rest } = mapping;
      void _same;
      return rest;
    }
    return mapping;
  });

  const statusTags: ModelStatusTags = {};
  for (const role of STATUS_TAG_ROLES) {
    const entry = statusEntries?.[role];
    if (!entry) continue;
    if (
      entry.craneKey &&
      (!craneKey || normalizeCraneKey(entry.craneKey) !== craneKey)
    ) {
      console.warn(
        `[sanitize-tag-mappings] status tag "${role}" references crane "${entry.craneKey}" but the model crane is "${craneId ?? '(none)'}". Dropped.`,
      );
      continue;
    }
    statusTags[role] = entry.code;
  }

  return {
    craneId,
    tagMappings:
      tagMappings && tagMappings.length > 0 ? tagMappings : undefined,
    statusTags: Object.keys(statusTags).length > 0 ? statusTags : undefined,
  };
}
