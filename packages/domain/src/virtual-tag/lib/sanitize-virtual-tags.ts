import {
  VIRTUAL_EQUIPMENT_BAY_MAX,
  VIRTUAL_EQUIPMENT_GROUPS_MAX,
  VIRTUAL_EQUIPMENT_ID_MAX,
  VIRTUAL_EQUIPMENT_NAME_MAX,
  VIRTUAL_EQUIPMENT_TAGS_MAX,
  VIRTUAL_EQUIPMENTS_MAX,
  VIRTUAL_TAG_BOOL_PATTERN_KINDS,
  VIRTUAL_TAG_CODE_MAX,
  VIRTUAL_TAG_GROUP_NAME_MAX,
  VIRTUAL_TAG_GROUP_PRESETS,
  VIRTUAL_TAG_NAME_MAX,
  VIRTUAL_TAG_PATTERN_KINDS,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  VIRTUAL_TAG_PERIOD_MAX,
  VIRTUAL_TAG_PERIOD_MIN,
  VIRTUAL_TAG_TICK_DEFAULT,
  VIRTUAL_TAG_TICK_MAX,
  VIRTUAL_TAG_TICK_MIN,
  VIRTUAL_TAG_UNIT_MAX,
  type VirtualEquipment,
  type VirtualTagDefinition,
  type VirtualTagGroup,
  type VirtualTagGroupPreset,
  type VirtualTagLimits,
  type VirtualTagPattern,
  type VirtualTagPatternKind,
  type VirtualTagSet,
} from '../model/types';
import {
  normalizeVirtualEquipmentId,
  normalizeVirtualEquipmentKey,
  normalizeVirtualTagCode,
  VIRTUAL_TAG_KEY_SEPARATOR,
} from './virtual-tag-key';

/**
 * 저장소(배포 파일·localStorage·가져온 JSON)에서 읽은 가상 태그 세트의 방어.
 * 손상 항목은 개별로 버리고, 숫자는 범위로 클램프한다. 중복은 첫 항목만 남긴다.
 *
 * 버전 1(평탄한 태그 목록, 키 문자열 `장비:코드`)은 로드 때 장비 계층으로
 * 변환한다(`migrateVirtualTagSetV1`) — 키를 첫 콜론에서 나눠 왼쪽이 장비,
 * 오른쪽이 코드다. 조립한 키가 원래 문자열과 같아 씬의 가상 슬롯 참조가 그대로
 * 풀린다. 버전 1 의 시나리오는 버린다.
 */

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isPatternKind(value: unknown): value is VirtualTagPatternKind {
  return (VIRTUAL_TAG_PATTERN_KINDS as readonly unknown[]).includes(value);
}

function isBoolPatternKind(kind: VirtualTagPatternKind): boolean {
  return (VIRTUAL_TAG_BOOL_PATTERN_KINDS as readonly string[]).includes(kind);
}

function isGroupPreset(value: unknown): value is VirtualTagGroupPreset {
  return (VIRTUAL_TAG_GROUP_PRESETS as readonly unknown[]).includes(value);
}

/** 선택 문자열 — trim 뒤 비면 undefined, 길면 자른다. */
function optionalText(raw: unknown, max: number): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim();
  return text.length > 0 ? text.slice(0, max) : undefined;
}

export function clampVirtualTagTick(value: unknown): number {
  if (!isFiniteNumber(value)) return VIRTUAL_TAG_TICK_DEFAULT;
  return Math.round(clamp(value, VIRTUAL_TAG_TICK_MIN, VIRTUAL_TAG_TICK_MAX));
}

export function clampVirtualTagPeriod(value: unknown): number {
  if (!isFiniteNumber(value)) return VIRTUAL_TAG_PERIOD_DEFAULT;
  return Math.round(
    clamp(value, VIRTUAL_TAG_PERIOD_MIN, VIRTUAL_TAG_PERIOD_MAX),
  );
}

