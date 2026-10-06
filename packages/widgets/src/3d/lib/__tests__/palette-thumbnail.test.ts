import { afterEach, describe, expect, it } from 'vitest';
import { registerAssetHashManifest } from '@crane/core/lib/asset-url';
import { toPaletteThumbnailUrl } from '../palette-thumbnail';

const PATH = '/asset-library/thumbnails/map-okpo.png';
const STAMP = '2026-01-02T03:04:05.000Z';

describe('toPaletteThumbnailUrl', () => {
  afterEach(() => {
    registerAssetHashManifest({});
  });

  it('썸네일이 없으면 undefined', () => {
    expect(toPaletteThumbnailUrl(null)).toBeUndefined();
  });

  it('도장이 비어 있으면 경로 그대로(쿼리 없음)', () => {
    expect(toPaletteThumbnailUrl({ path: PATH, stamp: '' })).toBe(PATH);
  });

  it('도장을 t 쿼리로 붙이고 URL 인코딩한다', () => {
    expect(toPaletteThumbnailUrl({ path: PATH, stamp: STAMP })).toBe(
      `${PATH}?t=${encodeURIComponent(STAMP)}`,
    );
  });

  it('이미 쿼리가 있으면 & 로 잇는다', () => {
    expect(toPaletteThumbnailUrl({ path: `${PATH}?x=1`, stamp: STAMP })).toBe(
      `${PATH}?x=1&t=${encodeURIComponent(STAMP)}`,
    );
  });

  it('배포 해시(?v=)가 붙은 뒤에 도장을 잇는다', () => {
    registerAssetHashManifest({ [PATH]: 'abc123' });
    expect(toPaletteThumbnailUrl({ path: PATH, stamp: STAMP })).toBe(
      `${PATH}?v=abc123&t=${encodeURIComponent(STAMP)}`,
    );
  });

  it('같은 입력은 같은 결과(결정론)', () => {
    const thumbnail = { path: PATH, stamp: STAMP };
    expect(toPaletteThumbnailUrl(thumbnail)).toBe(
      toPaletteThumbnailUrl(thumbnail),
    );
  });
});
