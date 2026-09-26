import { describe, expect, it } from 'vitest';
import { isSceneShadowEnabled, sceneCanvasShadows } from '../scene-shadow';

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
