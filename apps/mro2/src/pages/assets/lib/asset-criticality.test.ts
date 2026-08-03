import { describe, expect, it } from 'vitest';
import type { CraneAsset } from '@crane/domain/asset';
import { assetCriticality } from './asset-criticality';

function asset(capacityTon: number): CraneAsset {
  return { capacityTon } as CraneAsset;
}

describe('assetCriticality', () => {
  it('300t 이상은 high', () => {
    expect(assetCriticality(asset(660))).toBe('high');
    expect(assetCriticality(asset(300))).toBe('high');
  });

  it('100t 이상 300t 미만은 moderate', () => {
    expect(assetCriticality(asset(299))).toBe('moderate');
    expect(assetCriticality(asset(100))).toBe('moderate');
  });

  it('100t 미만은 low', () => {
    expect(assetCriticality(asset(99))).toBe('low');
    expect(assetCriticality(asset(50))).toBe('low');
  });

  /* 실제 플릿 2기가 서로 다른 등급으로 갈려야 세 칩이 모두 의미를 갖는다 */
  it('실제 플릿(660t/50t)이 서로 다른 등급으로 나뉜다', () => {
    expect(assetCriticality(asset(660))).toBe('high');
    expect(assetCriticality(asset(50))).toBe('low');
  });
});
