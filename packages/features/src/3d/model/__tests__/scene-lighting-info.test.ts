import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { SCENE_LIGHTING_BASE, type RgbTuple } from '../../lib/sky-lighting';
import {
  publishSunLight,
  sceneLightingInfo,
  type SceneLightingInfo,
} from '../scene-lighting-info';

function createInfo(): SceneLightingInfo {
  return {
    skyPhase: null,
    sunElevation: 0,
    yardLights: true,
    sunDirection: [0, 1, 0],
    sunColor: [1, 1, 1],
    sunIntensity: SCENE_LIGHTING_BASE.sunIntensity,
  };
}

describe('sceneLightingInfo 기본값', () => {
  it('천정 백색 태양·기준 세기, 하늘 국면 없음', () => {
    expect(sceneLightingInfo.skyPhase).toBeNull();
    expect(sceneLightingInfo.sunElevation).toBe(0);
    expect(sceneLightingInfo.yardLights).toBe(true);
    expect(sceneLightingInfo.sunDirection).toEqual([0, 1, 0]);
    expect(sceneLightingInfo.sunColor).toEqual([1, 1, 1]);
    expect(sceneLightingInfo.sunIntensity).toBe(
      SCENE_LIGHTING_BASE.sunIntensity,
    );
  });
});

describe('publishSunLight', () => {
  it('같은 값 → false, 튜플 참조 유지', () => {
    const info = createInfo();
    const direction = info.sunDirection;
    const color = info.sunColor;
    expect(
      publishSunLight(
        info,
        new Vector3(0, 1, 0),
        [1, 1, 1],
        SCENE_LIGHTING_BASE.sunIntensity,
      ),
    ).toBe(false);
    expect(info.sunDirection).toBe(direction);
    expect(info.sunColor).toBe(color);
    expect(info.sunIntensity).toBe(SCENE_LIGHTING_BASE.sunIntensity);
  });

  it('방향 성분 하나가 다르면 true + 새 방향 튜플, 색 튜플은 그대로', () => {
    const info = createInfo();
    const direction = info.sunDirection;
    const color = info.sunColor;
    expect(
      publishSunLight(
        info,
        new Vector3(0, 1, 0.001),
        [1, 1, 1],
        SCENE_LIGHTING_BASE.sunIntensity,
      ),
    ).toBe(true);
    expect(info.sunDirection).not.toBe(direction);
    expect(info.sunDirection).toEqual([0, 1, 0.001]);
    expect(info.sunColor).toBe(color);
  });

  it('색 성분 하나가 다르면 true + 새 색 튜플, 방향 튜플은 그대로', () => {
    const info = createInfo();
    const direction = info.sunDirection;
    const color = info.sunColor;
    expect(
      publishSunLight(
        info,
        new Vector3(0, 1, 0),
        [1, 0.64, 1],
        SCENE_LIGHTING_BASE.sunIntensity,
      ),
    ).toBe(true);
    expect(info.sunColor).not.toBe(color);
    expect(info.sunColor).toEqual([1, 0.64, 1]);
    expect(info.sunDirection).toBe(direction);
  });

  it('세기만 다르면 true, 두 튜플 참조는 그대로', () => {
    const info = createInfo();
    const direction = info.sunDirection;
    const color = info.sunColor;
    expect(publishSunLight(info, new Vector3(0, 1, 0), [1, 1, 1], 0)).toBe(
      true,
    );
    expect(info.sunIntensity).toBe(0);
    expect(info.sunDirection).toBe(direction);
    expect(info.sunColor).toBe(color);
  });

  it('입력은 복사한다 — 호출자가 Vector3·튜플을 재사용해도 기록이 바뀌지 않는다', () => {
    const info = createInfo();
    const direction = new Vector3(1, 0, 0);
    const color: RgbTuple = [0.5, 0.5, 0.5];
    publishSunLight(info, direction, color, 1);
    expect(info.sunColor).not.toBe(color);
    direction.set(0, 0, 1);
    expect(info.sunDirection).toEqual([1, 0, 0]);
  });

  it('바뀐 뒤 같은 값을 다시 주면 false 이고 참조가 안정된다', () => {
    const info = createInfo();
    const direction = new Vector3(0.3, 0.9, 0.1);
    publishSunLight(info, direction, [1, 0.64, 0.38], 2);
    const storedDirection = info.sunDirection;
    const storedColor = info.sunColor;
    expect(publishSunLight(info, direction, [1, 0.64, 0.38], 2)).toBe(false);
    expect(info.sunDirection).toBe(storedDirection);
    expect(info.sunColor).toBe(storedColor);
  });

  it('NaN 은 그대로 기록된다(정화는 읽는 쪽) — 자기와 달라 재호출도 true', () => {
    const info = createInfo();
    expect(
      publishSunLight(
        info,
        new Vector3(0, Number.NaN, 0),
        [1, 1, 1],
        Number.NaN,
      ),
    ).toBe(true);
    expect(info.sunDirection[1]).toBeNaN();
    expect(info.sunIntensity).toBeNaN();
    // NaN !== NaN 이라 같은 NaN 을 다시 주면 새 튜플을 만든다 — 현재 동작.
    const stored = info.sunDirection;
    expect(
      publishSunLight(
        info,
        new Vector3(0, Number.NaN, 0),
        [1, 1, 1],
        Number.NaN,
      ),
    ).toBe(true);
    expect(info.sunDirection).not.toBe(stored);
  });

  it('다른 필드(skyPhase·sunElevation·yardLights)는 건드리지 않는다', () => {
    const info = createInfo();
    info.skyPhase = 'night';
    info.sunElevation = -20;
    info.yardLights = false;
    publishSunLight(info, new Vector3(1, 0, 0), [0, 0, 0], 0);
    expect(info.skyPhase).toBe('night');
    expect(info.sunElevation).toBe(-20);
    expect(info.yardLights).toBe(false);
  });
});