export function sanitizeVirtualTagPattern(raw: unknown): VirtualTagPattern {
  if (!raw || typeof raw !== 'object') return { kind: 'manual' };
  const p = raw as Record<string, unknown>;
  if (!isPatternKind(p.kind)) return { kind: 'manual' };
  switch (p.kind) {
    case 'manual':
      return { kind: 'manual' };
    case 'triangle':
    case 'sine':
    case 'sawtooth':
      return { kind: p.kind, periodMs: clampVirtualTagPeriod(p.periodMs) };
    case 'square': {
      const pattern: VirtualTagPattern = {
        kind: 'square',
        periodMs: clampVirtualTagPeriod(p.periodMs),
      };
      if (isFiniteNumber(p.dutyPct)) {
        pattern.dutyPct = clamp(p.dutyPct, 0, 100);
      }
      return pattern;
    }
  }
}

/** 한계 — 양의 유한수만 남기고, 둘 다 없으면 undefined. */
export function sanitizeVirtualTagLimits(
  raw: unknown,
): VirtualTagLimits | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const l = raw as Record<string, unknown>;
  const limits: VirtualTagLimits = {};
  if (isFiniteNumber(l.maxSpeed) && l.maxSpeed > 0)
    limits.maxSpeed = l.maxSpeed;
  if (isFiniteNumber(l.maxAccel) && l.maxAccel > 0)
    limits.maxAccel = l.maxAccel;
  return limits.maxSpeed !== undefined || limits.maxAccel !== undefined
    ? limits
    : undefined;
}

/** 그룹 하나 — id 필수, 이름은 trim·길이 제한(비어도 됨), 표식은 아는 것만. */
export function sanitizeVirtualTagGroup(raw: unknown): VirtualTagGroup | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  if (typeof g.id !== 'string' || g.id.length === 0) return null;
  const group: VirtualTagGroup = {
    id: g.id,
    name:
      typeof g.name === 'string'
        ? g.name.trim().slice(0, VIRTUAL_TAG_GROUP_NAME_MAX)
        : '',
  };
  if (isGroupPreset(g.preset)) group.preset = g.preset;
  return group;
}

/** 그룹 목록 — id 중복은 첫 항목, 상한 초과는 잘라낸다. 순서는 유지한다. */
export function sanitizeVirtualTagGroupList(raw: unknown): VirtualTagGroup[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: VirtualTagGroup[] = [];
  for (const item of raw) {
    const group = sanitizeVirtualTagGroup(item);
    if (!group || seen.has(group.id)) continue;
    seen.add(group.id);
    out.push(group);
    if (out.length >= VIRTUAL_EQUIPMENT_GROUPS_MAX) break;
  }
  return out;
}

/**
 * 태그 하나. `groupIds` 를 주면 그 안에 없는 groupId 는 떼어 미분류로 둔다.
 * 불리언은 범위 0~1·초기값 0/1·패턴 manual|square 로 강제하고 단위·한계를 뗀다.
 */
