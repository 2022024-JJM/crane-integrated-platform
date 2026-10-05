import { describe, expect, it } from 'vitest';
import { resolveEnvironmentFileUrl } from '../scene-environment';

describe('resolveEnvironmentFileUrl', () => {
  it('배경이 없으면 null', () => {
    expect(resolveEnvironmentFileUrl(undefined)).toBeNull();
    expect(resolveEnvironmentFileUrl(null)).toBeNull();
  });

  it('경로가 비어 있으면 null — 404 를 로더까지 끌고 가지 않는다', () => {
    expect(resolveEnvironmentFileUrl({ path: '' })).toBeNull();
  });

  it('public 절대 경로를 돌려준다', () => {
    expect(resolveEnvironmentFileUrl({ path: '/scenes/sky.exr' })).toBe(
      '/scenes/sky.exr',
    );
  });

  it('선행 슬래시가 빠진 경로도 절대 경로로 맞춘다', () => {
    expect(resolveEnvironmentFileUrl({ path: 'scenes/sky.exr' })).toBe(
      '/scenes/sky.exr',
    );
  });

  it('자산 참조는 URL 에 영향을 주지 않는다', () => {
    expect(
      resolveEnvironmentFileUrl({
        path: '/asset-library/files/sky/v2/sky.exr',
        asset: { id: 'sky', version: 2 },
      }),
    ).toBe('/asset-library/files/sky/v2/sky.exr');
  });
});
