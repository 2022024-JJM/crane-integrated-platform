import { describe, expect, it } from 'vitest';
import { ASSET_KINDS, type AssetKind } from '../../model/types';
import {
  DEFAULT_ASSET_QUERY,
  queryAssets,
  type AssetQuery,
} from '../asset-library-query';
import {
  buildAssetTree,
  countAssetScope,
  getAssetScope,
  listAssetKindTags,
  toggleAssetScopeTag,
  withAssetScope,
} from '../asset-tree';
import { asset } from './fixtures';

const assets = [
  asset({ id: 'a', kind: 'model', tags: ['indoor', 'crane', 'okpo'] }),
  asset({ id: 'b', kind: 'model', tags: ['indoor', 'bay'] }),
  asset({ id: 'c', kind: 'model', tags: ['outdoor', 'crane'] }),
  asset({ id: 'd', kind: 'model', tags: [] }),
  asset({ id: 'e', kind: 'map', tags: ['ground', 'okpo'] }),
  asset({ id: 'f', kind: 'drawing', tags: ['indoor'] }),
];

const context = {
  collections: [],
  favorites: new Set<string>(),
  statsTable: {},
};
const q = (patch: Partial<AssetQuery>): AssetQuery => ({
  ...DEFAULT_ASSET_QUERY,
  ...patch,
});
const kindOf = (
  kind: AssetKind,
  selection?: Parameters<typeof buildAssetTree>[1],
) => buildAssetTree(assets, selection).kinds.find((n) => n.kind === kind)!;
const tagsOf = (
  kind: AssetKind,
  selection?: Parameters<typeof buildAssetTree>[1],
) => kindOf(kind, selection).tags.map((n) => [n.tag, n.count, n.checked]);

describe('buildAssetTree — 종류', () => {
  it('종류는 자산이 없어도 표의 순서로 전부 나온다', () => {
    const tree = buildAssetTree([]);
    expect(tree.total).toBe(0);
    expect(tree.kinds.map((node) => node.kind)).toEqual([...ASSET_KINDS]);
    expect(tree.kinds.every((node) => node.count === 0)).toBe(true);
    expect(tree.kinds.every((node) => node.tags.length === 0)).toBe(true);
  });

  it('종류의 수는 태그를 걸기 전의 수다 — 고른 태그에 따라 바뀌지 않는다', () => {
    expect(buildAssetTree(assets).total).toBe(6);
    expect(kindOf('model').count).toBe(4);
    expect(kindOf('model', { kind: 'model', tags: ['crane'] }).count).toBe(4);
    expect(kindOf('cad').count).toBe(0);
  });

  it('태그가 없는 자산은 종류에만 속한다', () => {
    const tree = buildAssetTree([asset({ kind: 'environment', tags: [] })]);
    const environment = tree.kinds.find((n) => n.kind === 'environment')!;
    expect(environment.count).toBe(1);
    expect(environment.tags).toEqual([]);
  });
});

