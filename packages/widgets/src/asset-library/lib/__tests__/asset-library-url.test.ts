import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSET_QUERY, type AssetQuery } from '@crane/domain/asset-library';
import {
  parseAssetQuery,
  parseDetailTab,
  parseVersionParam,
  toggleListValue,
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
        'q=crane&site=okpo&kind=model,map&status=draft&tag=a,b&collection=yard&fav=1&attn=review&sort=size',
      ),
    ).toEqual({
      attention: 'review',
      text: 'crane',
      site: 'okpo',
      kinds: ['model', 'map'],
      category: null,
      statuses: ['draft'],
      tags: ['a', 'b'],
      collectionId: 'yard',
      favoritesOnly: true,
      sort: 'size',
      reverse: false,
    });
  });

  it('모르는 값은 버리고 기본값으로 읽는다', () => {
    expect(
      parse(
        'site=mars&kind=texture,model&status=done&sort=random&fav=yes&attn=panic',
      ),
    ).toEqual({ ...DEFAULT_ASSET_QUERY, kinds: ['model'] });
  });

  it('목록은 고른 순서와 무관하게 표의 순서로 정규화한다', () => {
    expect(parse('kind=drawing,model').kinds).toEqual(['model', 'drawing']);
    expect(parse('status=published,draft').statuses).toEqual(['draft', 'published']);
  });

  it('빈 태그 조각은 버린다', () => {
    expect(parse('tag=,a,,b,').tags).toEqual(['a', 'b']);
    expect(parse('tag=').tags).toEqual([]);
  });
});

describe('writeAssetQuery', () => {
  const full: AssetQuery = {
    text: ' crane ',
    site: 'philly',
    kinds: ['model'],
    category: 'indoor crane',
    statuses: ['draft', 'published'],
    tags: ['a'],
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

describe('분류(cat)', () => {
  const parse = (search: string) => parseAssetQuery(new URLSearchParams(search));

  it('읽고 쓴다', () => {
    expect(parse('cat=indoor').category).toBe('indoor');
    expect(
      writeAssetQuery(new URLSearchParams(), {
        ...DEFAULT_ASSET_QUERY,
        category: 'indoor',
      }).toString(),
    ).toBe('cat=indoor');
  });

  it('없거나 공백뿐이면 null', () => {
    expect(parse('').category).toBeNull();
    expect(parse('cat=').category).toBeNull();
    expect(parse('cat=%20%20').category).toBeNull();
  });
});

describe('toggleListValue', () => {
  it('없으면 넣고 있으면 뺀다 — 입력은 그대로', () => {
    const list = ['a'];
    expect(toggleListValue(list, 'b')).toEqual(['a', 'b']);
    expect(toggleListValue(list, 'a')).toEqual([]);
    expect(list).toEqual(['a']);
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
