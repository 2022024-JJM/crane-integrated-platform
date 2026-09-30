import { describe, expect, it } from 'vitest';
import {
  isSceneShadowEnabled,
  resolveShadowFocus,
  resolveShadowFocusForPose,
  sceneCanvasShadows,
  unionShadowFocus,
} from '../scene-shadow';

describe('isSceneShadowEnabled', () => {
  it('shadows === true일 때만 켠다', () => {
    expect(isSceneShadowEnabled({ shadows: true })).toBe(true);
  });

  it('false/필드 없음/null/undefined는 전부 꺼짐 (기존 저장본 하위호환)', () => {
    expect(isSceneShadowEnabled({ shadows: false })).toBe(false);
    expect(isSceneShadowEnabled({})).toBe(false);
    expect(isSceneShadowEnabled(null)).toBe(false);
    expect(isSceneShadowEnabled(undefined)).toBe(false);
  });

  it('boolean이 아닌 값은 켜지 않는다', () => {
    expect(
      isSceneShadowEnabled({ shadows: 1 as unknown as boolean }),
    ).toBe(false);
  });
});

describe('sceneCanvasShadows', () => {
  it("켜면 'percentage'(PCFShadowMap), 끄면 false", () => {
    // 'soft'(PCFSoftShadowMap)는 r183 에서 타입이 뒤바뀌며 셰이더가 BASIC
    // 변형으로 컴파일될 수 있어 쓰지 않는다(scene-shadow.ts 주석).
    expect(sceneCanvasShadows({ shadows: true })).toBe('percentage');
    expect(sceneCanvasShadows({ shadows: false })).toBe(false);
    expect(sceneCanvasShadows(null)).toBe(false);
    expect(sceneCanvasShadows(undefined)).toBe(false);
  });
});

describe('resolveShadowFocus', () => {
  it('아래를 보는 시선은 지면(y=0) 교점이 초점이고 시거리는 교점까지 거리다', () => {
    const focus = resolveShadowFocus([0, 100, 0], [0, -1, 0]);
    expect(focus).toEqual({ x: 0, z: 0, viewDist: 100 });
    const oblique = resolveShadowFocus([0, 100, 0], [0.6, -0.8, 0]);
    expect(oblique.x).toBeCloseTo(75);
    expect(oblique.z).toBeCloseTo(0);
    expect(oblique.viewDist).toBeCloseTo(125);
  });

  it('수평·상향 시선은 카메라 바로 아래가 초점이고 시거리는 높이 + 여유', () => {
    expect(resolveShadowFocus([5, 100, 7], [1, 0, 0])).toEqual({
      x: 5,
      z: 7,
      viewDist: 150,
    });
    expect(resolveShadowFocus([5, 100, 7], [0, 1, 0]).viewDist).toBe(150);
  });

  it('지면 아래 카메라가 아래를 보면(t<0) 카메라 아래로 폴백', () => {
    const focus = resolveShadowFocus([1, -10, 2], [0, -1, 0]);
    expect(focus).toEqual({ x: 1, z: 2, viewDist: 60 });
  });
});

describe('resolveShadowFocusForPose', () => {
  it('position → target 방향으로 초점을 구한다', () => {
    const focus = resolveShadowFocusForPose([0, 100, 0], [75, 0, 0]);
    expect(focus.x).toBeCloseTo(75);
    expect(focus.viewDist).toBeCloseTo(125);
  });

  it('거리 0 이나 비유한은 아래를 본다', () => {
    expect(resolveShadowFocusForPose([3, 50, 4], [3, 50, 4])).toEqual({
      x: 3,
      z: 4,
      viewDist: 50,
    });
    expect(
      resolveShadowFocusForPose([3, 50, 4], [Number.NaN, 0, 0]).viewDist,
    ).toBe(50);
  });
});

describe('unionShadowFocus', () => {
  it('빈 목록은 null, 하나면 그대로', () => {
    expect(unionShadowFocus([])).toBeNull();
    expect(unionShadowFocus([{ x: 1, z: 2, viewDist: 30 }])).toEqual({
      x: 1,
      z: 2,
      viewDist: 30,
    });
  });

  it('여럿이면 바운딩 박스 중심 + 가장 먼 초점의 거리에 그 시거리를 더한다', () => {
    const union = unionShadowFocus([
      { x: 0, z: 0, viewDist: 100 },
      { x: 1000, z: 0, viewDist: 50 },
    ])!;
    expect(union.x).toBe(500);
    expect(union.z).toBe(0);
    // 왼쪽 초점: 500 + 100 = 600, 오른쪽: 500 + 50 = 550 → 600.
    expect(union.viewDist).toBe(600);
  });
});
