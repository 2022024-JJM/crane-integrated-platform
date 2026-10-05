import { describe, expect, it } from 'vitest';
import type { AssetRecord, AssetVersionStatus } from '@crane/domain/asset-library';
import {
  listBulkCategories,
  listBulkTransitions,
  withoutCategory,
  withCategory,
} from '../bulk-selection';

const asset = (
  id: string,
  status: AssetVersionStatus,
  categories: string[] = [],
): AssetRecord => ({
  id,
  kind: 'model',
  name: id,
  description: '',
  categories,
  owner: '',
  relatedAssetIds: [],
  versions: [
    {
      version: 1,
      status,
      file: {
        ref: { storage: 'public', path: `/models/${id}.glb` },
        fileName: `${id}.glb`,
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
});

describe('listBulkTransitions', () => {
  it('고른 자산의 현재 버전에 걸리는 전환과 그 수를 낸다', () => {
    expect(
      listBulkTransitions([
        asset('a', 'draft'),
        asset('b', 'draft'),
        asset('c', 'in-review'),
        asset('d', 'published'),
      ]),
    ).toEqual([
      { to: 'in-review', count: 2 },
      { to: 'approved', count: 1 },
      { to: 'rejected', count: 1 },
      { to: 'withdrawn', count: 1 },
    ]);
  });

  it('아무것도 고르지 않았으면 빈 목록', () => {
    expect(listBulkTransitions([])).toEqual([]);
  });
});

describe('listBulkCategories', () => {
  it('많이 쓰인 순, 대소문자를 가리지 않고 묶는다', () => {
    expect(
      listBulkCategories([
        asset('a', 'draft', ['Crane', 'yard']),
        asset('b', 'draft', ['crane']),
        asset('c', 'draft', ['dock']),
      ]),
    ).toEqual(['Crane', 'dock', 'yard']);
  });

  it('카테고리가 없으면 빈 목록', () => {
    expect(listBulkCategories([asset('a', 'draft')])).toEqual([]);
  });
});

describe('withCategory / withoutCategory', () => {
  it('없는 카테고리만 더하고, 있는 카테고리만 뺀다(대소문자 무시)', () => {
    expect(withCategory(['a'], 'b')).toEqual(['a', 'b']);
    expect(withCategory(['Crane'], 'crane')).toBeNull();
    expect(withoutCategory(['Crane', 'b'], 'crane')).toEqual(['b']);
    expect(withoutCategory(['a'], 'zzz')).toBeNull();
    expect(withoutCategory([], 'a')).toBeNull();
  });
});
