import {
  RIG_AXES,
  RIG_JOINT_TYPES,
  type RigAxis,
  type RigConstraint,
  type RigDefinition,
  type RigJoint,
  type RigJointType,
} from '../model/rig-types';

/**
 * 리그 정의·바인딩 정규화. sanitize-scene-info 가 로드·저장 경계에서 부른다.
 *
 * 원칙: 깨진 항목은 **개별로** 버리고 나머지는 살린다. 관절 하나가 잘못됐다고
 * 리그 전체나 모델을 떨어뜨리지 않는다(valueMapList 가 없으면 모델을 통째로
 * 버리는 기존 규칙과 대비되는데, 리그는 부가 정보라 그럴 이유가 없다).
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

function isRigJointType(value: unknown): value is RigJointType {
  return (RIG_JOINT_TYPES as readonly unknown[]).includes(value);
}

function sanitizeRigJoint(raw: unknown, seenIds: Set<string>): RigJoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const j = raw as Record<string, unknown>;
  if (!isNonEmptyString(j.id) || seenIds.has(j.id)) return null;
  // node 는 '' (root) 도 허용하지만 문자열이어야 한다.
  if (typeof j.node !== 'string') return null;
  if (!isRigJointType(j.type) || !isRigAxis(j.axis)) return null;

  const joint: RigJoint = {
    id: j.id,
    node: j.node,
    type: j.type,
    axis: j.axis,
  };
  if (typeof j.label === 'string' && j.label.trim().length > 0) {
    joint.label = j.label;
  }
  // 한계: 둘 다 유효하고 min > max 면 둘 다 버린다 — 한쪽만 남기면 슬라이더가
  // 뒤집힌 구간을 보여 주게 된다.
  const min = isFiniteNumber(j.min) ? j.min : undefined;
  const max = isFiniteNumber(j.max) ? j.max : undefined;
  if (min !== undefined && max !== undefined && min > max) {
    // drop both
  } else {
    if (min !== undefined) joint.min = min;
    if (max !== undefined) joint.max = max;
  }
  if (j.sign === -1) joint.sign = -1;
  seenIds.add(joint.id);
  return joint;
}

function sanitizeRigConstraint(
  raw: unknown,
  joints: RigJoint[],
  seenIds: Set<string>,
  drivenIds: Set<string>,
): RigConstraint | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (!isNonEmptyString(c.id) || seenIds.has(c.id)) return null;

  if (c.type === 'linear') {
    if (!isNonEmptyString(c.input) || !isNonEmptyString(c.output)) return null;
    if (c.input === c.output) return null;
    if (!joints.some((j) => j.id === c.input)) return null;
    if (!joints.some((j) => j.id === c.output)) return null;
    // 한 관절은 하나의 구속조건에서만 출력 — 둘이 같은 노드를 두고 매 프레임
    // 덮어쓰면 뒤의 것만 남아 앞의 것이 조용히 죽는다.
    if (drivenIds.has(c.output)) return null;
    if (!isFiniteNumber(c.factor)) return null;
    const constraint: RigConstraint = {
      type: 'linear',
      id: c.id,
      input: c.input,
      output: c.output,
      factor: c.factor,
    };
    if (typeof c.label === 'string' && c.label.trim().length > 0) {
      constraint.label = c.label;
    }
    if (isFiniteNumber(c.offset)) constraint.offset = c.offset;
    seenIds.add(constraint.id);
    drivenIds.add(constraint.output);
    return constraint;
  }

  // 모르는 타입은 버린다 — 구버전 클라이언트가 신버전 씬을 열었을 때
  // 정체불명 항목을 다시 저장해 되살리는 것보다 낫다.
  return null;
}

/**
 * 리그 하나. `assetId` 가 없으면 `fallbackAssetId`(그 리그를 쓰는 모델의 자산
 * id — collectAssetIdByRigId)로 채운다. 그래도 없으면 붙일 모델도 후보도
 * 없는 리그라 버린다. 옛 `modelPath` 는 읽지 않는다 — 라이브러리 전환으로
 * 모델 경로가 바뀐 뒤 아무도 고치지 않아 어긋나 있던 필드다.
 */
export function sanitizeRigDefinition(
  raw: unknown,
  fallbackAssetId?: string,
): RigDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isNonEmptyString(r.id)) return null;
  const assetId = isNonEmptyString(r.assetId) ? r.assetId : fallbackAssetId;
  if (!isNonEmptyString(assetId)) return null;

  const jointIds = new Set<string>();
  const joints = Array.isArray(r.joints)
    ? r.joints.flatMap((j) => {
        const s = sanitizeRigJoint(j, jointIds);
        return s ? [s] : [];
      })
    : [];

  const constraintIds = new Set<string>();
  const drivenIds = new Set<string>();
  const constraints = Array.isArray(r.constraints)
    ? r.constraints.flatMap((c) => {
        const s = sanitizeRigConstraint(c, joints, constraintIds, drivenIds);
        return s ? [s] : [];
      })
    : [];

  return {
    id: r.id,
    name: typeof r.name === 'string' ? r.name : '',
    assetId,
    joints,
    constraints,
  };
}

/**
 * 옛 리그(`assetId` 없음)에 채울 자산 id — 그 리그를 가리키는 모델(`rigId`)의
 * `asset.id`. 리그는 같은 자산의 모델에만 붙으므로 첫 모델로 충분하다. 모델
 * 원본은 아직 정규화 전이라 모양을 직접 본다.
 */
function collectAssetIdByRigId(rawModels: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!Array.isArray(rawModels)) return out;
  for (const model of rawModels) {
    if (!model || typeof model !== 'object') continue;
    const m = model as { rigId?: unknown; asset?: unknown };
    const asset =
      m.asset && typeof m.asset === 'object'
        ? (m.asset as { id?: unknown })
        : null;
    if (!isNonEmptyString(m.rigId) || !asset || !isNonEmptyString(asset.id)) {
      continue;
    }
    if (!out.has(m.rigId)) out.set(m.rigId, asset.id);
  }
  return out;
}

/**
 * 씬 상위 rigs[] 정규화. id 중복은 첫 항목만 남긴다. 비면 undefined.
 * `rawModels` 는 옛 리그의 자산 id 를 유도할 씬의 모델 원본(sanitize 전).
 */
export function sanitizeRigDefinitions(
  raw: unknown,
  rawModels?: unknown,
): RigDefinition[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const assetIdByRigId = collectAssetIdByRigId(rawModels);
  const seen = new Set<string>();
  const out: RigDefinition[] = [];
  for (const item of raw) {
    const rawId = (item as { id?: unknown } | null)?.id;
    const fallback = isNonEmptyString(rawId)
      ? assetIdByRigId.get(rawId)
      : undefined;
    const rig = sanitizeRigDefinition(item, fallback);
    if (!rig || seen.has(rig.id)) continue;
    seen.add(rig.id);
    out.push(rig);
  }
  return out.length > 0 ? out : undefined;
}

/**
 * 모델 인스턴스의 rigId 정규화 — rigs 에 없는 정의를 가리키면 버린다.
 * 관절 ← 태그 바인딩은 tagMappings(sanitize-tag-mappings) 가 맡는다.
 */
export function sanitizeModelRigId(
  rawRigId: unknown,
  rigs: RigDefinition[] | undefined,
): string | undefined {
  if (!isNonEmptyString(rawRigId)) return undefined;
  return rigs?.some((r) => r.id === rawRigId) ? rawRigId : undefined;
}
