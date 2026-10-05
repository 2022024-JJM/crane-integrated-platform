import { describe, expect, it } from 'vitest';
import {
  isSceneAssetRefEqual,
  isSceneEnvironmentEqual,
  sanitizeSceneAssetRef,
  sanitizeSceneEnvironment,
} from '../scene-asset-ref';

describe('sanitizeSceneAssetRef', () => {
  it('id 와 1 이상의 정수 버전을 가진 참조를 새 객체로 돌려준다', () => {
    const raw = { id: 'okpo-ttc', version: 2 };
    const result = sanitizeSceneAssetRef(raw);
    expect(result).toEqual({ id: 'okpo-ttc', version: 2 });
    expect(result).not.toBe(raw);
  });

  it('버전 1 은 통과, 0 은 거부(경계)', () => {
    expect(sanitizeSceneAssetRef({ id: 'a', version: 1 })).toEqual({
      id: 'a',
      version: 1,
    });
    expect(sanitizeSceneAssetRef({ id: 'a', version: 0 })).toBeUndefined();
  });

  it('딸려 온 다른 필드는 싣지 않는다', () => {
    expect(
      sanitizeSceneAssetRef({ id: 'a', version: 1, path: '/x.glb', extra: 1 }),
    ).toEqual({ id: 'a', version: 1 });
  });

  it.each([
    undefined,
    null,
    'a',
    7,
    [],
    {},
    { id: 'a' },
    { version: 1 },
    { id: '', version: 1 },
    { id: 7, version: 1 },
    { id: 'a', version: '1' },
    { id: 'a', version: 1.5 },
    { id: 'a', version: -3 },
    { id: 'a', version: Number.NaN },
    { id: 'a', version: Number.POSITIVE_INFINITY },
  ])('깨진 입력 %j 은 undefined', (raw) => {
    expect(sanitizeSceneAssetRef(raw)).toBeUndefined();
  });
});

describe('isSceneAssetRefEqual', () => {
  it('둘 다 없으면 같다', () => {
    expect(isSceneAssetRefEqual(undefined, undefined)).toBe(true);
  });

  it('한쪽만 있으면 다르다', () => {
    expect(isSceneAssetRefEqual({ id: 'a', version: 1 }, undefined)).toBe(false);
    expect(isSceneAssetRefEqual(undefined, { id: 'a', version: 1 })).toBe(false);
  });

  it('id 와 버전이 모두 같아야 같다 — 참조가 달라도 값으로 본다', () => {
    expect(
      isSceneAssetRefEqual({ id: 'a', version: 1 }, { id: 'a', version: 1 }),
    ).toBe(true);
    expect(
      isSceneAssetRefEqual({ id: 'a', version: 1 }, { id: 'a', version: 2 }),
    ).toBe(false);
    expect(
      isSceneAssetRefEqual({ id: 'a', version: 1 }, { id: 'b', version: 1 }),
    ).toBe(false);
  });
});

describe('sanitizeSceneEnvironment', () => {
  it('경로와 유효한 자산 참조를 남긴다', () => {
    expect(
      sanitizeSceneEnvironment({
        path: '/scenes/sky.exr',
        asset: { id: 'sky', version: 1 },
      }),
    ).toEqual({ path: '/scenes/sky.exr', asset: { id: 'sky', version: 1 } });
  });

  it('깨진 자산 참조는 필드째 뺀다(undefined 값을 남기지 않는다)', () => {
    const result = sanitizeSceneEnvironment({
      path: '/scenes/sky.exr',
      asset: { id: 'sky' },
    });
    expect(result).toEqual({ path: '/scenes/sky.exr' });
    expect(result).not.toHaveProperty('asset');
  });

  it.each([undefined, null, 'sky', 3, {}, { path: '' }, { path: 12 }])(
    '경로가 없는 입력 %j 은 undefined',
    (raw) => {
      expect(sanitizeSceneEnvironment(raw)).toBeUndefined();
    },
  );
});

describe('isSceneEnvironmentEqual', () => {
  const sky = { path: '/scenes/sky.exr', asset: { id: 'sky', version: 1 } };

  it('둘 다 없으면 같고 한쪽만 있으면 다르다', () => {
    expect(isSceneEnvironmentEqual(undefined, undefined)).toBe(true);
    expect(isSceneEnvironmentEqual(sky, undefined)).toBe(false);
    expect(isSceneEnvironmentEqual(undefined, sky)).toBe(false);
  });

  it('경로와 자산 참조가 같으면 같다', () => {
    expect(
      isSceneEnvironmentEqual(sky, { ...sky, asset: { ...sky.asset } }),
    ).toBe(true);
  });

  it('버전만 달라도 다르다 — 갱신이 dirty 로 잡혀야 한다', () => {
    expect(
      isSceneEnvironmentEqual(sky, {
        path: '/asset-library/files/sky/v2/sky.exr',
        asset: { id: 'sky', version: 2 },
      }),
    ).toBe(false);
    expect(
      isSceneEnvironmentEqual(sky, { ...sky, asset: { id: 'sky', version: 2 } }),
    ).toBe(false);
  });

  it('자산 참조 유무가 다르면 다르다', () => {
    expect(isSceneEnvironmentEqual(sky, { path: sky.path })).toBe(false);
  });
});
