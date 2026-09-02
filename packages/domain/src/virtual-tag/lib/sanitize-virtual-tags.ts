import {
  VIRTUAL_TAG_KEY_MAX,
  VIRTUAL_TAG_NAME_MAX,
  VIRTUAL_TAG_PATTERN_KINDS,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  VIRTUAL_TAG_PERIOD_MAX,
  VIRTUAL_TAG_PERIOD_MIN,
  VIRTUAL_TAG_STEP_PCT_DEFAULT,
  VIRTUAL_TAG_TICK_DEFAULT,
  VIRTUAL_TAG_TICK_MAX,
  VIRTUAL_TAG_TICK_MIN,
  VIRTUAL_TAG_UNIT_MAX,
  VIRTUAL_TAGS_MAX,
  type VirtualTagDefinition,
  type VirtualTagPattern,
  type VirtualTagPatternKind,
  type VirtualTagSet,
} from '../model/types';

/**
 * 저장소(localStorage·가져온 JSON)에서 읽은 가상 태그 방어. 손상 항목은 개별로
 * 버리고, 숫자는 범위로 클램프한다. 키 중복은 첫 항목만 남긴다.
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
    case 'random-walk':
      return {
        kind: 'random-walk',
        stepPct: isFiniteNumber(p.stepPct)
          ? clamp(p.stepPct, 0, 100)
          : VIRTUAL_TAG_STEP_PCT_DEFAULT,
        seed: isFiniteNumber(p.seed) ? Math.floor(p.seed) >>> 0 : 1,
      };
  }
}

/** 키 정규화 — trim 후 비었거나 길이 초과면 null. */
export function normalizeVirtualTagKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  if (key.length === 0 || key.length > VIRTUAL_TAG_KEY_MAX) return null;
  return key;
}

export function sanitizeVirtualTag(raw: unknown): VirtualTagDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.id !== 'string' || t.id.length === 0) return null;
  const key = normalizeVirtualTagKey(t.key);
  if (key === null) return null;

  const min = isFiniteNumber(t.min) ? t.min : 0;
  let max = isFiniteNumber(t.max) ? t.max : min + 100;
  // min ≥ max 는 폭 0 의 파형이라 의미가 없다 — 최소 폭을 준다.
  if (max <= min) max = min + 1;

  const tag: VirtualTagDefinition = {
    id: t.id,
    key,
    name:
      typeof t.name === 'string'
        ? t.name.trim().slice(0, VIRTUAL_TAG_NAME_MAX)
        : '',
    min,
    max,
    initial: clamp(isFiniteNumber(t.initial) ? t.initial : min, min, max),
    pattern: sanitizeVirtualTagPattern(t.pattern),
    enabled: t.enabled !== false,
  };
  if (typeof t.unit === 'string' && t.unit.trim().length > 0) {
    tag.unit = t.unit.trim().slice(0, VIRTUAL_TAG_UNIT_MAX);
  }
  return tag;
}

/** 배열 정규화 — id·key 중복은 첫 항목만, 상한 초과는 잘라낸다. */
export function sanitizeVirtualTagList(raw: unknown): VirtualTagDefinition[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const out: VirtualTagDefinition[] = [];
  for (const item of raw) {
    const tag = sanitizeVirtualTag(item);
    if (!tag || seenIds.has(tag.id) || seenKeys.has(tag.key)) continue;
    seenIds.add(tag.id);
    seenKeys.add(tag.key);
    out.push(tag);
    if (out.length >= VIRTUAL_TAGS_MAX) break;
  }
  return out;
}

export function createEmptyVirtualTagSet(): VirtualTagSet {
  return { version: 1, tickMs: VIRTUAL_TAG_TICK_DEFAULT, tags: [] };
}

/**
 * 봉투 전체 정규화. 봉투 이전 포맷(배열만 저장된 경우)도 받아 준다 — 어차피
 * 버전 1 하나뿐이라 알 수 없는 버전도 같은 규칙으로 최대한 살린다.
 */
export function sanitizeVirtualTagSet(raw: unknown): VirtualTagSet {
  if (Array.isArray(raw)) {
    return { ...createEmptyVirtualTagSet(), tags: sanitizeVirtualTagList(raw) };
  }
  if (!raw || typeof raw !== 'object') return createEmptyVirtualTagSet();
  const s = raw as Record<string, unknown>;
  return {
    version: 1,
    tickMs: clampVirtualTagTick(s.tickMs),
    tags: sanitizeVirtualTagList(s.tags),
  };
}
