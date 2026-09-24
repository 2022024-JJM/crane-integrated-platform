import type { Vector3Tuple } from 'three';
import { describe, expect, it } from 'vitest';
import {
  SCENE_LIGHTING_BASE,
  SUN_COLOR_HORIZON,
  type RgbTuple,
} from '../sky-lighting';
import {
  WATER_SUN_HORIZON_FADE_Y,
  resolveWaterSunUniforms,
} from '../water-sun-uniforms';

const BASE = SCENE_LIGHTING_BASE.sunIntensity;
const UP: Vector3Tuple = [0, 1, 0];
const WHITE: RgbTuple = [1, 1, 1];

/** y 성분이 주어진 단위 벡터(xz 평면 쪽으로 기울인다). */
function unitWithY(y: number): Vector3Tuple {
  return [0, y, Math.sqrt(Math.max(0, 1 - y * y))];
}

describe('resolveWaterSunUniforms — 세기 배율', () => {
  it('천정·기준 세기·백색 → 방향 그대로, 색 [1,1,1]', () => {
    expect(resolveWaterSunUniforms(UP, WHITE, BASE, BASE)).toEqual({
      direction: [0, 1, 0],
      color: [1, 1, 1],
    });
  });

  it('세기 0 → [0,0,0], 음수 → 0 으로 클램프', () => {
    expect(resolveWaterSunUniforms(UP, WHITE, 0, BASE).color).toEqual([
      0, 0, 0,
    ]);
    expect(resolveWaterSunUniforms(UP, WHITE, -1, BASE).color).toEqual([
      0, 0, 0,
    ]);
  });

  it('기준×1.6(solar 보상 상한) → 배율 1 클램프', () => {
    expect(resolveWaterSunUniforms(UP, WHITE, BASE * 1.6, BASE).color).toEqual([
      1, 1, 1,
    ]);
  });

  it('기준의 절반 → 배율 0.5, 색은 성분마다 곱', () => {
    const { color } = resolveWaterSunUniforms(
      UP,
      SUN_COLOR_HORIZON,
      BASE / 2,
      BASE,
    );
    expect(color[0]).toBeCloseTo(SUN_COLOR_HORIZON[0] * 0.5, 12);
    expect(color[1]).toBeCloseTo(SUN_COLOR_HORIZON[1] * 0.5, 12);
    expect(color[2]).toBeCloseTo(SUN_COLOR_HORIZON[2] * 0.5, 12);
  });

  it('NaN·Infinity 세기 → 배율 1(낮 폴백)', () => {
    expect(resolveWaterSunUniforms(UP, WHITE, Number.NaN, BASE).color).toEqual([
      1, 1, 1,
    ]);
    expect(
      resolveWaterSunUniforms(UP, WHITE, Number.POSITIVE_INFINITY, BASE).color,
    ).toEqual([1, 1, 1]);
    expect(
      resolveWaterSunUniforms(UP, WHITE, Number.NEGATIVE_INFINITY, BASE).color,
    ).toEqual([1, 1, 1]);
  });

  it('기준 세기가 0·음수·NaN 이면 나눌 수 없어 배율 1', () => {
    expect(resolveWaterSunUniforms(UP, WHITE, 2, 0).color).toEqual([1, 1, 1]);
    expect(resolveWaterSunUniforms(UP, WHITE, 2, -3).color).toEqual([1, 1, 1]);
    expect(resolveWaterSunUniforms(UP, WHITE, 2, Number.NaN).color).toEqual([
      1, 1, 1,
    ]);
  });

  it('기본 기준 세기는 SCENE_LIGHTING_BASE.sunIntensity', () => {
    expect(resolveWaterSunUniforms(UP, WHITE, BASE)).toEqual(
      resolveWaterSunUniforms(UP, WHITE, BASE, BASE),
    );
    expect(resolveWaterSunUniforms(UP, WHITE, BASE / 4).color[0]).toBeCloseTo(
      0.25,
      12,
    );
  });
});

