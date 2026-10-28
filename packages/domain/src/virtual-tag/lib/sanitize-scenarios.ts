import {
  SCENARIO_NAME_MAX,
  SCENARIO_TAGS_MAX,
  SCENARIOS_MAX,
  VIRTUAL_TAG_BOOL_PATTERN_KINDS,
  VIRTUAL_TAG_KEYFRAMES_MAX,
  VIRTUAL_TAG_NAME_MAX,
  VIRTUAL_TAG_PATTERN_KINDS,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  VIRTUAL_TAG_PERIOD_MAX,
  VIRTUAL_TAG_PERIOD_MIN,
  VIRTUAL_TAG_SECONDS_DECIMALS,
  VIRTUAL_TAG_TICK_DEFAULT,
  VIRTUAL_TAG_TICK_MAX,
  VIRTUAL_TAG_TICK_MIN,
  VIRTUAL_TAG_UNIT_MAX,
  type ScenarioSet,
  type ScenarioTag,
  type SimulationScenario,
  type VirtualTagDefinition,
  type VirtualTagKeyframe,
  type VirtualTagPattern,
  type VirtualTagPatternKind,
} from '../model/types';
import { normalizeVirtualTagCode } from './tag-code';

/**
 * 저장소(배포 파일·localStorage·가져온 JSON)에서 읽은 시나리오 세트의 방어.
 * 손상 항목은 개별로 버리고, 숫자는 범위로 클램프한다. 중복은 첫 항목만 남긴다.
 *
 * 저장본은 버전 1(`{ tickSec, scenarios[] }`, 시간 단위 초)이다. 옛 가상 태그
 * 세트(장비 › 태그)는 읽지 않는다 — 배포 파일은 변환해 두었고, 운영
 * localStorage 의 옛 봉투는 키가 달라 무시된다.
 */

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const SECONDS_SCALE = 10 ** VIRTUAL_TAG_SECONDS_DECIMALS;

/** 초 단위 시간을 저장 해상도(ms)로 반올림 — 부동소수 잡음이 dirty 를 만들지 않게. */
function roundSeconds(value: number): number {
  return Math.round(value * SECONDS_SCALE) / SECONDS_SCALE;
}

function isPatternKind(value: unknown): value is VirtualTagPatternKind {
  return (VIRTUAL_TAG_PATTERN_KINDS as readonly unknown[]).includes(value);
}

function isBoolPatternKind(kind: VirtualTagPatternKind): boolean {
  return (VIRTUAL_TAG_BOOL_PATTERN_KINDS as readonly string[]).includes(kind);
}

/** 선택 문자열 — trim 뒤 비면 undefined, 길면 자른다. */
function optionalText(raw: unknown, max: number): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim();
  return text.length > 0 ? text.slice(0, max) : undefined;
}

/** 갱신 주기(초) 클램프. 숫자가 아니면 기본값. */
export function clampVirtualTagTick(value: unknown): number {
  if (!isFiniteNumber(value)) return VIRTUAL_TAG_TICK_DEFAULT;
  return roundSeconds(clamp(value, VIRTUAL_TAG_TICK_MIN, VIRTUAL_TAG_TICK_MAX));
}

/** 파형 주기(초) 클램프. 숫자가 아니면 기본값. */
export function clampVirtualTagPeriod(value: unknown): number {
  if (!isFiniteNumber(value)) return VIRTUAL_TAG_PERIOD_DEFAULT;
  return roundSeconds(
    clamp(value, VIRTUAL_TAG_PERIOD_MIN, VIRTUAL_TAG_PERIOD_MAX),
  );
}

/** 없앤 삼각파 — 사인파와 거의 같은 왕복이라 같은 주기의 사인파로 읽는다. */
const LEGACY_TRIANGLE_KIND = 'triangle';

export function sanitizeVirtualTagPattern(raw: unknown): VirtualTagPattern {
  if (!raw || typeof raw !== 'object') return { kind: 'manual' };
  const p = raw as Record<string, unknown>;
  const kind = p.kind === LEGACY_TRIANGLE_KIND ? 'sine' : p.kind;
  if (!isPatternKind(kind)) return { kind: 'manual' };
  switch (kind) {
    case 'manual':
      return { kind: 'manual' };
    case 'sine':
    case 'sawtooth':
      return { kind, periodSec: clampVirtualTagPeriod(p.periodSec) };
    case 'square': {
      const pattern: VirtualTagPattern = {
        kind: 'square',
        periodSec: clampVirtualTagPeriod(p.periodSec),
      };
      if (isFiniteNumber(p.dutyPct)) {
        pattern.dutyPct = clamp(p.dutyPct, 0, 100);
      }
      return pattern;
    }
    case 'keyframes': {
      const points = sanitizeKeyframes(p.points);
      // 점이 하나도 없으면 값이 없다 — 수동으로 되돌린다.
      if (points.length === 0) return { kind: 'manual' };
      const pattern: VirtualTagPattern = { kind: 'keyframes', points };
      if (p.loop === true) pattern.loop = true;
      if (p.ease === 'smooth') pattern.ease = 'smooth';
      return pattern;
    }
  }
}

