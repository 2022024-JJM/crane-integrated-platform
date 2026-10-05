import { describe, expect, it } from 'vitest';
import { resolveSeaVisible } from '../scene-sea';
import type { SavedEnvironmentInfo } from '../../model/types';

const SKY: SavedEnvironmentInfo = {
  path: '/scenes/sky.exr',
  asset: { id: 'sky', version: 1 },
};

describe('resolveSeaVisible — 명시 boolean 이 우선한다', () => {
  it('sea:true 는 배경이 없어도 true', () => {
    expect(resolveSeaVisible({ sea: true })).toBe(true);
  });

  it('sea:false 는 배경이 있어도 false', () => {
    expect(resolveSeaVisible({ sea: false, environment: SKY })).toBe(false);
  });
});

describe('resolveSeaVisible — 미지정(undefined)은 레거시 규칙(배경이 있으면 바다)', () => {
  it('배경이 없으면 false', () => {
    expect(resolveSeaVisible({})).toBe(false);
  });

  it('배경이 있으면 true', () => {
    expect(resolveSeaVisible({ environment: SKY })).toBe(true);
  });

  it('자산 참조가 없는 배경(라이브러리가 모르는 파일)도 배경이다', () => {
    expect(resolveSeaVisible({ environment: { path: '/scenes/x.exr' } })).toBe(
      true,
    );
  });

  it('경로가 빈 배경은 그릴 것이 없어 false', () => {
    expect(resolveSeaVisible({ environment: { path: '' } })).toBe(false);
  });

  it('sceneInfo 가 null/undefined 면 false', () => {
    expect(resolveSeaVisible(null)).toBe(false);
    expect(resolveSeaVisible(undefined)).toBe(false);
  });
});

describe('resolveSeaVisible — boolean 이 아닌 sea 는 미지정으로 취급', () => {
  const polluted = (sea: unknown, environment?: SavedEnvironmentInfo) =>
    ({ sea, environment }) as unknown as {
      sea?: boolean;
      environment?: SavedEnvironmentInfo;
    };

  it("'yes'·1 같은 truthy 오염값은 명시로 보지 않고 레거시 규칙으로 간다", () => {
    // 배경 없음이므로 레거시 규칙은 false — truthy 값을 그대로 믿었다면 true.
    expect(resolveSeaVisible(polluted('yes'))).toBe(false);
    expect(resolveSeaVisible(polluted(1))).toBe(false);
  });

  it('0·null 같은 falsy 오염값도 명시 false 가 아니다 — 배경이 있으면 true', () => {
    expect(resolveSeaVisible(polluted(0, SKY))).toBe(true);
    expect(resolveSeaVisible(polluted(null, SKY))).toBe(true);
  });
});