describe('resolveWaterSunUniforms — 색 성분 방어', () => {
  it('비유한 색 성분은 1 로 본다(나머지는 그대로)', () => {
    expect(
      resolveWaterSunUniforms(UP, [Number.NaN, 0.5, 0.2], BASE, BASE).color,
    ).toEqual([1, 0.5, 0.2]);
    expect(
      resolveWaterSunUniforms(
        UP,
        [0.3, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
        BASE,
        BASE,
      ).color,
    ).toEqual([0.3, 1, 1]);
  });

  it('폴백 1 에도 배율이 곱해진다', () => {
    expect(
      resolveWaterSunUniforms(UP, [Number.NaN, 1, 1], BASE / 2, BASE).color[0],
    ).toBeCloseTo(0.5, 12);
  });
});

describe('resolveWaterSunUniforms — 방향', () => {
  it('정규화한다: (0,2,0) → (0,1,0), (3,4,0) → (0.6,0.8,0)', () => {
    expect(
      resolveWaterSunUniforms([0, 2, 0], WHITE, BASE, BASE).direction,
    ).toEqual([0, 1, 0]);
    const { direction } = resolveWaterSunUniforms([3, 4, 0], WHITE, BASE, BASE);
    expect(direction[0]).toBeCloseTo(0.6, 12);
    expect(direction[1]).toBeCloseTo(0.8, 12);
    expect(direction[2]).toBe(0);
  });

  it('영벡터·NaN·Infinity 방향은 천정 [0,1,0] 으로 본다', () => {
    for (const bad of [
      [0, 0, 0],
      [Number.NaN, 1, 0],
      [0, Number.POSITIVE_INFINITY, 0],
      [1, 1, Number.NEGATIVE_INFINITY],
    ] as Vector3Tuple[]) {
      const result = resolveWaterSunUniforms(bad, WHITE, BASE, BASE);
      expect(result.direction).toEqual([0, 1, 0]);
      expect(result.color).toEqual([1, 1, 1]);
    }
  });

  it('배율은 정규화 뒤 y 로 계산한다 — (0,20,0) 은 천정과 같다', () => {
    expect(
      resolveWaterSunUniforms([0, 20, 0], WHITE, BASE, BASE).color,
    ).toEqual([1, 1, 1]);
  });
});

describe('resolveWaterSunUniforms — 수평선 페이드', () => {
  it('페이드 상수는 sin 2°(≈0.0349) — 정의식이 아니라 수치로 고정', () => {
    expect(WATER_SUN_HORIZON_FADE_Y).toBeCloseTo(0.0348994967, 9);
  });

  it('경계쌍: 경계 바로 위(+0.01%) = 정확히 1, 살짝 아래(-0.1%) < 1', () => {
    // 정규화를 거치므로 경계 정확값은 마지막 자리에서 흔들린다 — 경계 바로
    // 위는 smoothstep 클램프로 정확히 1 이어야 하고, 아래는 1 미만이어야 한다.
    const aboveEdge = resolveWaterSunUniforms(
      unitWithY(WATER_SUN_HORIZON_FADE_Y * 1.0001),
      WHITE,
      BASE,
      BASE,
    );
    expect(aboveEdge.color).toEqual([1, 1, 1]);
    const below = resolveWaterSunUniforms(
      unitWithY(WATER_SUN_HORIZON_FADE_Y * 0.999),
      WHITE,
      BASE,
      BASE,
    );
    expect(below.color[0]).toBeLessThan(1);
    expect(below.color[0]).toBeGreaterThan(0.99);
    expect(
      resolveWaterSunUniforms(unitWithY(0.5), WHITE, BASE, BASE).color,
    ).toEqual([1, 1, 1]);
  });

  it('y = 페이드의 절반 → 배율 0.5(smoothstep 중간), sin 1° 도 ≈0.5', () => {
    const half = resolveWaterSunUniforms(
      unitWithY(WATER_SUN_HORIZON_FADE_Y / 2),
      WHITE,
      BASE,
      BASE,
    );
    expect(half.color[0]).toBeCloseTo(0.5, 12);
    const oneDegree = resolveWaterSunUniforms(
      unitWithY(Math.sin(Math.PI / 180)),
      WHITE,
      BASE,
      BASE,
    );
    expect(oneDegree.color[0]).toBeCloseTo(0.5, 3);
  });

  it('y = 0(수평선)·y < 0(지평선 아래) → 색 0, 방향은 그대로 정규화값', () => {
    const horizon = resolveWaterSunUniforms([1, 0, 0], WHITE, BASE, BASE);
    expect(horizon.color).toEqual([0, 0, 0]);
    expect(horizon.direction).toEqual([1, 0, 0]);
    const belowHorizon = resolveWaterSunUniforms(
      unitWithY(-0.3),
      WHITE,
      BASE * 1.6,
      BASE,
    );
    expect(belowHorizon.color).toEqual([0, 0, 0]);
    expect(belowHorizon.direction[1]).toBeCloseTo(-0.3, 12);
  });

  it('페이드와 세기 배율은 곱이다', () => {
    const { color } = resolveWaterSunUniforms(
      unitWithY(WATER_SUN_HORIZON_FADE_Y / 2),
      WHITE,
      BASE / 2,
      BASE,
    );
    expect(color[0]).toBeCloseTo(0.25, 12);
  });
});

describe('resolveWaterSunUniforms — 입력 불변', () => {
  it('입력 튜플을 바꾸지 않고 결과는 새 참조다', () => {
    const direction: Vector3Tuple = [0, 3, 0];
    const color: RgbTuple = [0.5, 0.6, 0.7];
    const result = resolveWaterSunUniforms(direction, color, BASE / 2, BASE);
    expect(direction).toEqual([0, 3, 0]);
    expect(color).toEqual([0.5, 0.6, 0.7]);
    expect(result.direction).not.toBe(direction);
    expect(result.color).not.toBe(color);
    // 이미 단위 벡터여도 새 튜플이다.
    expect(resolveWaterSunUniforms(UP, WHITE, BASE, BASE).direction).not.toBe(
      UP,
    );
  });
});