describe('buildAssetTree — 태그', () => {
  it('고른 것이 없으면 그 종류에서 그 태그를 가진 자산 수다', () => {
    expect(tagsOf('model')).toEqual([
      // 많이 쓰인 순, 같으면 이름순.
      ['crane', 2, false],
      ['indoor', 2, false],
      ['bay', 1, false],
      ['okpo', 1, false],
      ['outdoor', 1, false],
    ]);
  });

  it('다른 종류의 같은 이름 태그와 섞어 세지 않는다', () => {
    expect(tagsOf('drawing')).toEqual([['indoor', 1, false]]);
    expect(tagsOf('map')).toEqual([
      ['ground', 1, false],
      ['okpo', 1, false],
    ]);
  });

  it('고른 태그가 있으면 "이 태그까지 걸면 남는 수" 다', () => {
    expect(tagsOf('model', { kind: 'model', tags: ['indoor'] })).toEqual([
      ['crane', 1, false], // indoor 이면서 crane — a
      ['indoor', 2, true], // 지금 고른 것 전체
      ['bay', 1, false],
      ['okpo', 1, false],
      ['outdoor', 0, false], // indoor 이면서 outdoor 인 자산은 없다
    ]);
  });

  it('둘을 고르면 둘 다 가진 자산으로 센다', () => {
    expect(
      tagsOf('model', { kind: 'model', tags: ['indoor', 'crane'] }),
    ).toEqual([
      ['crane', 1, true],
      ['indoor', 1, true],
      ['bay', 0, false],
      ['okpo', 1, false],
      ['outdoor', 0, false],
    ]);
  });

  it('순서는 고른 태그와 무관하다 — 체크해도 줄이 자리를 바꾸지 않는다', () => {
    const order = (tags: string[]) =>
      kindOf('model', { kind: 'model', tags }).tags.map((n) => n.tag);
    expect(order(['outdoor'])).toEqual(order([]));
    expect(order(['indoor', 'bay'])).toEqual(order([]));
  });

  it('다른 종류를 보고 있으면 고른 태그가 걸리지 않는다', () => {
    // 지도를 보며 okpo 를 골랐다 — 모델의 태그는 고르기 전의 수 그대로다.
    expect(tagsOf('model', { kind: 'map', tags: ['okpo'] })).toEqual(
      tagsOf('model'),
    );
    expect(tagsOf('map', { kind: 'map', tags: ['okpo'] })).toEqual([
      ['ground', 1, false],
      ['okpo', 1, true],
    ]);
  });

  it('전체를 보고 있으면 고른 태그가 모든 종류에 걸린다', () => {
    const selection = { kind: null, tags: ['okpo'] };
    expect(tagsOf('model', selection)).toEqual([
      ['crane', 1, false],
      ['indoor', 1, false],
      ['bay', 0, false],
      ['okpo', 1, true],
      ['outdoor', 0, false],
    ]);
    expect(tagsOf('map', selection)).toEqual([
      ['ground', 1, false],
      ['okpo', 1, true],
    ]);
    // 그 태그가 없는 종류 — 체크된 줄은 없고 나머지는 전부 0 이다.
    expect(tagsOf('drawing', selection)).toEqual([['indoor', 0, false]]);
  });

  it('그 종류에 없는 태그를 고르면 줄은 생기지 않고 전부 0 이 된다', () => {
    expect(tagsOf('model', { kind: 'model', tags: ['nope'] })).toEqual([
      ['crane', 0, false],
      ['indoor', 0, false],
      ['bay', 0, false],
      ['okpo', 0, false],
      ['outdoor', 0, false],
    ]);
  });

  it('대소문자만 다른 태그는 한 줄로 묶고 표기는 먼저 나온 것을 쓴다', () => {
    const tree = buildAssetTree(
      [
        asset({ id: 'x', tags: ['Crane'] }),
        asset({ id: 'y', tags: ['crane'] }),
        asset({ id: 'z', tags: ['CRANE', 'bay'] }),
      ],
      { kind: 'model', tags: ['cRaNe'] },
    );
    expect(tree.kinds[0].tags).toEqual([
      { tag: 'Crane', count: 3, checked: true },
      { tag: 'bay', count: 1, checked: false },
    ]);
  });

  it('한 자산이 같은 태그를 두 번 가져도 한 번만 센다', () => {
    const tree = buildAssetTree([asset({ tags: ['crane', 'Crane'] })]);
    expect(tree.kinds[0].tags).toEqual([
      { tag: 'crane', count: 1, checked: false },
    ]);
  });

  it('같은 태그를 두 번 골라도 결과가 같다', () => {
    expect(
      tagsOf('model', { kind: 'model', tags: ['indoor', 'INDOOR'] }),
    ).toEqual(tagsOf('model', { kind: 'model', tags: ['indoor'] }));
  });

  it('숫자가 든 태그는 수로 견줘 이름순을 정한다', () => {
    const tree = buildAssetTree([
      asset({ id: 'x', tags: ['bay 10'] }),
      asset({ id: 'y', tags: ['bay 2'] }),
    ]);
    expect(tree.kinds[0].tags.map((n) => n.tag)).toEqual(['bay 2', 'bay 10']);
  });

  it('입력 자산과 태그 배열을 바꾸지 않는다', () => {
    const before = JSON.stringify(assets);
    buildAssetTree(assets, { kind: 'model', tags: ['indoor'] });
    expect(JSON.stringify(assets)).toBe(before);
  });
});

