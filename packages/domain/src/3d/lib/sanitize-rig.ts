import {
  getDrivenJointIds,
  RIG_AXES,
  RIG_JOINT_TYPES,
  type RigAxis,
  type RigBinding,
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

export function sanitizeRigDefinition(raw: unknown): RigDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isNonEmptyString(r.id) || !isNonEmptyString(r.modelPath)) return null;

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
    modelPath: r.modelPath,
    joints,
    constraints,
  };
}

/** 씬 상위 rigs[] 정규화. id 중복은 첫 항목만 남긴다. 비면 undefined. */
export function sanitizeRigDefinitions(
  raw: unknown,
): RigDefinition[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: RigDefinition[] = [];
  for (const item of raw) {
    const rig = sanitizeRigDefinition(item);
    if (!rig || seen.has(rig.id)) continue;
    seen.add(rig.id);
    out.push(rig);
  }
  return out.length > 0 ? out : undefined;
}

/**
 * 모델 인스턴스의 rigId·rigBindings 정규화. rigId 가 rigs 에 없으면 둘 다
 * 버린다(바인딩만 남으면 가리킬 관절이 없다). 바인딩은 jointId 기준으로
 * 첫 항목만 남기고, 리그에 없는 관절·driven 관절·빈 키는 버린다.
 */
export function sanitizeModelRig(
  rawRigId: unknown,
  rawBindings: unknown,
  rigs: RigDefinition[] | undefined,
): { rigId?: string; rigBindings?: RigBinding[] } {
  if (!isNonEmptyString(rawRigId)) return {};
  const rig = rigs?.find((r) => r.id === rawRigId);
  if (!rig) return {};

  const result: { rigId?: string; rigBindings?: RigBinding[] } = {
    rigId: rig.id,
  };
  if (!Array.isArray(rawBindings)) return result;

  const driven = getDrivenJointIds(rig);
  const seen = new Set<string>();
  const bindings: RigBinding[] = [];
  for (const item of rawBindings) {
    if (!item || typeof item !== 'object') continue;
    const b = item as Record<string, unknown>;
    if (!isNonEmptyString(b.jointId) || seen.has(b.jointId)) continue;
    if (!rig.joints.some((j) => j.id === b.jointId)) continue;
    // driven 관절은 구속조건이 값을 정한다 — 태그를 꽂아도 매 프레임 덮인다.
    if (driven.has(b.jointId)) continue;
    if (typeof b.key !== 'string' || b.key.trim().length === 0) continue;
    const binding: RigBinding = { jointId: b.jointId, key: b.key.trim() };
    if (isFiniteNumber(b.scale)) binding.scale = b.scale;
    if (isFiniteNumber(b.offset)) binding.offset = b.offset;
    seen.add(binding.jointId);
    bindings.push(binding);
  }
  if (bindings.length > 0) result.rigBindings = bindings;
  return result;
}
