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
  site: 'philly',
  kinds: ['model', 'map'],
  statuses: ['draft'],
  tags: ['a', 'b'],
  collectionId: 'yard',
  favoritesOnly: true,
  attention: 'review',
};

describe('listActiveFilters', () => {
  it('기본 탐색 상태에는 칩이 없다(조선소·정렬은 필터가 아니다)', () => {
    expect(listActiveFilters(DEFAULT_ASSET_QUERY, collections)).toEqual([]);
    expect(
      listActiveFilters(
        { ...DEFAULT_ASSET_QUERY, site: 'okpo', sort: 'size' },
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
      'tag:a',
      'tag:b',
      'collection:yard',
      'favorites',
    ]);
  });

  it('계층의 위치(종류 하나 › 분류)는 칩이 아니다', () => {
    expect(
      listActiveFilters(
        { ...DEFAULT_ASSET_QUERY, kinds: ['model'], category: 'indoor' },
        collections,
      ),
    ).toEqual([]);
  });

  it('계층으로 나타낼 수 없는 분류(종류 없이)는 칩으로 낸다', () => {
    const query = { ...DEFAULT_ASSET_QUERY, category: 'indoor' };
    const filters = listActiveFilters(query, collections);
    expect(filters).toEqual([{ type: 'category', value: 'indoor' }]);
    expect(removeActiveFilter(query, filters[0])).toEqual(DEFAULT_ASSET_QUERY);
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
  it('칩을 전부 풀면 조선소만 남은 기본 상태다', () => {
    const cleared = listActiveFilters(full, collections).reduce(
      removeActiveFilter,
      full,
    );
    expect(cleared).toEqual({ ...DEFAULT_ASSET_QUERY, site: 'philly' });
  });

  it('목록형 필터는 그 값 하나만 뺀다', () => {
    expect(
      removeActiveFilter(full, { type: 'kind', value: 'model' }).kinds,
    ).toEqual(['map']);
    expect(removeActiveFilter(full, { type: 'tag', value: 'b' }).tags).toEqual([
      'a',
    ]);
  });

  it('걸려 있지 않은 값을 풀어도 내용은 그대로다', () => {
    expect(removeActiveFilter(full, { type: 'tag', value: 'zzz' })).toEqual(
      full,
    );
  });
});