describe('계층의 수와 탐색 결과', () => {
  const count = (query: AssetQuery) =>
    queryAssets(assets, query, context).length;

  it('종류의 수는 그 종류로 옮긴 결과의 수와 같다', () => {
    const tree = buildAssetTree(assets);
    expect(count(withAssetScope(DEFAULT_ASSET_QUERY, { kind: null }))).toBe(
      tree.total,
    );
    for (const node of tree.kinds) {
      expect(
        count(withAssetScope(DEFAULT_ASSET_QUERY, { kind: node.kind })),
      ).toBe(node.count);
    }
  });

  it('고르지 않은 태그의 수는 그 체크박스를 누른 결과의 수와 같다', () => {
    const starts: AssetQuery[] = [
      DEFAULT_ASSET_QUERY,
      q({ tags: ['okpo'] }),
      q({ kinds: ['model'] }),
      q({ kinds: ['model'], tags: ['indoor'] }),
      q({ kinds: ['model'], tags: ['indoor', 'crane'] }),
      q({ kinds: ['map'], tags: ['okpo'] }),
    ];
    for (const start of starts) {
      const tree = buildAssetTree(assets, {
        kind: getAssetScope(start).kind,
        tags: start.tags,
      });
      for (const kindNode of tree.kinds) {
        for (const tagNode of kindNode.tags) {
          if (tagNode.checked) continue;
          const next = toggleAssetScopeTag(start, kindNode.kind, tagNode.tag);
          expect(count(next), `${kindNode.kind}/${tagNode.tag}`).toBe(
            tagNode.count,
          );
        }
      }
    }
  });
});

describe('getAssetScope / withAssetScope', () => {
  it('기본 탐색 상태는 최상위다', () => {
    expect(getAssetScope(DEFAULT_ASSET_QUERY)).toEqual({ kind: null });
  });

  it('위치로 옮겼다 읽으면 같은 위치다', () => {
    for (const kind of [null, ...ASSET_KINDS]) {
      expect(
        getAssetScope(withAssetScope(DEFAULT_ASSET_QUERY, { kind })),
      ).toEqual({ kind });
    }
  });

  it('종류를 여럿 고른 상태는 종류 마디가 아니다', () => {
    expect(getAssetScope(q({ kinds: ['model', 'map'] }))).toEqual({
      kind: null,
    });
  });

  it('위치를 옮기면 태그가 풀린다 — 같은 종류를 다시 눌러도', () => {
    const query = q({ kinds: ['model'], tags: ['indoor', 'crane'] });
    expect(withAssetScope(query, { kind: 'map' }).tags).toEqual([]);
    expect(withAssetScope(query, { kind: 'model' }).tags).toEqual([]);
    expect(withAssetScope(query, { kind: null })).toMatchObject({
      kinds: [],
      tags: [],
    });
  });

  it('검색어·상태·정렬 같은 다른 필터는 건드리지 않는다', () => {
    const query = q({
      text: 'crane',
      statuses: ['draft'],
      sort: 'size',
      reverse: true,
      favoritesOnly: true,
      collectionId: 'yard',
      attention: 'review',
    });
    expect(withAssetScope(query, { kind: 'cad' })).toEqual({
      ...query,
      kinds: ['cad'],
    });
  });
});

