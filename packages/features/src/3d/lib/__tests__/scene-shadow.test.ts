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
  it("켜면 'soft'(PCFSoftShadowMap), 끄면 false", () => {
    expect(sceneCanvasShadows({ shadows: true })).toBe('soft');
    expect(sceneCanvasShadows({ shadows: false })).toBe(false);
    expect(sceneCanvasShadows(null)).toBe(false);
    expect(sceneCanvasShadows(undefined)).toBe(false);
  });
});
