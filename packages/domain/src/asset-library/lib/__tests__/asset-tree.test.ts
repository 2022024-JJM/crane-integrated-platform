import { describe, expect, it } from 'vitest';
import { ASSET_KINDS, type AssetKind } from '../../model/types';
import {
  DEFAULT_ASSET_QUERY,
  queryAssets,
  type AssetQuery,
} from '../asset-library-query';
import {
  buildAssetCategoryNodes,
  buildAssetTree,
  countAssetScope,
  getAssetScope,
  hasAllAssetCategories,
  listAssetKindCategories,
  toggleAssetScopeCategory,
  withAssetScope,
} from '../asset-tree';
import { asset } from './fixtures';

const assets = [
  asset({ id: 'a', kind: 'model', categories: ['indoor', 'crane', 'okpo'] }),
  asset({ id: 'b', kind: 'model', categories: ['indoor', 'bay'] }),
  asset({ id: 'c', kind: 'model', categories: ['outdoor', 'crane'] }),
  asset({ id: 'd', kind: 'model', categories: [] }),
  asset({ id: 'e', kind: 'map', categories: ['ground', 'okpo'] }),
  asset({ id: 'f', kind: 'drawing', categories: ['indoor'] }),
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
const categoriesOf = (
  kind: AssetKind,
  selection?: Parameters<typeof buildAssetTree>[1],
) => kindOf(kind, selection).categories.map((n) => [n.category, n.count, n.checked]);

describe('buildAssetTree — 종류', () => {
  it('종류는 자산이 없어도 표의 순서로 전부 나온다', () => {
    const tree = buildAssetTree([]);
    expect(tree.total).toBe(0);
    expect(tree.kinds.map((node) => node.kind)).toEqual([...ASSET_KINDS]);
    expect(tree.kinds.every((node) => node.count === 0)).toBe(true);
    expect(tree.kinds.every((node) => node.categories.length === 0)).toBe(true);
  });

  it('종류의 수는 카테고리를 걸기 전의 수다 — 고른 카테고리에 따라 바뀌지 않는다', () => {
    expect(buildAssetTree(assets).total).toBe(6);
    expect(kindOf('model').count).toBe(4);
    expect(kindOf('model', { kind: 'model', categories: ['crane'] }).count).toBe(4);
    expect(kindOf('cad').count).toBe(0);
  });

  it('카테고리가 없는 자산은 종류에만 속한다', () => {
    const tree = buildAssetTree([asset({ kind: 'environment', categories: [] })]);
    const environment = tree.kinds.find((n) => n.kind === 'environment')!;
    expect(environment.count).toBe(1);
    expect(environment.categories).toEqual([]);
  });
});

describe('buildAssetTree — 카테고리', () => {
  it('고른 것이 없으면 그 종류에서 그 카테고리를 가진 자산 수다', () => {
    expect(categoriesOf('model')).toEqual([
      // 많이 쓰인 순, 같으면 이름순.
      ['crane', 2, false],
      ['indoor', 2, false],
      ['bay', 1, false],
      ['okpo', 1, false],
      ['outdoor', 1, false],
    ]);
  });

  it('다른 종류의 같은 이름 카테고리와 섞어 세지 않는다', () => {
    expect(categoriesOf('drawing')).toEqual([['indoor', 1, false]]);
    expect(categoriesOf('map')).toEqual([
      ['ground', 1, false],
      ['okpo', 1, false],
    ]);
  });

  it('고른 카테고리가 있으면 "이 카테고리까지 걸면 남는 수" 다', () => {
    expect(categoriesOf('model', { kind: 'model', categories: ['indoor'] })).toEqual([
      ['crane', 1, false], // indoor 이면서 crane — a
      ['indoor', 2, true], // 지금 고른 것 전체
      ['bay', 1, false],
      ['okpo', 1, false],
      ['outdoor', 0, false], // indoor 이면서 outdoor 인 자산은 없다
    ]);
  });

  it('둘을 고르면 둘 다 가진 자산으로 센다', () => {
    expect(
      categoriesOf('model', { kind: 'model', categories: ['indoor', 'crane'] }),
    ).toEqual([
      ['crane', 1, true],
      ['indoor', 1, true],
      ['bay', 0, false],
      ['okpo', 1, false],
      ['outdoor', 0, false],
    ]);
  });

  it('순서는 고른 카테고리와 무관하다 — 체크해도 줄이 자리를 바꾸지 않는다', () => {
    const order = (categories: string[]) =>
      kindOf('model', { kind: 'model', categories }).categories.map((n) => n.category);
    expect(order(['outdoor'])).toEqual(order([]));
    expect(order(['indoor', 'bay'])).toEqual(order([]));
  });

  it('다른 종류를 보고 있으면 고른 카테고리가 걸리지 않는다', () => {
    // 지도를 보며 okpo 를 골랐다 — 모델의 카테고리는 고르기 전의 수 그대로다.
    expect(categoriesOf('model', { kind: 'map', categories: ['okpo'] })).toEqual(
      categoriesOf('model'),
    );
    expect(categoriesOf('map', { kind: 'map', categories: ['okpo'] })).toEqual([
      ['ground', 1, false],
      ['okpo', 1, true],
    ]);
  });

  it('전체를 보고 있으면 고른 카테고리가 모든 종류에 걸린다', () => {
    const selection = { kind: null, categories: ['okpo'] };
    expect(categoriesOf('model', selection)).toEqual([
      ['crane', 1, false],
      ['indoor', 1, false],
      ['bay', 0, false],
      ['okpo', 1, true],
      ['outdoor', 0, false],
    ]);
    expect(categoriesOf('map', selection)).toEqual([
      ['ground', 1, false],
      ['okpo', 1, true],
    ]);
    // 그 카테고리가 없는 종류 — 체크된 줄은 없고 나머지는 전부 0 이다.
    expect(categoriesOf('drawing', selection)).toEqual([['indoor', 0, false]]);
  });

  it('그 종류에 없는 카테고리를 고르면 줄은 생기지 않고 전부 0 이 된다', () => {
    expect(categoriesOf('model', { kind: 'model', categories: ['nope'] })).toEqual([
      ['crane', 0, false],
      ['indoor', 0, false],
      ['bay', 0, false],
      ['okpo', 0, false],
      ['outdoor', 0, false],
    ]);
  });

  it('대소문자만 다른 카테고리는 한 줄로 묶고 표기는 먼저 나온 것을 쓴다', () => {
    const tree = buildAssetTree(
      [
        asset({ id: 'x', categories: ['Crane'] }),
        asset({ id: 'y', categories: ['crane'] }),
        asset({ id: 'z', categories: ['CRANE', 'bay'] }),
      ],
      { kind: 'model', categories: ['cRaNe'] },
    );
    expect(tree.kinds[0].categories).toEqual([
      { category: 'Crane', count: 3, checked: true },
      { category: 'bay', count: 1, checked: false },
    ]);
  });

  it('한 자산이 같은 카테고리를 두 번 가져도 한 번만 센다', () => {
    const tree = buildAssetTree([asset({ categories: ['crane', 'Crane'] })]);
    expect(tree.kinds[0].categories).toEqual([
      { category: 'crane', count: 1, checked: false },
    ]);
  });

  it('같은 카테고리를 두 번 골라도 결과가 같다', () => {
    expect(
      categoriesOf('model', { kind: 'model', categories: ['indoor', 'INDOOR'] }),
    ).toEqual(categoriesOf('model', { kind: 'model', categories: ['indoor'] }));
  });

  it('숫자가 든 카테고리는 수로 견줘 이름순을 정한다', () => {
    const tree = buildAssetTree([
      asset({ id: 'x', categories: ['bay 10'] }),
      asset({ id: 'y', categories: ['bay 2'] }),
    ]);
    expect(tree.kinds[0].categories.map((n) => n.category)).toEqual(['bay 2', 'bay 10']);
  });

  it('입력 자산과 카테고리 배열을 바꾸지 않는다', () => {
    const before = JSON.stringify(assets);
    buildAssetTree(assets, { kind: 'model', categories: ['indoor'] });
    expect(JSON.stringify(assets)).toBe(before);
  });
});

describe('buildAssetCategoryNodes', () => {
  const lists = [
    ['indoor', 'crane', 'okpo'],
    ['indoor', 'bay'],
    ['outdoor', 'crane'],
    [],
  ];
  const rows = (selected?: string[]) =>
    buildAssetCategoryNodes(lists, selected).map((n) => [n.category, n.count, n.checked]);

  it('빈 목록은 줄이 없다 — 고른 카테고리가 있어도', () => {
    expect(buildAssetCategoryNodes([])).toEqual([]);
    expect(buildAssetCategoryNodes([], ['crane'])).toEqual([]);
    expect(buildAssetCategoryNodes([[], []])).toEqual([]);
  });

  it('고른 것이 없으면 그 카테고리를 가진 목록의 수 — 많이 쓰인 순, 같으면 이름순', () => {
    expect(rows()).toEqual([
      ['crane', 2, false],
      ['indoor', 2, false],
      ['bay', 1, false],
      ['okpo', 1, false],
      ['outdoor', 1, false],
    ]);
  });

  it('고른 카테고리가 있으면 "이 카테고리까지 걸면 남는 수" 이고 0 도 줄은 남는다', () => {
    expect(rows(['indoor'])).toEqual([
      ['crane', 1, false],
      ['indoor', 2, true],
      ['bay', 1, false],
      ['okpo', 1, false],
      ['outdoor', 0, false],
    ]);
  });

  it('고른 카테고리의 수는 지금 남은 전체와 같다', () => {
    const nodes = buildAssetCategoryNodes(lists, ['indoor', 'crane']);
    expect(nodes.filter((n) => n.checked).map((n) => n.count)).toEqual([1, 1]);
  });

  it('목록에 없는 카테고리를 고르면 줄은 생기지 않고 전부 0 이 된다', () => {
    expect(rows(['ghost'])).toEqual([
      ['crane', 0, false],
      ['indoor', 0, false],
      ['bay', 0, false],
      ['okpo', 0, false],
      ['outdoor', 0, false],
    ]);
  });

  it('고른 카테고리의 대소문자와 중복은 결과를 바꾸지 않는다', () => {
    expect(rows(['INDOOR', 'indoor'])).toEqual(rows(['indoor']));
  });

  it('입력을 바꾸지 않는다', () => {
    const before = JSON.stringify(lists);
    const selected = ['indoor'];
    buildAssetCategoryNodes(lists, selected);
    expect(JSON.stringify(lists)).toBe(before);
    expect(selected).toEqual(['indoor']);
  });
});

describe('hasAllAssetCategories', () => {
  it('고른 것이 없으면 참 — 카테고리가 없는 자산도', () => {
    expect(hasAllAssetCategories(['crane'], [])).toBe(true);
    expect(hasAllAssetCategories([], [])).toBe(true);
  });

  it('고른 카테고리를 모두 가져야 참이다', () => {
    expect(hasAllAssetCategories(['indoor', 'crane'], ['crane'])).toBe(true);
    expect(hasAllAssetCategories(['indoor', 'crane'], ['crane', 'indoor'])).toBe(true);
    expect(hasAllAssetCategories(['indoor'], ['crane', 'indoor'])).toBe(false);
    expect(hasAllAssetCategories([], ['crane'])).toBe(false);
  });

  it('대소문자를 가리지 않고, 카테고리를 품은 다른 카테고리는 다른 카테고리다', () => {
    expect(hasAllAssetCategories(['Crane'], ['crane'])).toBe(true);
    expect(hasAllAssetCategories(['crane'], ['CRANE'])).toBe(true);
    expect(hasAllAssetCategories(['outdoor-crane'], ['crane'])).toBe(false);
  });

  it('탐색 결과와 같은 규칙이다', () => {
    const ids = (list: { id: string }[]) => list.map((a) => a.id).sort();
    for (const categories of [[], ['indoor'], ['indoor', 'crane'], ['ghost']]) {
      expect(ids(assets.filter((a) => hasAllAssetCategories(a.categories, categories)))).toEqual(
        ids(queryAssets(assets, q({ categories }), context)),
      );
    }
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

  it('고르지 않은 카테고리의 수는 그 체크박스를 누른 결과의 수와 같다', () => {
    const starts: AssetQuery[] = [
      DEFAULT_ASSET_QUERY,
      q({ categories: ['okpo'] }),
      q({ kinds: ['model'] }),
      q({ kinds: ['model'], categories: ['indoor'] }),
      q({ kinds: ['model'], categories: ['indoor', 'crane'] }),
      q({ kinds: ['map'], categories: ['okpo'] }),
    ];
    for (const start of starts) {
      const tree = buildAssetTree(assets, {
        kind: getAssetScope(start).kind,
        categories: start.categories,
      });
      for (const kindNode of tree.kinds) {
        for (const categoryNode of kindNode.categories) {
          if (categoryNode.checked) continue;
          const next = toggleAssetScopeCategory(start, kindNode.kind, categoryNode.category);
          expect(count(next), `${kindNode.kind}/${categoryNode.category}`).toBe(
            categoryNode.count,
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

  it('위치를 옮기면 카테고리가 풀린다 — 같은 종류를 다시 눌러도', () => {
    const query = q({ kinds: ['model'], categories: ['indoor', 'crane'] });
    expect(withAssetScope(query, { kind: 'map' }).categories).toEqual([]);
    expect(withAssetScope(query, { kind: 'model' }).categories).toEqual([]);
    expect(withAssetScope(query, { kind: null })).toMatchObject({
      kinds: [],
      categories: [],
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

describe('toggleAssetScopeCategory', () => {
  it('보고 있는 종류의 카테고리는 더하고 뺀다', () => {
    const start = q({ kinds: ['model'], categories: ['indoor'] });
    const added = toggleAssetScopeCategory(start, 'model', 'crane');
    expect(added).toMatchObject({
      kinds: ['model'],
      categories: ['indoor', 'crane'],
    });
    expect(toggleAssetScopeCategory(added, 'model', 'indoor').categories).toEqual([
      'crane',
    ]);
  });

  it('마지막 카테고리를 빼면 그 종류 전부로 돌아간다', () => {
    expect(
      toggleAssetScopeCategory(
        q({ kinds: ['model'], categories: ['indoor'] }),
        'model',
        'indoor',
      ),
    ).toMatchObject({ kinds: ['model'], categories: [] });
  });

  it('대소문자만 다른 카테고리는 같은 카테고리다 — 더하지 않고 뺀다', () => {
    const start = q({ kinds: ['model'], categories: ['Indoor'] });
    expect(toggleAssetScopeCategory(start, 'model', 'indoor').categories).toEqual([]);
  });

  it('다른 종류의 카테고리를 누르면 그 종류로 옮겨 그 카테고리 하나로 시작한다', () => {
    const start = q({ kinds: ['model'], categories: ['indoor', 'crane'] });
    expect(toggleAssetScopeCategory(start, 'map', 'ground')).toMatchObject({
      kinds: ['map'],
      categories: ['ground'],
    });
    // 앞 종류에서 고른 것과 같은 이름이어도 "빼기" 가 아니라 새로 고르는 것이다.
    expect(toggleAssetScopeCategory(start, 'drawing', 'indoor')).toMatchObject({
      kinds: ['drawing'],
      categories: ['indoor'],
    });
  });

  it('전체를 보고 있으면 고른 카테고리를 들고 그 종류로 들어간다', () => {
    const start = q({ categories: ['okpo'] });
    expect(toggleAssetScopeCategory(start, 'model', 'crane')).toMatchObject({
      kinds: ['model'],
      categories: ['okpo', 'crane'],
    });
    expect(toggleAssetScopeCategory(start, 'map', 'okpo')).toMatchObject({
      kinds: ['map'],
      categories: [],
    });
  });

  it('종류를 여럿 고른 상태(전체와 같다)에서도 한 종류로 좁힌다', () => {
    expect(
      toggleAssetScopeCategory(q({ kinds: ['model', 'map'] }), 'map', 'ground'),
    ).toMatchObject({ kinds: ['map'], categories: ['ground'] });
  });

  it('다른 필터는 건드리지 않고 입력을 바꾸지 않는다', () => {
    const start = q({
      kinds: ['model'],
      categories: ['indoor'],
      text: 'c',
      sort: 'size',
    });
    const before = JSON.stringify(start);
    expect(toggleAssetScopeCategory(start, 'model', 'crane')).toMatchObject({
      text: 'c',
      sort: 'size',
    });
    expect(JSON.stringify(start)).toBe(before);
  });
});

describe('listAssetKindCategories', () => {
  it('그 종류에서 쓰인 카테고리를 많이 쓰인 순으로 낸다', () => {
    expect(listAssetKindCategories(assets, 'model')).toEqual([
      'crane',
      'indoor',
      'bay',
      'okpo',
      'outdoor',
    ]);
    expect(listAssetKindCategories(assets, 'drawing')).toEqual(['indoor']);
  });

  it('자산이 없는 종류와 빈 목록은 빈 배열', () => {
    expect(listAssetKindCategories(assets, 'cad')).toEqual([]);
    expect(listAssetKindCategories([], 'model')).toEqual([]);
  });
});

describe('countAssetScope', () => {
  const tree = buildAssetTree(assets);
  it('전체는 총수, 종류는 그 종류의 수', () => {
    expect(countAssetScope(tree, { kind: null })).toBe(6);
    expect(countAssetScope(tree, { kind: 'model' })).toBe(4);
    expect(countAssetScope(tree, { kind: 'cad' })).toBe(0);
  });

  it('고른 카테고리는 위치의 수를 바꾸지 않는다', () => {
    const narrowed = buildAssetTree(assets, { kind: 'model', categories: ['bay'] });
    expect(countAssetScope(narrowed, { kind: 'model' })).toBe(4);
    expect(countAssetScope(narrowed, { kind: null })).toBe(6);
  });

  it('빈 라이브러리는 어디든 0', () => {
    const empty = buildAssetTree([]);
    expect(countAssetScope(empty, { kind: null })).toBe(0);
    expect(countAssetScope(empty, { kind: 'model' })).toBe(0);
  });
});