export function sanitizeVirtualTag(
  raw: unknown,
  groupIds?: ReadonlySet<string>,
): VirtualTagDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.id !== 'string' || t.id.length === 0) return null;
  const code = normalizeVirtualTagCode(t.code);
  if (code === null) return null;

  const name =
    typeof t.name === 'string'
      ? t.name.trim().slice(0, VIRTUAL_TAG_NAME_MAX)
      : '';
  const enabled = t.enabled !== false;
  const groupId =
    typeof t.groupId === 'string' &&
    t.groupId.length > 0 &&
    (!groupIds || groupIds.has(t.groupId))
      ? t.groupId
      : undefined;

  if (t.dataType === 'bool') {
    const pattern = sanitizeVirtualTagPattern(t.pattern);
    const tag: VirtualTagDefinition = {
      id: t.id,
      code,
      name,
      dataType: 'bool',
      min: 0,
      max: 1,
      initial: isFiniteNumber(t.initial)
        ? Math.round(clamp(t.initial, 0, 1))
        : 0,
      pattern: isBoolPatternKind(pattern.kind) ? pattern : { kind: 'manual' },
      enabled,
    };
    if (groupId) tag.groupId = groupId;
    return tag;
  }

  const min = isFiniteNumber(t.min) ? t.min : 0;
  let max = isFiniteNumber(t.max) ? t.max : min + 100;
  // min ≥ max 는 폭 0 의 파형이라 의미가 없다 — 최소 폭을 준다.
  if (max <= min) max = min + 1;

  const tag: VirtualTagDefinition = {
    id: t.id,
    code,
    name,
    dataType: 'number',
    min,
    max,
    initial: clamp(isFiniteNumber(t.initial) ? t.initial : min, min, max),
    pattern: sanitizeVirtualTagPattern(t.pattern),
    enabled,
  };
  if (groupId) tag.groupId = groupId;
  const unit = optionalText(t.unit, VIRTUAL_TAG_UNIT_MAX);
  if (unit) tag.unit = unit;
  const limits = sanitizeVirtualTagLimits(t.limits);
  if (limits) tag.limits = limits;
  return tag;
}

/** 태그 목록 — id·code 중복은 첫 항목만, 상한 초과는 잘라낸다. */
export function sanitizeVirtualTagList(
  raw: unknown,
  groupIds?: ReadonlySet<string>,
): VirtualTagDefinition[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();
  const out: VirtualTagDefinition[] = [];
  for (const item of raw) {
    const tag = sanitizeVirtualTag(item, groupIds);
    if (!tag || seenIds.has(tag.id) || seenCodes.has(tag.code)) continue;
    seenIds.add(tag.id);
    seenCodes.add(tag.code);
    out.push(tag);
    if (out.length >= VIRTUAL_EQUIPMENT_TAGS_MAX) break;
  }
  return out;
}

/** 장비 하나 — id·장비 ID 필수, 그룹을 먼저 정리해 태그의 groupId 를 거른다. */
export function sanitizeVirtualEquipment(
  raw: unknown,
): VirtualEquipment | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== 'string' || e.id.length === 0) return null;
  const craneId = normalizeVirtualEquipmentId(e.craneId);
  if (craneId === null) return null;
  const groups = sanitizeVirtualTagGroupList(e.groups);
  const equipment: VirtualEquipment = {
    id: e.id,
    craneId,
    enabled: e.enabled !== false,
    groups,
    tags: sanitizeVirtualTagList(e.tags, new Set(groups.map((g) => g.id))),
  };
  const name = optionalText(e.name, VIRTUAL_EQUIPMENT_NAME_MAX);
  if (name) equipment.name = name;
  const bay = optionalText(e.bay, VIRTUAL_EQUIPMENT_BAY_MAX);
  if (bay) equipment.bay = bay;
  return equipment;
}

/**
 * 장비 목록 — id 중복과 **정규화한 장비키** 중복(`GC-04` 와 `GC_04`)은 첫
 * 항목만, 상한 초과는 잘라낸다.
 */
export function sanitizeVirtualEquipmentList(raw: unknown): VirtualEquipment[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const out: VirtualEquipment[] = [];
  for (const item of raw) {
    const equipment = sanitizeVirtualEquipment(item);
    if (!equipment || seenIds.has(equipment.id)) continue;
    const key = normalizeVirtualEquipmentKey(equipment.craneId);
    if (seenKeys.has(key)) continue;
    seenIds.add(equipment.id);
    seenKeys.add(key);
    out.push(equipment);
    if (out.length >= VIRTUAL_EQUIPMENTS_MAX) break;
  }
  return out;
}

export function createEmptyVirtualTagSet(): VirtualTagSet {
  return { version: 2, tickMs: VIRTUAL_TAG_TICK_DEFAULT, equipments: [] };
}

/** 버전 1 키에 콜론이 없을 때 태그가 들어가는 장비의 ID. */
export const VIRTUAL_UNASSIGNED_EQUIPMENT_ID = 'UNASSIGNED';

