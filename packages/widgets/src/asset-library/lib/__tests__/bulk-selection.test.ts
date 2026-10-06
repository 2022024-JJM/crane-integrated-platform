import { describe, expect, it } from 'vitest';
import {
  buildAssetUsageIndex,
  type AssetRecord,
  type AssetUsageSource,
  type AssetUsageState,
  type AssetVersionStatus,
} from '@crane/domain/asset-library';
import {
  countBulkRemovable,
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

describe('countBulkRemovable', () => {
  const source = (
    kind: AssetUsageSource['kind'],
    refs: AssetUsageSource['refs'],
  ): AssetUsageSource => ({
    kind,
    name: kind === 'scene' ? 'okpo.json' : 'crane-type-model',
    regionIds: [],
    editorPath: '',
    refs,
  });
  const usage = (
    sources: AssetUsageSource[] = [],
    known = true,
  ): AssetUsageState => ({ index: buildAssetUsageIndex(sources), known });
  const drawing = (id: string): AssetRecord => ({
    ...asset(id, 'published'),
    kind: 'drawing',
  });

  it('아무것도 고르지 않았으면 둘 다 0', () => {
    expect(countBulkRemovable([], usage())).toEqual({ removable: 0, blocked: 0 });
  });

  it('어디에서도 쓰이지 않으면 전부 지울 수 있다 — 상태와 무관하다', () => {
    expect(
      countBulkRemovable(
        [asset('a', 'published'), asset('b', 'draft'), asset('c', 'withdrawn')],
        usage(),
      ),
    ).toEqual({ removable: 3, blocked: 0 });
  });

  it('씬에 놓인 자산은 막힌다 — 참조로 잡히든 경로로 잡히든', () => {
    const scene = source('scene', [
      { path: '/models/a.glb', asset: { id: 'a', version: 1 } },
      { path: '/models/b.glb' },
    ]);
    expect(
      countBulkRemovable(
        [asset('a', 'published'), asset('b', 'published'), asset('c', 'published')],
        usage([scene]),
      ),
    ).toEqual({ removable: 1, blocked: 2 });
  });

  it('화면 코드가 직접 로드하는 자산도 막힌다', () => {
    const code = source('code', [
      { path: '/models/a.glb', asset: { id: 'a', version: 1 } },
    ]);
    expect(
      countBulkRemovable([asset('a', 'published')], usage([code])),
    ).toEqual({ removable: 0, blocked: 1 });
  });

  it('고른 것이 전부 쓰이면 지울 수 있는 것이 0 이다', () => {
    const scene = source('scene', [
      { path: '/models/a.glb', asset: { id: 'a', version: 1 } },
      { path: '/models/b.glb', asset: { id: 'b', version: 1 } },
    ]);
    expect(
      countBulkRemovable(
        [asset('a', 'published'), asset('b', 'published')],
        usage([scene]),
      ),
    ).toEqual({ removable: 0, blocked: 2 });
  });

  it('사용처를 다 읽지 못했으면 씬에 쓰는 종류는 전부 막힌다', () => {
    expect(
      countBulkRemovable(
        [asset('a', 'published'), asset('b', 'draft')],
        usage([], false),
      ),
    ).toEqual({ removable: 0, blocked: 2 });
  });

  it('씬에 쓰지 않는 종류(도면)는 사용처를 못 읽어도 지울 수 있다', () => {
    expect(
      countBulkRemovable(
        [asset('a', 'published'), drawing('plan')],
        usage([], false),
      ),
    ).toEqual({ removable: 1, blocked: 1 });
  });

  it('입력을 바꾸지 않는다', () => {
    const selected = [asset('a', 'published')];
    const before = JSON.stringify(selected);
    countBulkRemovable(selected, usage());
    expect(JSON.stringify(selected)).toBe(before);
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
