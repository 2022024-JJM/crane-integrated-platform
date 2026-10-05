import { describe, expect, it } from 'vitest';
import {
  ASSET_VERSION_STATUSES,
  type AssetRecord,
} from '@crane/domain/asset-library';
import {
  ASSET_STATUS_TONE,
  formatAssetDate,
  formatAssetDateTime,
  listCategorySuggestions,
  parseCategoryInput,
  resolveThumbnailSource,
  shortenContentHash,
  withCacheStamp,
  formatRelativeTime,
} from '../asset-presentation';

function asset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id: 'a',
    kind: 'model',
    name: 'A',
    description: '',
    categories: [],
    owner: '',
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

describe('resolveThumbnailSource', () => {
  it('저장된 썸네일이 가장 먼저다', () => {
    const ref = { storage: 'public' as const, path: '/asset-library/thumbnails/a.png' };
    expect(
      resolveThumbnailSource(asset({ thumbnail: { ref, updatedAt: 't1' } })),
    ).toEqual({ kind: 'file', ref, stamp: 't1' });
  });

  it('저장된 썸네일이 없는 모델·지도는 없음이다 — 다른 곳에서 그림을 찾지 않는다', () => {
    expect(resolveThumbnailSource(asset())).toEqual({ kind: 'none' });
    expect(resolveThumbnailSource(asset({ kind: 'map' }))).toEqual({
      kind: 'none',
    });
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

describe('parseCategoryInput', () => {
  it('쉼표·줄바꿈으로 나누고 빈 조각을 버린다', () => {
    expect(parseCategoryInput(' crane, , ship\nyard ,')).toEqual([
      'crane',
      'ship',
      'yard',
    ]);
    expect(parseCategoryInput('  ')).toEqual([]);
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

describe('listCategorySuggestions', () => {
  it('이미 붙은 카테고리를 빼고 순서를 지킨다', () => {
    expect(
      listCategorySuggestions(['crane', 'indoor', 'bay', 'okpo'], ['indoor']),
    ).toEqual(['crane', 'bay', 'okpo']);
  });

  it('대소문자만 다른 것은 이미 붙은 것으로 본다', () => {
    expect(listCategorySuggestions(['Crane', 'bay'], ['crane'])).toEqual(['bay']);
    expect(listCategorySuggestions(['crane'], ['CRANE'])).toEqual([]);
  });

  it('권할 목록 안의 중복은 먼저 나온 것 하나만 남긴다', () => {
    expect(listCategorySuggestions(['crane', 'Crane', 'bay'], [])).toEqual([
      'crane',
      'bay',
    ]);
  });

  it('빈 목록·전부 붙은 경우는 빈 배열', () => {
    expect(listCategorySuggestions([], ['a'])).toEqual([]);
    expect(listCategorySuggestions(['a', 'b'], ['b', 'a'])).toEqual([]);
    expect(listCategorySuggestions([], [])).toEqual([]);
  });

  it('입력 배열을 바꾸지 않는다', () => {
    const suggestions = ['crane', 'bay'];
    const current = ['crane'];
    listCategorySuggestions(suggestions, current);
    expect(suggestions).toEqual(['crane', 'bay']);
    expect(current).toEqual(['crane']);
  });
});

describe('listCategorySuggestions — 치는 글자로 거르기', () => {
  const categories = ['crane', 'indoor', 'outdoor', 'Okpo', '크레인', '옥포 크레인'];

  it('그 글자가 들어간 카테고리만 남기고 순서를 지킨다', () => {
    expect(listCategorySuggestions(categories, [], 'door')).toEqual(['indoor', 'outdoor']);
    expect(listCategorySuggestions(categories, [], 'c')).toEqual(['crane']);
  });

  it('대소문자를 가리지 않는다', () => {
    expect(listCategorySuggestions(categories, [], 'OKPO')).toEqual(['Okpo']);
    expect(listCategorySuggestions(categories, [], 'Crane')).toEqual(['crane']);
  });

  it('한글도 들어간 글자로 거른다', () => {
    expect(listCategorySuggestions(categories, [], '크레')).toEqual([
      '크레인',
      '옥포 크레인',
    ]);
    // 조합 중인 낱자(초성만)는 완성된 글자와 맞지 않는다 — 다 치면 맞는다.
    expect(listCategorySuggestions(categories, [], 'ㅋ')).toEqual([]);
  });

  it('빈 글자·공백뿐인 글자는 거르지 않고, 앞뒤 공백은 없는 것으로 본다', () => {
    expect(listCategorySuggestions(categories, [], '')).toEqual(categories);
    expect(listCategorySuggestions(categories, [], '   ')).toEqual(categories);
    expect(listCategorySuggestions(categories, [], '  door ')).toEqual([
      'indoor',
      'outdoor',
    ]);
    // 가운데 공백은 글자다.
    expect(listCategorySuggestions(categories, [], '옥포 크')).toEqual(['옥포 크레인']);
  });

  it('맞는 것이 없으면 빈 배열', () => {
    expect(listCategorySuggestions(categories, [], 'zzz')).toEqual([]);
    expect(listCategorySuggestions([], [], 'a')).toEqual([]);
  });

  it('이미 붙은 카테고리는 글자가 맞아도 권하지 않는다', () => {
    expect(listCategorySuggestions(categories, ['INDOOR'], 'door')).toEqual(['outdoor']);
  });

  it('정규식 글자는 그대로 글자로 본다', () => {
    expect(listCategorySuggestions(['a.b', 'axb', 'c(1)'], [], '.')).toEqual(['a.b']);
    expect(listCategorySuggestions(['a.b', 'axb', 'c(1)'], [], '(')).toEqual([
      'c(1)',
    ]);
  });
});
