import { describe, expect, it } from 'vitest';
import type { ScenePlaceableModel } from '@crane/domain/3d';
import {
  ASSET_VERSION_STATUSES,
  type AssetFileRef,
  type AssetRecord,
  type AssetVersionStatus,
} from '@crane/domain/asset-library';
import {
  buildScenePaletteEnvironments,
  buildScenePaletteMaps,
  buildScenePaletteModels,
  filterScenePaletteModels,
  listScenePaletteCategories,
  pruneScenePaletteCategories,
  searchScenePaletteCategories,
  selectPlaceableModels,
  toggleScenePaletteCategory,
} from '../scene-palette';

function asset(
  patch: Partial<AssetRecord> & { id: string },
  options: { status?: AssetVersionStatus; ref?: AssetFileRef } = {},
): AssetRecord {
  return {
    kind: 'model',
    name: patch.id,
    description: '',
    categories: [],
    owner: '',
    relatedAssetIds: [],
    versions: [
      {
        version: 1,
        status: options.status ?? 'published',
        file: {
          ref: options.ref ?? {
            storage: 'public',
            path: `/models/${patch.id}.glb`,
          },
          fileName: `${patch.id}.glb`,
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
    ...patch,
  };
}

/** 버전 2 를 붙인다 — 경로는 라이브러리 디렉터리. */
function withVersion2(
  record: AssetRecord,
  status: AssetVersionStatus,
  current: 1 | 2,
): AssetRecord {
  return {
    ...record,
    versions: [
      ...record.versions,
      {
        ...record.versions[0],
        version: 2,
        status,
        file: {
          ...record.versions[0].file,
          ref: {
            storage: 'public',
            path: `/asset-library/files/${record.id}/v2/${record.id}.glb`,
          },
        },
      },
    ],
    currentVersion: current,
  };
}

describe('buildScenePaletteModels', () => {
  it('빈 라이브러리는 빈 팔레트', () => {
    expect(buildScenePaletteModels([])).toEqual([]);
  });

  it('모델 자산을 문서 순서대로 낸다 — 이름·경로·버전은 라이브러리 것이다', () => {
    const models = buildScenePaletteModels([
      asset({ id: 'crane-a', name: 'Crane A', categories: ['outdoor'] }),
      asset({ id: 'bay-b', name: 'Bay B', categories: ['indoor'] }),
    ]);
    expect(models.map((m) => m.item)).toEqual([
      { id: 'crane-a', version: 1, label: 'Crane A', path: '/models/crane-a.glb' },
      { id: 'bay-b', version: 1, label: 'Bay B', path: '/models/bay-b.glb' },
    ]);
    expect(models.map((m) => m.categories)).toEqual([['outdoor'], ['indoor']]);
  });

  it('놓는 것은 현재 버전의 파일이다 — 새 버전이 있어도 현재가 아니면 놓지 않는다', () => {
    const base = asset({ id: 'crane-a' });
    const [stillV1] = buildScenePaletteModels([
      withVersion2(base, 'published', 1),
    ]);
    expect(stillV1.item).toMatchObject({
      version: 1,
      path: '/models/crane-a.glb',
    });
    const [movedToV2] = buildScenePaletteModels([
      withVersion2(base, 'published', 2),
    ]);
    expect(movedToV2.item).toMatchObject({
      version: 2,
      path: '/asset-library/files/crane-a/v2/crane-a.glb',
    });
  });

  it('게시된 것만 놓을 수 있다 — 나머지 상태는 전부 막힌다', () => {
    for (const status of ASSET_VERSION_STATUSES) {
      const [model] = buildScenePaletteModels([
        asset({ id: 'crane-a' }, { status }),
      ]);
      expect(model.status).toBe(status);
      expect(model.blocked).toBe(status === 'published' ? null : 'unpublished');
    }
  });

  it('판정은 현재 버전의 상태로 한다', () => {
    // 현재(v1)는 게시, 새 버전(v2)은 초안 — 놓을 수 있다.
    const [draftAhead] = buildScenePaletteModels([
      withVersion2(asset({ id: 'crane-a' }), 'draft', 1),
    ]);
    expect(draftAhead.blocked).toBeNull();
    // 현재(v2)가 철회 — 게시된 v1 이 있어도 막힌다.
    const [withdrawnCurrent] = buildScenePaletteModels([
      withVersion2(asset({ id: 'crane-a' }), 'withdrawn', 2),
    ]);
    expect(withdrawnCurrent.blocked).toBe('unpublished');
  });

  it('이 브라우저에만 있는 파일은 게시해도 놓을 수 없고 경로가 비어 있다', () => {
    const [model] = buildScenePaletteModels([
      asset(
        { id: 'local' },
        { ref: { storage: 'browser', key: 'files/local/v1/local.glb' } },
      ),
    ]);
    expect(model.blocked).toBe('local-file');
    expect(model.item.path).toBe('');
  });

  it('모델이 아닌 종류는 나오지 않는다', () => {
    const models = buildScenePaletteModels([
      asset({ id: 'model-a' }),
      asset({ id: 'map-a', kind: 'map' }),
      asset({ id: 'sky', kind: 'environment' }),
      asset({ id: 'dwg', kind: 'drawing' }),
      asset({ id: 'cad', kind: 'cad' }),
    ]);
    expect(models.map((m) => m.item.id)).toEqual(['model-a']);
  });

  it('팔레트에서 숨긴 자산은 나오지 않는다 — 카테고리로는 숨기지 않는다', () => {
    const models = buildScenePaletteModels([
      asset({ id: 'part', placement: { paletteHidden: true } }),
      asset({ id: 'categorized', categories: ['runtime'] }),
    ]);
    expect(models.map((m) => m.item.id)).toEqual(['categorized']);
  });

  it('떠 있는 모델 표시는 배치 속성에서 온다 — 없으면 필드를 싣지 않는다', () => {
    const [ship, crane] = buildScenePaletteModels([
      asset({ id: 'ship', placement: { floating: true } }),
      asset({ id: 'crane' }),
    ]);
    expect(ship.item.floating).toBe(true);
    expect(crane.item).not.toHaveProperty('floating');
  });

  it('카테고리는 라이브러리의 것을 그대로 싣는다 — 없으면 빈 목록, 철자도 그대로', () => {
    const [bare, categorized] = buildScenePaletteModels([
      asset({ id: 'bare' }),
      asset({ id: 'categorized', categories: ['Crane', 'okpo', 'crane'] }),
    ]);
    expect(bare.categories).toEqual([]);
    expect(categorized.categories).toEqual(['Crane', 'okpo', 'crane']);
  });
});

describe('썸네일', () => {
  it('배포 경로에 저장된 썸네일만 싣는다', () => {
    const [withPublic, withBrowser, without] = buildScenePaletteModels([
      asset({
        id: 'a',
        thumbnail: {
          ref: { storage: 'public', path: '/asset-library/thumbnails/a.png' },
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
      asset({
        id: 'b',
        thumbnail: {
          ref: { storage: 'browser', key: 'thumbnails/b.png' },
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
      asset({ id: 'c' }),
    ]);
    expect(withPublic.thumbnail).toEqual({
      path: '/asset-library/thumbnails/a.png',
      stamp: '2026-01-01T00:00:00.000Z',
    });
    expect(withBrowser.thumbnail).toBeNull();
    expect(without.thumbnail).toBeNull();
  });
});

describe('buildScenePaletteMaps', () => {
  const map = (patch: Partial<AssetRecord> & { id: string }) =>
    asset({ kind: 'map', ...patch });

  it('지도 자산만 낸다', () => {
    const maps = buildScenePaletteMaps([
      asset({ id: 'model-a' }),
      map({ id: 'map-a' }),
      asset({ id: 'sky', kind: 'environment' }),
    ]);
    expect(maps.map((m) => m.item.id)).toEqual(['map-a']);
  });

  it('역할이 없으면 바닥(ground)이고 기본 위치 필드가 없다', () => {
    const [entry] = buildScenePaletteMaps([map({ id: 'map-a' })]);
    expect(entry.item.role).toBe('ground');
    expect(entry.item).not.toHaveProperty('defaultPosition');
  });

  it('배치 속성의 역할과 기본 위치를 싣는다', () => {
    const [entry] = buildScenePaletteMaps([
      map({
        id: 'terrain',
        placement: { mapRole: 'context', defaultPosition: [1, -2, 3] },
      }),
    ]);
    expect(entry.item).toMatchObject({
      role: 'context',
      defaultPosition: [1, -2, 3],
    });
  });

  it('게시 전 지도는 보이지만 추가할 수 없다', () => {
    const [entry] = buildScenePaletteMaps([
      asset({ id: 'draft-map', kind: 'map' }, { status: 'draft' }),
    ]);
    expect(entry.blocked).toBe('unpublished');
    expect(entry.status).toBe('draft');
  });

  it('팔레트에서 숨긴 지도는 나오지 않는다', () => {
    expect(
      buildScenePaletteMaps([
        map({ id: 'hidden', placement: { paletteHidden: true } }),
      ]),
    ).toEqual([]);
  });
});

describe('buildScenePaletteEnvironments', () => {
  it('배경 자산만, 현재 버전의 파일로 낸다', () => {
    const entries = buildScenePaletteEnvironments([
      asset({ id: 'model-a' }),
      asset(
        { id: 'sky', kind: 'environment', name: 'Sky' },
        { ref: { storage: 'public', path: '/scenes/sky.exr' } },
      ),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].item).toEqual({
      id: 'sky',
      version: 1,
      label: 'Sky',
      path: '/scenes/sky.exr',
    });
    expect(entries[0].blocked).toBeNull();
  });

  it('게시 전 배경은 고를 수 없다', () => {
    const [entry] = buildScenePaletteEnvironments([
      asset({ id: 'sky', kind: 'environment' }, { status: 'in-review' }),
    ]);
    expect(entry.blocked).toBe('unpublished');
  });
});

describe('selectPlaceableModels', () => {
  const models = (assets: AssetRecord[]) => buildScenePaletteModels(assets);
  const EMPTY: ScenePlaceableModel[] = [];

  it('내용이 같으면 직전 배열을 그대로 돌려준다', () => {
    const first = selectPlaceableModels(
      models([asset({ id: 'a' }), asset({ id: 'b' })]),
      EMPTY,
    );
    // 라이브러리에서 다른 것이 바뀌어 목록이 새로 만들어졌다.
    const second = selectPlaceableModels(
      models([asset({ id: 'a' }), asset({ id: 'b' })]),
      first,
    );
    expect(second).toBe(first);
  });

  it.each([
    ['이름', asset({ id: 'a', name: 'Renamed' })],
    ['버전·경로', withVersion2(asset({ id: 'a' }), 'published', 2)],
    ['떠 있는 모델 표시', asset({ id: 'a', placement: { floating: true } })],
  ])('%s 이(가) 달라지면 새 배열이다', (_label, changed) => {
    const first = selectPlaceableModels(models([asset({ id: 'a' })]), EMPTY);
    const second = selectPlaceableModels(models([changed]), first);
    expect(second).not.toBe(first);
    expect(second).toHaveLength(1);
  });

  it('개수가 달라지면 새 배열이다', () => {
    const first = selectPlaceableModels(models([asset({ id: 'a' })]), EMPTY);
    const second = selectPlaceableModels(
      models([asset({ id: 'a' }), asset({ id: 'b' })]),
      first,
    );
    expect(second).not.toBe(first);
  });

  it('놓을 수 없는 자산의 변화는 목록을 바꾸지 않는다', () => {
    const first = selectPlaceableModels(
      models([asset({ id: 'a' }), asset({ id: 'draft' }, { status: 'draft' })]),
      EMPTY,
    );
    const second = selectPlaceableModels(
      models([
        asset({ id: 'a' }),
        asset({ id: 'draft', name: 'Renamed' }, { status: 'in-review' }),
      ]),
      first,
    );
    expect(second).toBe(first);
  });

  it('막힌 자산은 빠진다', () => {
    const placeable = selectPlaceableModels(
      models([
        asset({ id: 'a' }),
        asset({ id: 'draft' }, { status: 'draft' }),
        asset(
          { id: 'local' },
          { ref: { storage: 'browser', key: 'files/local/v1/l.glb' } },
        ),
      ]),
      EMPTY,
    );
    expect(placeable.map((item) => item.id)).toEqual(['a']);
  });

  it('전부 막히면 빈 목록 — 직전이 비어 있었으면 그 배열을 유지한다', () => {
    expect(
      selectPlaceableModels(
        models([asset({ id: 'draft' }, { status: 'draft' })]),
        EMPTY,
      ),
    ).toBe(EMPTY);
    expect(selectPlaceableModels([], EMPTY)).toBe(EMPTY);
  });
});

/** 카테고리 필터 시험용 팔레트 — a·b·c 는 카테고리가 있고 d 는 없다. */
const categorizedModels = () =>
  buildScenePaletteModels([
    asset({ id: 'a', categories: ['indoor', 'crane', 'okpo'] }),
    asset({ id: 'b', categories: ['indoor', 'bay'] }),
    asset({ id: 'c', categories: ['outdoor', 'Crane'] }),
    asset({ id: 'd' }),
  ]);
const ids = (models: { item: { id: string } }[]) =>
  models.map((model) => model.item.id);

describe('listScenePaletteCategories', () => {
  const rows = (selected?: string[]) =>
    listScenePaletteCategories(categorizedModels(), selected).map((node) => [
      node.category,
      node.count,
      node.checked,
    ]);

  it('빈 팔레트·카테고리 없는 모델뿐인 팔레트는 줄이 없다', () => {
    expect(listScenePaletteCategories([])).toEqual([]);
    expect(
      listScenePaletteCategories(buildScenePaletteModels([asset({ id: 'bare' })])),
    ).toEqual([]);
  });

  it('많이 쓰인 순(같으면 이름순)이고 대소문자만 다른 카테고리는 한 줄이다', () => {
    expect(rows()).toEqual([
      ['crane', 2, false],
      ['indoor', 2, false],
      ['bay', 1, false],
      ['okpo', 1, false],
      ['outdoor', 1, false],
    ]);
  });

  it('고른 카테고리가 있으면 "이 카테고리까지 걸면 남는 수" — 0 인 줄도 남는다', () => {
    expect(rows(['indoor'])).toEqual([
      ['crane', 1, false],
      ['indoor', 2, true],
      ['bay', 1, false],
      ['okpo', 1, false],
      ['outdoor', 0, false],
    ]);
  });

  it('고르지 않은 줄의 수는 그 카테고리를 더 걸었을 때 남는 모델 수와 같다', () => {
    const models = categorizedModels();
    for (const selected of [[], ['indoor'], ['indoor', 'crane'], ['outdoor']]) {
      for (const node of listScenePaletteCategories(models, selected)) {
        if (node.checked) continue;
        expect(node.count).toBe(
          filterScenePaletteModels(models, [...selected, node.category]).length,
        );
      }
    }
  });

  it('팔레트에서 숨긴 자산·모델이 아닌 자산의 카테고리는 나오지 않는다', () => {
    const categories = listScenePaletteCategories(
      buildScenePaletteModels([
        asset({ id: 'shown', categories: ['crane'] }),
        asset({ id: 'part', categories: ['runtime'], placement: { paletteHidden: true } }),
        asset({ id: 'map-a', kind: 'map', categories: ['ground'] }),
      ]),
    );
    expect(categories.map((node) => node.category)).toEqual(['crane']);
  });

  it('게시 전이라 놓을 수 없는 모델의 카테고리도 센다 — 목록에 보이는 것과 수가 맞는다', () => {
    const categories = listScenePaletteCategories(
      buildScenePaletteModels([
        asset({ id: 'a', categories: ['crane'] }),
        asset({ id: 'draft', categories: ['crane'] }, { status: 'draft' }),
      ]),
    );
    expect(categories).toEqual([{ category: 'crane', count: 2, checked: false }]);
  });
});

describe('filterScenePaletteModels', () => {
  it('고른 것이 없으면 받은 배열 그대로다(전체) — 카테고리 없는 모델도 남는다', () => {
    const models = categorizedModels();
    expect(filterScenePaletteModels(models, [])).toBe(models);
  });

  it('고른 카테고리를 가진 모델만 남기고 순서를 지킨다', () => {
    expect(ids(filterScenePaletteModels(categorizedModels(), ['indoor']))).toEqual([
      'a',
      'b',
    ]);
  });

  it('여러 개를 고르면 모두 가진 모델만 남는다', () => {
    expect(
      ids(filterScenePaletteModels(categorizedModels(), ['indoor', 'crane'])),
    ).toEqual(['a']);
    expect(
      ids(filterScenePaletteModels(categorizedModels(), ['indoor', 'outdoor'])),
    ).toEqual([]);
  });

  it('대소문자를 가리지 않는다 — 카테고리를 품은 다른 카테고리는 다른 카테고리다', () => {
    expect(ids(filterScenePaletteModels(categorizedModels(), ['CRANE']))).toEqual([
      'a',
      'c',
    ]);
    expect(ids(filterScenePaletteModels(categorizedModels(), ['door']))).toEqual([]);
  });

  it('카테고리가 없는 모델은 카테고리를 고르면 빠진다', () => {
    expect(ids(filterScenePaletteModels(categorizedModels(), ['okpo']))).not.toContain(
      'd',
    );
  });

  it('빈 팔레트는 무엇을 골라도 비어 있고, 입력을 바꾸지 않는다', () => {
    expect(filterScenePaletteModels([], ['crane'])).toEqual([]);
    const models = categorizedModels();
    const selected = ['indoor'];
    filterScenePaletteModels(models, selected);
    expect(ids(models)).toEqual(['a', 'b', 'c', 'd']);
    expect(selected).toEqual(['indoor']);
  });
});

describe('toggleScenePaletteCategory', () => {
  it('없는 카테고리는 뒤에 붙는다 — 고른 순서가 칩의 순서다', () => {
    expect(toggleScenePaletteCategory([], 'okpo')).toEqual(['okpo']);
    expect(toggleScenePaletteCategory(['okpo'], 'crane')).toEqual(['okpo', 'crane']);
  });

  it('있는 카테고리는 빠지고 나머지 순서는 그대로다', () => {
    expect(toggleScenePaletteCategory(['okpo', 'crane', 'bay'], 'crane')).toEqual([
      'okpo',
      'bay',
    ]);
  });

  it('마지막 카테고리를 빼면 빈 목록(전체)이다', () => {
    expect(toggleScenePaletteCategory(['okpo'], 'okpo')).toEqual([]);
  });

  it('대소문자만 다른 카테고리는 같은 카테고리다 — 더하지 않고 뺀다', () => {
    expect(toggleScenePaletteCategory(['Crane'], 'crane')).toEqual([]);
    expect(toggleScenePaletteCategory(['crane'], 'CRANE')).toEqual([]);
  });

  it('같은 카테고리가 두 번 들어 있었어도 한 번에 다 빠진다', () => {
    expect(toggleScenePaletteCategory(['crane', 'okpo', 'Crane'], 'crane')).toEqual([
      'okpo',
    ]);
  });

  it('입력을 바꾸지 않는다', () => {
    const selected = ['okpo'];
    toggleScenePaletteCategory(selected, 'crane');
    toggleScenePaletteCategory(selected, 'okpo');
    expect(selected).toEqual(['okpo']);
  });
});

describe('pruneScenePaletteCategories', () => {
  it('전부 팔레트에 있는 카테고리면 받은 배열 그대로다', () => {
    const selected = ['indoor', 'CRANE'];
    expect(pruneScenePaletteCategories(categorizedModels(), selected)).toBe(selected);
  });

  it('고른 것이 없으면 받은 배열 그대로다 — 빈 팔레트에서도', () => {
    const selected: string[] = [];
    expect(pruneScenePaletteCategories(categorizedModels(), selected)).toBe(selected);
    expect(pruneScenePaletteCategories([], selected)).toBe(selected);
  });

  it('팔레트에서 없어진 카테고리만 빠지고 나머지 순서는 그대로다', () => {
    expect(
      pruneScenePaletteCategories(categorizedModels(), ['okpo', 'ghost', 'indoor']),
    ).toEqual(['okpo', 'indoor']);
  });

  it('팔레트가 비면(라이브러리를 읽는 중) 전부 빠진다', () => {
    expect(pruneScenePaletteCategories([], ['okpo'])).toEqual([]);
  });

  it('남은 모델이 0 이 되는 조합이어도 있는 카테고리는 빼지 않는다', () => {
    const selected = ['indoor', 'outdoor'];
    expect(pruneScenePaletteCategories(categorizedModels(), selected)).toBe(selected);
  });

  it('입력을 바꾸지 않는다', () => {
    const selected = ['okpo', 'ghost'];
    pruneScenePaletteCategories(categorizedModels(), selected);
    expect(selected).toEqual(['okpo', 'ghost']);
  });
});

describe('searchScenePaletteCategories', () => {
  const categories = () => listScenePaletteCategories(categorizedModels());

  it('검색어가 비거나 공백뿐이면 받은 배열 그대로다', () => {
    const all = categories();
    expect(searchScenePaletteCategories(all, '')).toBe(all);
    expect(searchScenePaletteCategories(all, '   ')).toBe(all);
  });

  it('이름에 검색어가 든 줄만 — 순서와 수는 그대로다', () => {
    expect(searchScenePaletteCategories(categories(), 'door')).toEqual([
      { category: 'indoor', count: 2, checked: false },
      { category: 'outdoor', count: 1, checked: false },
    ]);
  });

  it('대소문자와 앞뒤 공백을 가리지 않는다', () => {
    expect(
      searchScenePaletteCategories(categories(), '  CRA ').map((node) => node.category),
    ).toEqual(['crane']);
  });

  it('맞는 것이 없으면 빈 목록 — 빈 카테고리 목록도', () => {
    expect(searchScenePaletteCategories(categories(), 'zzz')).toEqual([]);
    expect(searchScenePaletteCategories([], 'crane')).toEqual([]);
  });
});
