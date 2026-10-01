import { afterEach, describe, expect, it } from 'vitest';
import { registerAssetHashManifest } from '@crane/core/lib/asset-url';
import {
  ASSET_VERSION_STATUSES,
  type AssetRecord,
} from '@crane/domain/asset-library';
import {
  ASSET_STATUS_TONE,
  formatAssetDate,
  formatAssetDateTime,
  parseTagInput,
  resolveThumbnailSource,
  shortenContentHash,
  withCacheStamp,
  formatRelativeTime,
} from '../asset-presentation';

function asset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id: 'a',
    kind: 'model',
    origin: 'builtin',
    name: 'A',
    description: '',
    category: '',
    sites: [],
    tags: [],
    owner: '',
    defaultScale: [1, 1, 1],
    relatedAssetIds: [],
    versions: [
      {
        version: 1,
        status: 'published',
        file: {
          ref: { storage: 'public', path: '/models/a.glb' },
          fileName: 'a.glb',
          format: 'glb',
          sizeBytes: null,
          contentHash: null,
        },
        note: '',
        createdAt: '',
        createdBy: '',
      },
    ],
    currentVersion: 1,
    createdAt: '',
    updatedAt: '',
    history: [],
    ...overrides,
  };
}

afterEach(() => registerAssetHashManifest({}));

describe('resolveThumbnailSource', () => {
  it('저장된 썸네일이 가장 먼저다', () => {
    registerAssetHashManifest({ '/previews/a.png': 'h' });
    const ref = { storage: 'public' as const, path: '/asset-library/thumbnails/a.png' };
    expect(
      resolveThumbnailSource(
        asset({ catalogId: 'a', thumbnail: { ref, updatedAt: 't1' } }),
      ),
    ).toEqual({ kind: 'file', ref, stamp: 't1' });
  });

  it('정적 썸네일은 배포돼 있을 때만(매니페스트에 있을 때만) 쓴다', () => {
    const model = asset({ catalogId: 'a' });
    expect(resolveThumbnailSource(model)).toEqual({ kind: 'none' });
    registerAssetHashManifest({ '/previews/a.png': 'h' });
    expect(resolveThumbnailSource(model)).toEqual({
      kind: 'static',
      path: '/previews/a.png',
    });
  });

  it('지도와 카탈로그 id 없는 모델은 정적 썸네일을 찾지 않는다', () => {
    registerAssetHashManifest({ '/previews/a.png': 'h' });
    expect(resolveThumbnailSource(asset({ kind: 'map', catalogId: 'a' }))).toEqual({
      kind: 'none',
    });
    expect(resolveThumbnailSource(asset())).toEqual({ kind: 'none' });
  });

  it('그림 도면은 파일 자체, 그림이 아닌 도면은 없음', () => {
    const drawing = (format: string) =>
      asset({
        kind: 'drawing',
        versions: [
          {
            ...asset().versions[0],
            file: {
              ...asset().versions[0].file,
              ref: { storage: 'public', path: `/drawings/a.${format}` },
              format,
            },
          },
        ],
      });
    expect(resolveThumbnailSource(drawing('webp'))).toEqual({
      kind: 'image',
      ref: { storage: 'public', path: '/drawings/a.webp' },
    });
    expect(resolveThumbnailSource(drawing('pdf'))).toEqual({ kind: 'none' });
    expect(resolveThumbnailSource(drawing('dwg'))).toEqual({ kind: 'none' });
  });
});

describe('withCacheStamp', () => {
  it('쿼리 유무에 맞춰 붙이고 프래그먼트는 뒤에 둔다', () => {
    expect(withCacheStamp('/a.png', 't 1')).toBe('/a.png?t=t%201');
    expect(withCacheStamp('/a.png?v=9', 'x')).toBe('/a.png?v=9&t=x');
    expect(withCacheStamp('/a.png#f', 'x')).toBe('/a.png?t=x#f');
  });

  it('도장이 없거나 blob·data URL 이면 그대로', () => {
    expect(withCacheStamp('/a.png', '')).toBe('/a.png');
    expect(withCacheStamp('blob:abc', 'x')).toBe('blob:abc');
    expect(withCacheStamp('data:image/png;base64,AA', 'x')).toBe(
      'data:image/png;base64,AA',
    );
  });
});

describe('ASSET_STATUS_TONE', () => {
  it('모든 상태에 색이 있다', () => {
    for (const status of ASSET_VERSION_STATUSES) {
      expect(ASSET_STATUS_TONE[status].dot).not.toBe('');
      expect(ASSET_STATUS_TONE[status].badge).not.toBe('');
    }
  });
});

describe('formatAssetDate / formatAssetDateTime', () => {
  it('시각을 모르거나 해석되지 않으면 —', () => {
    for (const iso of ['', 'yesterday']) {
      expect(formatAssetDate(iso, 'ko-KR')).toBe('—');
      expect(formatAssetDateTime(iso, 'ko-KR')).toBe('—');
    }
  });

  it('로케일에 맞춰 적는다', () => {
    // 정오(UTC)라 테스트 장비의 시간대가 어디든 같은 날짜다.
    expect(formatAssetDate('2026-03-05T12:00:00.000Z', 'en-US')).toBe('03/05/2026');
    expect(formatAssetDateTime('2026-03-05T12:00:00.000Z', 'en-US')).toContain(
      '03/05/2026',
    );
  });
});

describe('shortenContentHash', () => {
  it('알고리즘 접두어를 살리고 앞 12자만 보인다', () => {
    expect(shortenContentHash('sha256:0123456789abcdef0123')).toBe(
      'sha256:0123456789ab…',
    );
    expect(shortenContentHash('0123456789abcdef')).toBe('0123456789ab…');
    expect(shortenContentHash(null)).toBe('—');
  });
});

describe('parseTagInput', () => {
  it('쉼표·줄바꿈으로 나누고 빈 조각을 버린다', () => {
    expect(parseTagInput(' crane, , ship\nyard ,')).toEqual([
      'crane',
      'ship',
      'yard',
    ]);
    expect(parseTagInput('  ')).toEqual([]);
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-10-01T12:00:00.000Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const rel = (ms: number) => formatRelativeTime(ago(ms), now, 'ko');

  it('1분 안쪽과 미래 시각은 "지금"', () => {
    expect(rel(0)).toBe('지금');
    expect(rel(59_999)).toBe('지금');
    expect(rel(-5 * DAY)).toBe('지금');
  });

  it('단위 경계 — 정확값에서 다음 단위로 넘어간다', () => {
    expect(rel(MIN)).toBe('1분 전');
    expect(rel(HOUR - 1)).toBe('59분 전');
    expect(rel(HOUR)).toBe('1시간 전');
    expect(rel(DAY - 1)).toBe('23시간 전');
    expect(rel(DAY)).toBe('1일 전');
    expect(rel(30 * DAY - 1)).toBe('29일 전');
    expect(rel(30 * DAY)).toBe('1개월 전');
    expect(rel(365 * DAY - 1)).toBe('12개월 전');
    expect(rel(365 * DAY)).toBe('1년 전');
    expect(rel(800 * DAY)).toBe('2년 전');
  });

  it('언어를 따른다', () => {
    expect(formatRelativeTime(ago(3 * DAY), now, 'en')).toBe('3 days ago');
  });

  it('시각을 모르거나 읽을 수 없으면 —', () => {
    expect(formatRelativeTime('', now, 'ko')).toBe('—');
    expect(formatRelativeTime('not-a-date', now, 'ko')).toBe('—');
  });
});
