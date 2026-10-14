import {
  FLOODLIGHT_ANGLE_DEFAULT,
  FLOODLIGHT_INTENSITY_DEFAULT,
  FLOODLIGHT_MIN_AIM_DISTANCE,
  type SavedFloodlightInfo,
} from '../model/floodlight-types';
import { numRound } from './math-utils';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 투광등 기하 — 배치(두 점 → 기구·조준 오프셋), 조준점, 콘 윤곽. 세 캔버스의
 * 기구 표시와 에디터 미리보기·인스펙터가 같은 함수를 쓴다. SpotLight 세기
 * 환산은 features(lib/floodlight-spot.ts)다.
 */

export interface FloodlightPlacement {
  position: Vector3Tuple;
  aim: Vector3Tuple;
}

type FloodlightGeometry = Pick<SavedFloodlightInfo, 'position' | 'aim'> &
  Partial<Pick<SavedFloodlightInfo, 'angle'>>;

function isFiniteTuple(value: readonly number[]): boolean {
  return value.every((v) => Number.isFinite(v));
}

/**
 * 바닥의 두 점에서 배치를 만든다. 첫 점 위로 `height`(씬 unit) 올린 자리가
 * 기구, 두 번째 점이 조준점이다. 조준점이 없으면(한 번 찍고 Esc) 바로 아래를
 * 비춘다. 조준 거리가 FLOODLIGHT_MIN_AIM_DISTANCE 보다 짧으면 null —
 * 기구 자리를 조준점으로 다시 찍은 경우.
 */
export function floodlightPlacementFromPoints(
  ground: Vector3Tuple,
  aimPoint: Vector3Tuple | null,
  height: number,
): FloodlightPlacement | null {
  if (!isFiniteTuple(ground) || !Number.isFinite(height)) return null;
  if (aimPoint && !isFiniteTuple(aimPoint)) return null;
  const position: Vector3Tuple = [
    numRound(ground[0]),
    numRound(ground[1] + height),
    numRound(ground[2]),
  ];
  const target = aimPoint ?? ground;
  const aim: Vector3Tuple = [
    numRound(target[0] - position[0]),
    numRound(target[1] - position[1]),
    numRound(target[2] - position[2]),
  ];
  if (Math.hypot(...aim) < FLOODLIGHT_MIN_AIM_DISTANCE) return null;
  return { position, aim };
}

/** 조준점(월드) = 기구 + 오프셋. */
export function floodlightAimPoint(light: FloodlightGeometry): Vector3Tuple {
  return [
    light.position[0] + light.aim[0],
    light.position[1] + light.aim[1],
    light.position[2] + light.aim[2],
  ];
}

/** 기구에서 조준점까지 거리(씬 unit). */
export function floodlightAimDistance(light: FloodlightGeometry): number {
  return Math.hypot(light.aim[0], light.aim[1], light.aim[2]);
}

export function resolveFloodlightAngle(light: { angle?: number }): number {
  return light.angle ?? FLOODLIGHT_ANGLE_DEFAULT;
}

export function resolveFloodlightIntensity(light: {
  intensity?: number;
}): number {
  return light.intensity ?? FLOODLIGHT_INTENSITY_DEFAULT;
}

/** 조준점에서의 콘 반경(씬 unit) = 거리 × tan(반각). */
export function floodlightConeRadius(light: FloodlightGeometry): number {
  const angle = (resolveFloodlightAngle(light) * Math.PI) / 180;
  return floodlightAimDistance(light) * Math.tan(angle);
}

/**
 * 콘 윤곽 — 조준점을 중심으로 조준 축에 수직인 원(`rim`, 닫힌 폴리라인)과
 * 기구에서 원 위 4점으로 내려오는 `spokes`. 에디터가 선택한 조명에 그린다.
 * 조준 축이 수직이면 접선 기저를 X 축으로 둔다.
 */
export function floodlightConeOutline(
  light: FloodlightGeometry,
  segments = 32,
): { rim: Vector3Tuple[]; spokes: Vector3Tuple[][] } {
  const center = floodlightAimPoint(light);
  const radius = floodlightConeRadius(light);
  const length = floodlightAimDistance(light);
  const axis: Vector3Tuple =
    length > 0
      ? [light.aim[0] / length, light.aim[1] / length, light.aim[2] / length]
      : [0, -1, 0];
  // 접선 기저: 축과 평행하지 않은 참조 벡터와의 외적.
  const ref: Vector3Tuple = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let u: Vector3Tuple = [
    ref[1] * axis[2] - ref[2] * axis[1],
    ref[2] * axis[0] - ref[0] * axis[2],
    ref[0] * axis[1] - ref[1] * axis[0],
  ];
  const uLen = Math.hypot(...u) || 1;
  u = [u[0] / uLen, u[1] / uLen, u[2] / uLen];
  const v: Vector3Tuple = [
    axis[1] * u[2] - axis[2] * u[1],
    axis[2] * u[0] - axis[0] * u[2],
    axis[0] * u[1] - axis[1] * u[0],
  ];
  const count = Math.max(4, Math.floor(segments));
  const rim: Vector3Tuple[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i / count) * Math.PI * 2;
    const c = Math.cos(t) * radius;
    const s = Math.sin(t) * radius;
    rim.push([
      center[0] + u[0] * c + v[0] * s,
      center[1] + u[1] * c + v[1] * s,
      center[2] + u[2] * c + v[2] * s,
    ]);
  }
  // 닫힌 폴리라인 — 끝 점은 첫 점의 복사(삼각함수 오차 없이 정확히 같다).
  rim.push([rim[0][0], rim[0][1], rim[0][2]]);
  const spokes: Vector3Tuple[][] = [];
  for (let k = 0; k < 4; k += 1) {
    const point = rim[Math.floor((k * count) / 4)];
    spokes.push([[...light.position], point]);
  }
  return { rim, spokes };
}
