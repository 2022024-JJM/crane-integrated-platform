import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSET_QUERY, type AssetQuery } from '@crane/domain/asset-library';
import {
  listDetailTabs,
  parseAssetQuery,
  parseDetailTab,
  parseVersionParam,
  resolveDetailTab,
  writeAssetQuery,
} from '../asset-library-url';

const parse = (search: string) => parseAssetQuery(new URLSearchParams(search));

describe('parseAssetQuery', () => {
  it('빈 쿼리스트링은 기본값이다', () => {
    expect(parse('')).toEqual(DEFAULT_ASSET_QUERY);
  });

  it('필드를 읽는다', () => {
    expect(
      parse(
        'q=crane&kind=model,map&status=draft&category=a,b&collection=yard&fav=1&attn=review&sort=size',
      ),
    ).toEqual({
      attention: 'review',
      text: 'crane',
      kinds: ['model', 'map'],
      statuses: ['draft'],
      categories: ['a', 'b'],
      collectionId: 'yard',
      favoritesOnly: true,
      sort: 'size',
      reverse: false,
    });
  });

  it('모르는 값은 버리고 기본값으로 읽는다', () => {
    expect(
      parse(
        'kind=texture,model&status=done&sort=random&fav=yes&attn=panic',
      ),
    ).toEqual({ ...DEFAULT_ASSET_QUERY, kinds: ['model'] });
  });

  it('목록은 고른 순서와 무관하게 표의 순서로 정규화한다', () => {
    expect(parse('kind=drawing,model').kinds).toEqual(['model', 'drawing']);
    expect(parse('status=published,draft').statuses).toEqual(['draft', 'published']);
  });

  it('빈 카테고리 조각은 버린다', () => {
    expect(parse('category=,a,,b,').categories).toEqual(['a', 'b']);
    expect(parse('category=').categories).toEqual([]);
  });
});

describe('writeAssetQuery', () => {
  const full: AssetQuery = {
    text: ' crane ',
    kinds: ['model'],
    statuses: ['draft', 'published'],
    categories: ['indoor', 'crane 10'],
    collectionId: 'yard',
    favoritesOnly: true,
    attention: 'over-budget',
    sort: 'updated',
    reverse: true,
  };

  it('기본값은 URL 에 쓰지 않는다', () => {
    expect(
      writeAssetQuery(new URLSearchParams(), DEFAULT_ASSET_QUERY).toString(),
    ).toBe('');
  });

  it('쓴 것을 다시 읽으면 같은 상태다(검색어는 다듬어진다)', () => {
    const params = writeAssetQuery(new URLSearchParams(), full);
    expect(parseAssetQuery(params)).toEqual({ ...full, text: 'crane' });
  });

  it('기본값으로 돌아가면 그 키를 지우고, 모르는 파라미터는 건드리지 않는다', () => {
    const start = writeAssetQuery(new URLSearchParams('other=1'), full);
    const cleared = writeAssetQuery(start, DEFAULT_ASSET_QUERY);
    expect(cleared.toString()).toBe('other=1');
  });

  it('입력 파라미터 객체를 바꾸지 않는다', () => {
    const current = new URLSearchParams('q=old');
    writeAssetQuery(current, full);
    expect(current.toString()).toBe('q=old');
  });
});

describe('없어진 필터(조선소 site · 분류 cat)의 옛 링크', () => {
  it('읽을 때 그 조건 없이 연다 — 나머지 필터는 그대로 읽는다', () => {
    expect(parse('site=okpo&cat=indoor')).toEqual(DEFAULT_ASSET_QUERY);
    expect(parse('site=common&cat=crane&kind=model&category=indoor')).toEqual({
      ...DEFAULT_ASSET_QUERY,
      kinds: ['model'],
      categories: ['indoor'],
    });
    expect(parse('site=okpo')).not.toHaveProperty('site');
    expect(parse('cat=indoor')).not.toHaveProperty('category');
  });

  it('쓸 때 주소에서 지운다 — 다른 모르는 파라미터는 남긴다', () => {
    const next = writeAssetQuery(
      new URLSearchParams('site=okpo&cat=indoor&other=1&preview=a'),
      { ...DEFAULT_ASSET_QUERY, kinds: ['model'] },
    );
    expect(next.get('site')).toBeNull();
    expect(next.get('cat')).toBeNull();
    expect(next.get('other')).toBe('1');
    expect(next.get('preview')).toBe('a');
    expect(next.get('kind')).toBe('model');
  });
});

describe('카테고리(category)', () => {
  it('쉼표로 이어 쓰고 다시 읽으면 같은 순서다', () => {
    const params = writeAssetQuery(new URLSearchParams(), {
      ...DEFAULT_ASSET_QUERY,
      kinds: ['model'],
      categories: ['indoor', 'crane'],
    });
    expect(params.get('category')).toBe('indoor,crane');
    expect(parseAssetQuery(params).categories).toEqual(['indoor', 'crane']);
  });

  it('카테고리가 없으면 파라미터를 쓰지 않는다', () => {
    expect(
      writeAssetQuery(new URLSearchParams('category=a'), DEFAULT_ASSET_QUERY).has(
        'category',
      ),
    ).toBe(false);
  });
});

describe('parseDetailTab / parseVersionParam', () => {
  it('모르는 탭은 info', () => {
    expect(parseDetailTab('versions')).toBe('versions');
    expect(parseDetailTab('hack')).toBe('info');
    expect(parseDetailTab(null)).toBe('info');
  });

  it('버전은 1 이상의 정수만', () => {
    expect(parseVersionParam('3')).toBe(3);
    expect(parseVersionParam('1')).toBe(1);
    for (const raw of ['0', '-1', '1.5', 'v2', '', '1e3', '9999999', null]) {
      expect(parseVersionParam(raw)).toBeNull();
    }
  });
});

describe('listDetailTabs / resolveDetailTab', () => {
  it('씬에 쓰는 종류(모델·지도·배경)에는 배치 속성 탭이 있다', () => {
    for (const kind of ['model', 'map', 'environment'] as const) {
      expect(listDetailTabs(kind)).toContain('placement');
    }
  });

  it('도면·CAD 에는 배치 속성 탭이 없고 나머지 탭은 그대로다', () => {
    for (const kind of ['drawing', 'cad'] as const) {
      expect(listDetailTabs(kind)).toEqual([
        'info',
        'stats',
        'versions',
        'usage',
        'activity',
      ]);
    }
  });

  it('그 종류에 있는 탭은 그대로 연다', () => {
    expect(resolveDetailTab('placement', 'map')).toBe('placement');
    expect(resolveDetailTab('versions', 'drawing')).toBe('versions');
  });

  it('그 종류에 없는 탭을 가리키면 정보 탭으로 떨어진다', () => {
    expect(resolveDetailTab('placement', 'drawing')).toBe('info');
    expect(resolveDetailTab('placement', 'cad')).toBe('info');
  });

  it('모르는 값·빈 값·null 은 정보 탭이다', () => {
    expect(resolveDetailTab('hack', 'model')).toBe('info');
    expect(resolveDetailTab('', 'model')).toBe('info');
    expect(resolveDetailTab(null, 'model')).toBe('info');
  });
});