/**
 * 키프레임 점 — `atSec` 은 0 이상 유한수(ms 해상도로 반올림), `value` 는
 * 유한수. 깨진 점은 버리고 `atSec` 오름차순으로 정렬하며 같은 시각은 첫 점만
 * 남긴다(안정 정렬이라 입력 순서가 곧 우선순위). 상한 초과는 잘라낸다.
 */
export function sanitizeKeyframes(raw: unknown): VirtualTagKeyframe[] {
  if (!Array.isArray(raw)) return [];
  const points: VirtualTagKeyframe[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const k = item as Record<string, unknown>;
    if (!isFiniteNumber(k.atSec) || k.atSec < 0 || !isFiniteNumber(k.value)) {
      continue;
    }
    points.push({ atSec: roundSeconds(k.atSec), value: k.value });
  }
  points.sort((a, b) => a.atSec - b.atSec);
  const out: VirtualTagKeyframe[] = [];
  for (const point of points) {
    if (out.length > 0 && out[out.length - 1].atSec === point.atSec) continue;
    out.push(point);
    if (out.length >= VIRTUAL_TAG_KEYFRAMES_MAX) break;
  }
  return out;
}

/**
 * 태그 정의 하나. 불리언은 범위 0~1·초기값 0/1·패턴 manual|square 로 강제하고
 * 단위를 뗀다.
 */
export function sanitizeVirtualTag(raw: unknown): VirtualTagDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.id !== 'string' || t.id.length === 0) return null;
  const code = normalizeVirtualTagCode(t.code);
  if (code === null) return null;

  const name =
    typeof t.name === 'string'
      ? t.name.trim().slice(0, VIRTUAL_TAG_NAME_MAX)
      : '';

  if (t.dataType === 'bool') {
    const pattern = sanitizeVirtualTagPattern(t.pattern);
    return {
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
    };
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
  };
  const unit = optionalText(t.unit, VIRTUAL_TAG_UNIT_MAX);
  if (unit) tag.unit = unit;
  return tag;
}

/** 시나리오 태그 — 정의 + `modelId`(비어 있지 않은 문자열). */
export function sanitizeScenarioTag(raw: unknown): ScenarioTag | null {
  const tag = sanitizeVirtualTag(raw);
  if (!tag) return null;
  const modelId = (raw as Record<string, unknown>).modelId;
  if (typeof modelId !== 'string' || modelId.length === 0) return null;
  return { ...tag, modelId };
}

/** 시나리오 안에서 태그를 식별하는 키 — `(modelId, code)`. */
export function scenarioTagKey(tag: Pick<ScenarioTag, 'modelId' | 'code'>) {
  return `${tag.modelId}\u0000${tag.code}`;
}

/** 태그 목록 — id·`(modelId, code)` 중복은 첫 항목만, 상한 초과는 잘라낸다. */
export function sanitizeScenarioTagList(raw: unknown): ScenarioTag[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const out: ScenarioTag[] = [];
  for (const item of raw) {
    const tag = sanitizeScenarioTag(item);
    if (!tag || seenIds.has(tag.id)) continue;
    const key = scenarioTagKey(tag);
    if (seenKeys.has(key)) continue;
    seenIds.add(tag.id);
    seenKeys.add(key);
    out.push(tag);
    if (out.length >= SCENARIO_TAGS_MAX) break;
  }
  return out;
}

/** 시나리오 하나 — id·sceneFile 필수, 이름은 trim·길이 제한·비면 id. */
export function sanitizeScenario(raw: unknown): SimulationScenario | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== 'string' || s.id.length === 0) return null;
  const sceneFile = optionalText(s.sceneFile, 200);
  if (!sceneFile) return null;
  return {
    id: s.id,
    name: optionalText(s.name, SCENARIO_NAME_MAX) ?? s.id,
    sceneFile,
    tags: sanitizeScenarioTagList(s.tags),
  };
}

/** 시나리오 목록 — id 중복은 첫 항목만, 상한 초과는 잘라낸다. */
export function sanitizeScenarioList(raw: unknown): SimulationScenario[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const out: SimulationScenario[] = [];
  for (const item of raw) {
    const scenario = sanitizeScenario(item);
    if (!scenario || seenIds.has(scenario.id)) continue;
    seenIds.add(scenario.id);
    out.push(scenario);
    if (out.length >= SCENARIOS_MAX) break;
  }
  return out;
}

export function createEmptyScenarioSet(): ScenarioSet {
  return { version: 1, tickSec: VIRTUAL_TAG_TICK_DEFAULT, scenarios: [] };
}

/**
 * 봉투 전체 정규화 — 로드의 유일한 경계. `scenarios` 배열이 없으면 tick 만
 * 살린 빈 세트(옛 가상 태그 세트 포함).
 */
export function sanitizeScenarioSet(raw: unknown): ScenarioSet {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyScenarioSet();
  }
  const s = raw as Record<string, unknown>;
  return {
    version: 1,
    tickSec: clampVirtualTagTick(s.tickSec),
    scenarios: sanitizeScenarioList(s.scenarios),
  };
}
