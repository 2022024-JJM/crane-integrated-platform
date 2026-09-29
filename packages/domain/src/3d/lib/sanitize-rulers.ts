import {
  isRulerInterval,
  RULER_DEFAULT_COLOR,
  RULER_GUIDE_OPACITY_DEFAULT,
  RULER_GUIDE_OPACITY_MIN,
  RULER_INTERVAL_DEFAULT,
  type SavedRulerGuide,
  type SavedRulerInfo,
} from '../model/ruler-types';
import { normalizeZoneColor } from './sanitize-model-zones';
import { clampToRange } from '@crane/core/lib/utils';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 거리 눈금(`SavedSceneInfo.rulers`) 방어 — 로드·저장 경계에서
 * sanitize-scene-info 가 항목마다 부른다. id 는 모델·텍스트와 같은 집합에서
 * 중복을 가리므로 여기서 다루지 않고 sanitize-scene-info 가 붙인다.
 *
 * 그릴 수 없는 항목(배치·길이가 깨진 것)은 통째로 버리고, 표시 옵션이 깨진
 * 것은 기본값으로 되돌린다 — 색이나 간격이 오염됐다고 그려 둔 눈금까지 잃을
 * 이유는 없다. 보조선도 같은 원칙이다: 길이가 깨졌으면 보조선만 버린다.
 */
export type SanitizedRulerFields = Omit<SavedRulerInfo, 'id'>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isVector3Tuple(value: unknown): value is Vector3Tuple {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => isFiniteNumber(item))
  );
}

/** 보조선 하나. 길이가 깨졌거나 객체가 아니면 undefined(보조선 없음). */
export function sanitizeRulerGuide(raw: unknown): SavedRulerGuide | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const g = raw as Record<string, unknown>;
  if (!isPositiveNumber(g.length)) return undefined;

  const guide: SavedRulerGuide = {
    length: g.length,
    color: normalizeZoneColor(g.color) ?? RULER_DEFAULT_COLOR,
  };
  // 기본값은 싣지 않는다 — 'left'·불투명도 1 은 필드 없음과 같은 상태다.
  if (g.side === 'right') guide.side = 'right';
  if (isFiniteNumber(g.opacity)) {
    const opacity = clampToRange(g.opacity, RULER_GUIDE_OPACITY_MIN, 1);
    if (opacity !== RULER_GUIDE_OPACITY_DEFAULT) guide.opacity = opacity;
  }
  return guide;
}

export function sanitizeRulerFields(raw: unknown): SanitizedRulerFields | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!isVector3Tuple(r.position) || !isVector3Tuple(r.rotation)) return null;
  if (!isPositiveNumber(r.length)) return null;

  const ruler: SanitizedRulerFields = {
    name: typeof r.name === 'string' ? r.name : '',
    position: r.position,
    rotation: r.rotation,
    length: r.length,
    // 고를 수 있는 간격이 아니면(오타·옛 값) 기본 간격으로 되돌린다.
    interval: isRulerInterval(r.interval) ? r.interval : RULER_INTERVAL_DEFAULT,
    textColor: normalizeZoneColor(r.textColor) ?? RULER_DEFAULT_COLOR,
    dotColor: normalizeZoneColor(r.dotColor) ?? RULER_DEFAULT_COLOR,
  };
  const guide = sanitizeRulerGuide(r.guide);
  if (guide) ruler.guide = guide;
  // 기본값은 싣지 않는다 — 0·false 는 필드 없음과 같은 상태다.
  if (isFiniteNumber(r.startValue) && r.startValue !== 0) {
    ruler.startValue = r.startValue;
  }
  if (r.unitHidden === true) ruler.unitHidden = true;
  if (r.locked === true) ruler.locked = true;
  return ruler;
}
