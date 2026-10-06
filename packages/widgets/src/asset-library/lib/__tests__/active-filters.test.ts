import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ASSET_QUERY,
  type AssetCollection,
  type AssetQuery,
} from '@crane/domain/asset-library';
import {
  activeFilterKey,
  listActiveFilters,
  removeActiveFilter,
} from '../active-filters';

const collections: AssetCollection[] = [
  { id: 'yard', name: '야드 장비', assetIds: [] },
];

const full: AssetQuery = {
  ...DEFAULT_ASSET_QUERY,
  text: '  crane ',
  kinds: ['model', 'map'],
  statuses: ['draft'],
  categories: ['a', 'b'],
  collectionId: 'yard',
  favoritesOnly: true,
  attention: 'review',
};

describe('listActiveFilters', () => {
  it('기본 탐색 상태에는 칩이 없다(정렬은 필터가 아니다)', () => {
    expect(listActiveFilters(DEFAULT_ASSET_QUERY, collections)).toEqual([]);
    expect(
      listActiveFilters(
        { ...DEFAULT_ASSET_QUERY, sort: 'size', reverse: true },
        collections,
      ),
    ).toEqual([]);
  });

  it('걸린 필터를 하나씩 늘어놓는다', () => {
    const filters = listActiveFilters(full, collections);
    expect(filters.map(activeFilterKey)).toEqual([
      'text:crane',
      'attention:review',
      'kind:model',
      'kind:map',
      'status:draft',
      'category:a',
      'category:b',
      'collection:yard',
      'favorites',
    ]);
  });

  it('계층의 위치(종류 하나)는 칩이 아니다', () => {
    expect(
      listActiveFilters(
        { ...DEFAULT_ASSET_QUERY, kinds: ['model'] },
        collections,
      ),
    ).toEqual([]);
  });

  it('계층에서 체크한 카테고리는 칩이다 — 위치가 아니라 필터다', () => {
    const query: AssetQuery = {
      ...DEFAULT_ASSET_QUERY,
      kinds: ['model'],
      categories: ['indoor', 'crane'],
    };
    const filters = listActiveFilters(query, collections);
    expect(filters).toEqual([
      { type: 'category', value: 'indoor' },
      { type: 'category', value: 'crane' },
    ]);
    // 칩을 풀면 종류는 그대로고 그 카테고리만 빠진다.
    expect(removeActiveFilter(query, filters[0])).toEqual({
      ...query,
      categories: ['crane'],
    });
  });

  it('공백뿐인 검색어는 칩이 아니다', () => {
    expect(
      listActiveFilters({ ...DEFAULT_ASSET_QUERY, text: '   ' }, collections),
    ).toEqual([]);
  });

  it('컬렉션 이름을 싣고, 지워진 컬렉션은 id 로 대신한다', () => {
    expect(listActiveFilters(full, collections)).toContainEqual({
      type: 'collection',
      value: 'yard',
      name: '야드 장비',
    });
    expect(listActiveFilters(full, [])).toContainEqual({
      type: 'collection',
      value: 'yard',
      name: 'yard',
    });
  });
});

describe('removeActiveFilter', () => {
  it('칩을 전부 풀면 기본 상태다', () => {
    const cleared = listActiveFilters(full, collections).reduce(
      removeActiveFilter,
      full,
    );
    expect(cleared).toEqual(DEFAULT_ASSET_QUERY);
  });

  it('종류 하나에 있을 때 칩을 전부 풀면 그 위치만 남는다', () => {
    const scoped: AssetQuery = { ...full, kinds: ['map'] };
    const cleared = listActiveFilters(scoped, collections).reduce(
      removeActiveFilter,
      scoped,
    );
    expect(cleared).toEqual({ ...DEFAULT_ASSET_QUERY, kinds: ['map'] });
  });

  it('목록형 필터는 그 값 하나만 뺀다', () => {
    expect(
      removeActiveFilter(full, { type: 'kind', value: 'model' }).kinds,
    ).toEqual(['map']);
    expect(removeActiveFilter(full, { type: 'category', value: 'b' }).categories).toEqual([
      'a',
    ]);
  });

  it('걸려 있지 않은 값을 풀어도 내용은 그대로다', () => {
    expect(removeActiveFilter(full, { type: 'category', value: 'zzz' })).toEqual(
      full,
    );
  });
});