/** 변환된 장비의 내부 id 접두 — 같은 입력이면 같은 id 라 변환이 멱등이다. */
const MIGRATED_EQUIPMENT_ID_PREFIX = 'legacy-';

/** 식별자로 쓸 수 없는 글자를 밑줄로 바꾸고 길이를 맞춘다. 비면 null. */
function coerceIdentifier(raw: string, max: number): string | null {
  const text = raw
    .trim()
    .replace(/[\s:]+/g, '_')
    .slice(0, max);
  return text.length > 0 ? text : null;
}

/**
 * 버전 1(평탄 목록) → 버전 2(장비 계층). 키 `장비:코드` 를 첫 콜론에서 나누고,
 * 콜론이 없는 키는 `VIRTUAL_UNASSIGNED_EQUIPMENT_ID` 장비에 코드로 넣는다.
 * 변환된 태그는 숫자 형식·미분류다. 결과는 버전 2 규칙으로 다시 정규화한다.
 */
export function migrateVirtualTagSetV1(raw: unknown): VirtualTagSet {
  const source: Record<string, unknown> = Array.isArray(raw)
    ? { tags: raw }
    : raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>)
      : {};
  const equipments = new Map<string, Record<string, unknown>>();
  if (Array.isArray(source.tags)) {
    for (const item of source.tags) {
      if (!item || typeof item !== 'object') continue;
      const t = item as Record<string, unknown>;
      if (typeof t.key !== 'string') continue;
      const key = t.key.trim();
      const sep = key.indexOf(VIRTUAL_TAG_KEY_SEPARATOR);
      const rawCraneId =
        sep > 0 ? key.slice(0, sep) : VIRTUAL_UNASSIGNED_EQUIPMENT_ID;
      const rawCode = sep >= 0 ? key.slice(sep + 1) : key;
      const craneId = coerceIdentifier(rawCraneId, VIRTUAL_EQUIPMENT_ID_MAX);
      const code = coerceIdentifier(rawCode, VIRTUAL_TAG_CODE_MAX);
      if (craneId === null || code === null) continue;
      const equipmentKey = normalizeVirtualEquipmentKey(craneId);
      let equipment = equipments.get(equipmentKey);
      if (!equipment) {
        equipment = {
          id: `${MIGRATED_EQUIPMENT_ID_PREFIX}${equipmentKey}`,
          craneId,
          enabled: true,
          groups: [],
          tags: [],
        };
        equipments.set(equipmentKey, equipment);
      }
      const { key: _key, ...rest } = t;
      void _key;
      (equipment.tags as unknown[]).push({
        ...rest,
        code,
        dataType: 'number',
      });
    }
  }
  return {
    version: 2,
    tickMs: clampVirtualTagTick(source.tickMs),
    equipments: sanitizeVirtualEquipmentList([...equipments.values()]),
  };
}

/**
 * 봉투 전체 정규화 — 로드의 유일한 경계. 버전 2 는 그대로 정규화하고, 버전
 * 1(`tags` 배열 또는 배열만 저장된 봉투 이전 포맷)은 변환한다. 어느 쪽도
 * 아니면 빈 세트.
 */
export function sanitizeVirtualTagSet(raw: unknown): VirtualTagSet {
  if (Array.isArray(raw)) return migrateVirtualTagSetV1(raw);
  if (!raw || typeof raw !== 'object') return createEmptyVirtualTagSet();
  const s = raw as Record<string, unknown>;
  if (Array.isArray(s.equipments)) {
    return {
      version: 2,
      tickMs: clampVirtualTagTick(s.tickMs),
      equipments: sanitizeVirtualEquipmentList(s.equipments),
    };
  }
  if (Array.isArray(s.tags)) return migrateVirtualTagSetV1(s);
  return {
    ...createEmptyVirtualTagSet(),
    tickMs: clampVirtualTagTick(s.tickMs),
  };
}
