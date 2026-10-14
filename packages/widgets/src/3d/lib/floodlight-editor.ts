import {
  FLOODLIGHT_ANGLE_DEFAULT,
  FLOODLIGHT_ANGLE_MAX,
  FLOODLIGHT_ANGLE_MIN,
  FLOODLIGHT_INTENSITY_DEFAULT,
  FLOODLIGHT_INTENSITY_MAX,
  FLOODLIGHT_INTENSITY_MIN,
  FLOODLIGHT_MIN_AIM_DISTANCE,
  floodlightAimPoint,
  numRound,
  type SavedFloodlightInfo,
} from '@crane/domain/3d';
import { clampToRange } from '@crane/core/lib/utils';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 투광등의 에디터 쪽 순수 로직 — 인스펙터 조명 탭의 값 갱신과 조준점 다시
 * 찍기. 배치 기하(두 점 → 기구·조준)는 domain lib/floodlight.ts 에 있다.
 *
 * 갱신 함수는 값이 같으면 **같은 참조**를 돌려준다 — updateSelectedFloodlight
 * 가 그걸 보고 씬을 건드리지 않아 히스토리·dirty 가 오염되지 않는다(눈금
 * withRuler* 와 같은 규칙). 잘못된 입력(비유한·조준 거리 0)도 같은 참조다.
 */

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function toMetersPerUnit(metersPerUnit: number): number {
  return isPositive(metersPerUnit) ? metersPerUnit : 1;
}

/** 저장값(씬 unit) → 인스펙터 표시값(m). */
export function floodlightUnitsToMeters(
  units: number,
  metersPerUnit: number,
): number {
  return numRound(units * toMetersPerUnit(metersPerUnit));
}

/** 기구 높이(씬 unit) — 조준점 높이 기준. 바닥 아래를 비추는 조명은 양수다. */
export function floodlightHeightUnits(light: SavedFloodlightInfo): number {
  return -light.aim[1];
}

function isAimValid(aim: Vector3Tuple): boolean {
  return (
    aim.every((v) => Number.isFinite(v)) &&
    Math.hypot(...aim) >= FLOODLIGHT_MIN_AIM_DISTANCE
  );
}

function isSameTuple(a: Vector3Tuple, b: Vector3Tuple): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/**
 * 높이(m 입력 → 씬 unit). 조준점은 그 자리에 두고 기구만 오르내린다 — 빛
 * 웅덩이가 움직이지 않는다. 0 이하·비유한은 무시.
 */
export function withFloodlightHeightMeters(
  light: SavedFloodlightInfo,
  heightM: number,
  metersPerUnit: number,
): SavedFloodlightInfo {
  if (!isPositive(heightM)) return light;
  const height = numRound(heightM / toMetersPerUnit(metersPerUnit));
  if (!isPositive(height)) return light;
  const aimPoint = floodlightAimPoint(light);
  const position: Vector3Tuple = [
    light.position[0],
    numRound(aimPoint[1] + height),
    light.position[2],
  ];
  const aim: Vector3Tuple = [light.aim[0], numRound(-height), light.aim[2]];
  if (!isAimValid(aim)) return light;
  if (isSameTuple(position, light.position) && isSameTuple(aim, light.aim)) {
    return light;
  }
  return { ...light, position, aim };
}

/**
 * 조준점의 월드 X 또는 Z(m 입력 → 씬 unit). 기구는 그대로고 오프셋만 바뀐다.
 */
export function withFloodlightAimAxisMeters(
  light: SavedFloodlightInfo,
  axis: 'x' | 'z',
  valueM: number,
  metersPerUnit: number,
): SavedFloodlightInfo {
  if (!Number.isFinite(valueM)) return light;
  const index = axis === 'x' ? 0 : 2;
  const world = valueM / toMetersPerUnit(metersPerUnit);
  const aim: Vector3Tuple = [...light.aim] as Vector3Tuple;
  aim[index] = numRound(world - light.position[index]);
  if (!isAimValid(aim) || isSameTuple(aim, light.aim)) return light;
  return { ...light, aim };
}

/** 조준점을 바닥의 한 점(월드, 씬 unit)으로 — "조준점 다시 찍기". */
export function withFloodlightAimPoint(
  light: SavedFloodlightInfo,
  point: Vector3Tuple,
): SavedFloodlightInfo {
  if (!point.every((v) => Number.isFinite(v))) return light;
  const aim: Vector3Tuple = [
    numRound(point[0] - light.position[0]),
    numRound(point[1] - light.position[1]),
    numRound(point[2] - light.position[2]),
  ];
  if (!isAimValid(aim) || isSameTuple(aim, light.aim)) return light;
  return { ...light, aim };
}

/** 콘 반각(도). 범위로 클램프하고 기본값이면 필드를 뗀다. */
export function withFloodlightAngle(
  light: SavedFloodlightInfo,
  angleDeg: number,
): SavedFloodlightInfo {
  if (!Number.isFinite(angleDeg)) return light;
  const next = numRound(
    clampToRange(angleDeg, FLOODLIGHT_ANGLE_MIN, FLOODLIGHT_ANGLE_MAX),
    1,
  );
  if ((light.angle ?? FLOODLIGHT_ANGLE_DEFAULT) === next) return light;
  const { angle: _angle, ...rest } = light;
  void _angle;
  return next === FLOODLIGHT_ANGLE_DEFAULT ? rest : { ...rest, angle: next };
}

/** 세기 배율. 범위로 클램프하고 기본값이면 필드를 뗀다. */
export function withFloodlightIntensity(
  light: SavedFloodlightInfo,
  intensity: number,
): SavedFloodlightInfo {
  if (!Number.isFinite(intensity)) return light;
  const next = numRound(
    clampToRange(intensity, FLOODLIGHT_INTENSITY_MIN, FLOODLIGHT_INTENSITY_MAX),
    2,
  );
  if ((light.intensity ?? FLOODLIGHT_INTENSITY_DEFAULT) === next) return light;
  const { intensity: _intensity, ...rest } = light;
  void _intensity;
  return next === FLOODLIGHT_INTENSITY_DEFAULT
    ? rest
    : { ...rest, intensity: next };
}
