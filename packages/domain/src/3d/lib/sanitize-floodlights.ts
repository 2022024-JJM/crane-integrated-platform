import {
  FLOODLIGHT_ANGLE_DEFAULT,
  FLOODLIGHT_ANGLE_MAX,
  FLOODLIGHT_ANGLE_MIN,
  FLOODLIGHT_INTENSITY_DEFAULT,
  FLOODLIGHT_INTENSITY_MAX,
  FLOODLIGHT_INTENSITY_MIN,
  FLOODLIGHT_MIN_AIM_DISTANCE,
  type SavedFloodlightInfo,
} from '../model/floodlight-types';
import { clampToRange } from '@crane/core/lib/utils';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 투광등(`SavedSceneInfo.floodlights`) 방어 — 로드·저장 경계에서
 * sanitize-scene-info 가 항목마다 부른다. id 는 모델·텍스트·눈금과 같은
 * 집합에서 중복을 가리므로 sanitize-scene-info 가 붙인다(눈금과 같은 규칙).
 *
 * 비출 수 없는 항목(위치·조준 오프셋이 깨졌거나 조준 거리가 0 인 것)은
 * 통째로 버리고, 각도·세기가 깨진 것은 기본값으로 되돌린다 — 숫자 하나가
 * 오염됐다고 놓아 둔 조명까지 잃을 이유는 없다.
 */
export type SanitizedFloodlightFields = Omit<SavedFloodlightInfo, 'id'>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isVector3Tuple(value: unknown): value is Vector3Tuple {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => isFiniteNumber(item))
  );
}

export function sanitizeFloodlightFields(
  raw: unknown,
): SanitizedFloodlightFields | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const f = raw as Record<string, unknown>;
  if (!isVector3Tuple(f.position) || !isVector3Tuple(f.aim)) return null;
  if (Math.hypot(...f.aim) < FLOODLIGHT_MIN_AIM_DISTANCE) return null;

  const light: SanitizedFloodlightFields = {
    name: typeof f.name === 'string' ? f.name : '',
    position: f.position,
    aim: f.aim,
  };
  // 기본값은 싣지 않는다 — 깨진 값(NaN·문자열)은 기본값과 같은 상태다.
  if (isFiniteNumber(f.angle)) {
    const angle = clampToRange(
      f.angle,
      FLOODLIGHT_ANGLE_MIN,
      FLOODLIGHT_ANGLE_MAX,
    );
    if (angle !== FLOODLIGHT_ANGLE_DEFAULT) light.angle = angle;
  }
  if (isFiniteNumber(f.intensity)) {
    const intensity = clampToRange(
      f.intensity,
      FLOODLIGHT_INTENSITY_MIN,
      FLOODLIGHT_INTENSITY_MAX,
    );
    if (intensity !== FLOODLIGHT_INTENSITY_DEFAULT) light.intensity = intensity;
  }
  if (f.locked === true) light.locked = true;
  return light;
}
