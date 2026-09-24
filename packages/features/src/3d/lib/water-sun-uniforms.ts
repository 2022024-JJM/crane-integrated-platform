import { clampToRange } from '@crane/core/lib/utils';
import type { Vector3Tuple } from 'three';
import { SCENE_LIGHTING_BASE, smoothstep, type RgbTuple } from './sky-lighting';

/**
 * 조명 상태(sceneLightingInfo.sun*) → 바다 셰이더의 태양 유니폼.
 *
 * 물의 태양 하이라이트는 **실제 태양**(solar 의 sunDir·sky.sunIntensity·
 * sky.sunColor, manual 은 수동 태양)을 따른다 — 키 라이트는 밤에 작업등(마스트
 * 방향)이 섞여 물 위에 난색 글린트가 생기고 박명엔 방향 클램프로 하늘의 태양
 * 스프라이트와 어긋난다. 태양만 쓰면 밤 바다는 어두운 하늘 반사 + waterColor
 * 산란으로 자연스럽게 어둡다.
 *
 * 세기는 색에 접는다(셰이더에 세기 유니폼이 없다). 배율 = clamp(세기/기준, 0, 1)
 * × 수평선 페이드. solar 의 지면 조도 보상으로 세기가 기준×1.6 까지 오르므로
 * 클램프가 필수이고, sky.sunIntensity 는 −3° 에서야 0 이라 계단 없이 0 으로
 * 내리려면 y 페이드가 필요하다.
 *
 * ui 가 아니라 lib 에 있는 이유: 순수 함수라 여기서 테스트한다.
 */

/** 태양 방향 y 가 이 값(sin 2°) 아래로 내려가면 하이라이트가 0 으로 페이드된다. */
export const WATER_SUN_HORIZON_FADE_Y = Math.sin((2 * Math.PI) / 180);

const UP: Vector3Tuple = [0, 1, 0];

export interface WaterSunUniforms {
  /** 정규화된 태양 방향. 영벡터·비유한 입력은 천정. */
  direction: Vector3Tuple;
  /** 세기 배율을 곱한 색. */
  color: RgbTuple;
}

/** 비유한 성분은 1(낮 폴백) — sanitizeElevation 과 같은 규칙. */
function sanitizeUnit(value: number): number {
  return Number.isFinite(value) ? value : 1;
}

function normalizeDirection(direction: Vector3Tuple): Vector3Tuple {
  const [x, y, z] = direction;
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length === 0) return [...UP];
  return [x / length, y / length, z / length];
}

/**
 * 입력 튜플은 건드리지 않고 항상 새 튜플을 돌려준다. 기준 세기가 0 이하·
 * 비유한이면 배율을 1 로 본다(나눌 수 없다).
 */
export function resolveWaterSunUniforms(
  direction: Vector3Tuple,
  color: RgbTuple,
  intensity: number,
  baseIntensity: number = SCENE_LIGHTING_BASE.sunIntensity,
): WaterSunUniforms {
  const unit = normalizeDirection(direction);
  const ratio =
    Number.isFinite(intensity) &&
    Number.isFinite(baseIntensity) &&
    baseIntensity > 0
      ? clampToRange(intensity / baseIntensity, 0, 1)
      : 1;
  const scale = ratio * smoothstep(0, WATER_SUN_HORIZON_FADE_Y, unit[1]);
  return {
    direction: unit,
    color: [
      sanitizeUnit(color[0]) * scale,
      sanitizeUnit(color[1]) * scale,
      sanitizeUnit(color[2]) * scale,
    ],
  };
}