describe('toggleAssetScopeTag', () => {
  it('보고 있는 종류의 태그는 더하고 뺀다', () => {
    const start = q({ kinds: ['model'], tags: ['indoor'] });
    const added = toggleAssetScopeTag(start, 'model', 'crane');
    expect(added).toMatchObject({
      kinds: ['model'],
      tags: ['indoor', 'crane'],
    });
    expect(toggleAssetScopeTag(added, 'model', 'indoor').tags).toEqual([
      'crane',
    ]);
  });

  it('마지막 태그를 빼면 그 종류 전부로 돌아간다', () => {
    expect(
      toggleAssetScopeTag(
        q({ kinds: ['model'], tags: ['indoor'] }),
        'model',
        'indoor',
      ),
    ).toMatchObject({ kinds: ['model'], tags: [] });
  });

  it('대소문자만 다른 태그는 같은 태그다 — 더하지 않고 뺀다', () => {
    const start = q({ kinds: ['model'], tags: ['Indoor'] });
    expect(toggleAssetScopeTag(start, 'model', 'indoor').tags).toEqual([]);
  });

  it('다른 종류의 태그를 누르면 그 종류로 옮겨 그 태그 하나로 시작한다', () => {
    const start = q({ kinds: ['model'], tags: ['indoor', 'crane'] });
    expect(toggleAssetScopeTag(start, 'map', 'ground')).toMatchObject({
      kinds: ['map'],
      tags: ['ground'],
    });
    // 앞 종류에서 고른 것과 같은 이름이어도 "빼기" 가 아니라 새로 고르는 것이다.
    expect(toggleAssetScopeTag(start, 'drawing', 'indoor')).toMatchObject({
      kinds: ['drawing'],
      tags: ['indoor'],
    });
  });

  it('전체를 보고 있으면 고른 태그를 들고 그 종류로 들어간다', () => {
    const start = q({ tags: ['okpo'] });
    expect(toggleAssetScopeTag(start, 'model', 'crane')).toMatchObject({
      kinds: ['model'],
      tags: ['okpo', 'crane'],
    });
    expect(toggleAssetScopeTag(start, 'map', 'okpo')).toMatchObject({
      kinds: ['map'],
      tags: [],
    });
  });

  it('종류를 여럿 고른 상태(전체와 같다)에서도 한 종류로 좁힌다', () => {
    expect(
      toggleAssetScopeTag(q({ kinds: ['model', 'map'] }), 'map', 'ground'),
    ).toMatchObject({ kinds: ['map'], tags: ['ground'] });
  });

  it('다른 필터는 건드리지 않고 입력을 바꾸지 않는다', () => {
    const start = q({
      kinds: ['model'],
      tags: ['indoor'],
      text: 'c',
      sort: 'size',
    });
    const before = JSON.stringify(start);
    expect(toggleAssetScopeTag(start, 'model', 'crane')).toMatchObject({
      text: 'c',
      sort: 'size',
    });
    expect(JSON.stringify(start)).toBe(before);
  });
});

describe('listAssetKindTags', () => {
  it('그 종류에서 쓰인 태그를 많이 쓰인 순으로 낸다', () => {
    expect(listAssetKindTags(assets, 'model')).toEqual([
      'crane',
      'indoor',
      'bay',
      'okpo',
      'outdoor',
    ]);
    expect(listAssetKindTags(assets, 'drawing')).toEqual(['indoor']);
  });

  it('자산이 없는 종류와 빈 목록은 빈 배열', () => {
    expect(listAssetKindTags(assets, 'cad')).toEqual([]);
    expect(listAssetKindTags([], 'model')).toEqual([]);
  });
});

describe('countAssetScope', () => {
  const tree = buildAssetTree(assets);
  it('전체는 총수, 종류는 그 종류의 수', () => {
    expect(countAssetScope(tree, { kind: null })).toBe(6);
    expect(countAssetScope(tree, { kind: 'model' })).toBe(4);
    expect(countAssetScope(tree, { kind: 'cad' })).toBe(0);
  });

  it('고른 태그는 위치의 수를 바꾸지 않는다', () => {
    const narrowed = buildAssetTree(assets, { kind: 'model', tags: ['bay'] });
    expect(countAssetScope(narrowed, { kind: 'model' })).toBe(4);
    expect(countAssetScope(narrowed, { kind: null })).toBe(6);
  });

  it('빈 라이브러리는 어디든 0', () => {
    const empty = buildAssetTree([]);
    expect(countAssetScope(empty, { kind: null })).toBe(0);
    expect(countAssetScope(empty, { kind: 'model' })).toBe(0);
  });
});
