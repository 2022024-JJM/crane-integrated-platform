import { describe, expect, it } from 'vitest';
import type { SceneModelCatalogItem } from '@crane/domain/3d';
import type {
  AssetFileRef,
  AssetRecord,
  AssetVersionStatus,
} from '@crane/domain/asset-library';
import {
  buildScenePaletteModels,
  listScenePaletteGroups,
  resolvePaletteGroup,
  selectPlaceableCatalog,
} from '../scene-palette';

const preview = { paddingScale: 1.2 };
const catalog: SceneModelCatalogItem[] = [
  {
    id: 'crane-a',
    label: 'Crane A',
    category: 'outdoor',
    path: '/models/crane_a.glb',
    defaultScale: [1, 1, 1],
    preview,
  },
  {
    id: 'bay-b',
    label: 'Bay B',
    category: 'indoor',
    path: '/models/bay_b.glb',
    defaultScale: [0.1, 0.1, 0.1],
    floating: true,
  },
];

function asset(patch: Partial<AssetRecord> & { id: string }, options: {
  status?: AssetVersionStatus;
  ref?: AssetFileRef;
} = {}): AssetRecord {
  return {
    kind: 'model',
    origin: 'builtin',
    name: patch.id,
    description: '',
    tags: [],
    owner: '',
    defaultScale: [1, 1, 1],
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

describe('buildScenePaletteModels — 라이브러리를 읽지 못했을 때', () => {
  it('카탈로그를 그대로 보이고 전부 놓을 수 있다', () => {
    const models = buildScenePaletteModels(catalog, null);
    expect(models.map((model) => model.item)).toEqual(catalog);
    expect(models.every((model) => model.blocked === null)).toBe(true);
    expect(models.map((model) => model.group)).toEqual(['outdoor', 'indoor']);
    expect(models.every((model) => model.status === null)).toBe(true);
  });

  it('빈 카탈로그는 빈 팔레트', () => {
    expect(buildScenePaletteModels([], null)).toEqual([]);
    expect(buildScenePaletteModels([], [])).toEqual([]);
  });
});

describe('buildScenePaletteModels — 카탈로그 자산', () => {
  it('이름·묶음은 라이브러리를 따르고 파일·기본 스케일은 카탈로그 것이다', () => {
    const [model] = buildScenePaletteModels(catalog, [
      asset({
        id: 'crane-a',
        name: '크레인 A',
        // 카탈로그는 outdoor 지만 라이브러리에서 indoor 태그로 옮겼다.
        tags: ['crane', 'indoor'],
        defaultScale: [2, 2, 2],
        catalogId: 'crane-a',
      }),
    ]);
    expect(model.item).toMatchObject({
      id: 'crane-a',
      label: '크레인 A',
      path: '/models/crane_a.glb',
      defaultScale: [1, 1, 1],
      category: 'outdoor',
    });
    // 놓는 방식에 관한 값(미리보기 프리셋 등)은 카탈로그 것을 유지한다.
    expect(model.item.preview).toBe(preview);
    expect(model.group).toBe('indoor');
    expect(model.assetId).toBe('crane-a');
  });

  it('묶음 태그가 없는 카탈로그 자산은 카탈로그의 분류로 묶인다', () => {
    const models = buildScenePaletteModels(catalog, [
      asset({ id: 'crane-a', tags: [] }),
      asset({ id: 'bay-b', tags: ['bay', 'okpo'] }),
    ]);
    expect(models.map((model) => model.group)).toEqual(['outdoor', 'indoor']);
  });

  it('떠 있는 모델 표시는 카탈로그에서 그대로 온다', () => {
    const models = buildScenePaletteModels(catalog, [asset({ id: 'bay-b' })]);
    expect(models[1].item.floating).toBe(true);
  });

  it('라이브러리에 없는 항목은 카탈로그 그대로, 놓을 수 있다', () => {
    const models = buildScenePaletteModels(catalog, []);
    expect(models[0]).toMatchObject({
      item: catalog[0],
      assetId: null,
      status: null,
      blocked: null,
    });
  });

  it('이름이 비어 있으면 카탈로그 이름을 쓴다', () => {
    const [model] = buildScenePaletteModels(catalog, [
      asset({ id: 'crane-a', name: '' }),
    ]);
    expect(model.item.label).toBe('Crane A');
  });

  it('게시된 것만 놓을 수 있다 — 나머지 상태는 전부 막힌다', () => {
    const blockedBy = (status: AssetVersionStatus) =>
      buildScenePaletteModels(catalog, [asset({ id: 'crane-a' }, { status })])[0]
        .blocked;
    expect(blockedBy('published')).toBeNull();
    for (const status of [
      'draft',
      'in-review',
      'approved',
      'rejected',
      'withdrawn',
    ] as const) {
      expect(blockedBy(status), status).toBe('unpublished');
    }
  });

  it('판정은 현재 버전의 상태로 한다', () => {
    const record = asset({ id: 'crane-a' });
    record.versions.push({
      ...record.versions[0],
      version: 2,
      status: 'draft',
    });
    expect(buildScenePaletteModels(catalog, [record])[0].blocked).toBeNull();
    record.currentVersion = 2;
    expect(buildScenePaletteModels(catalog, [record])[0].blocked).toBe(
      'unpublished',
    );
  });

  it('같은 id 의 등록 자산은 카탈로그 항목의 원천이 아니다', () => {
    const [model] = buildScenePaletteModels(
      [catalog[0]],
      [asset({ id: 'crane-a', origin: 'user', name: '남의 것' })],
    );
    expect(model.item.label).toBe('Crane A');
    expect(model.assetId).toBeNull();
  });
});

describe('buildScenePaletteModels — 썸네일', () => {
  it('배포 경로에 저장된 썸네일만 싣는다', () => {
    const withPublic = asset({
      id: 'crane-a',
      thumbnail: {
        ref: { storage: 'public', path: '/asset-library/thumbnails/a.png' },
        updatedAt: 't1',
      },
    });
    const withBrowser = asset({
      id: 'bay-b',
      thumbnail: {
        ref: { storage: 'browser', key: 'thumbnails/b.png' },
        updatedAt: 't2',
      },
    });
    const models = buildScenePaletteModels(catalog, [withPublic, withBrowser]);
    expect(models[0].thumbnail).toEqual({
      path: '/asset-library/thumbnails/a.png',
      stamp: 't1',
    });
    expect(models[1].thumbnail).toBeNull();
  });
});

describe('buildScenePaletteModels — 등록한 자산', () => {
  const user = (
    id: string,
    patch: Partial<AssetRecord> = {},
    options: { status?: AssetVersionStatus; ref?: AssetFileRef } = {},
  ) => asset({ id, origin: 'user', ...patch }, options);

  it('게시한 모델은 카탈로그 뒤에 이름순으로 붙고, 현재 버전의 파일을 놓는다', () => {
    const models = buildScenePaletteModels(catalog, [
      user('zeta', { name: 'Zeta' }),
      user(
        'alpha',
        { name: 'Alpha', tags: ['hull'], defaultScale: [3, 3, 3] },
        { ref: { storage: 'public', path: '/asset-library/files/alpha/v1/a.glb' } },
      ),
    ]);
    expect(models.map((model) => model.item.id)).toEqual([
      'crane-a',
      'bay-b',
      'alpha',
      'zeta',
    ]);
    expect(models[2]).toMatchObject({
      item: {
        id: 'alpha',
        label: 'Alpha',
        path: '/asset-library/files/alpha/v1/a.glb',
        defaultScale: [3, 3, 3],
        // 묶음이 정해지지 않으면 카탈로그 타입의 가장 가까운 값으로 채운다.
        category: 'outdoor',
      },
      // 묶음 태그(indoor·outdoor)가 없는 등록 자산은 빈 묶음에 모인다.
      group: '',
      blocked: null,
      fromCatalog: false,
    });
    expect(models[0].fromCatalog).toBe(true);
  });

  it('묶음 태그가 카탈로그 분류가 되되 map 은 묶음이 아니다', () => {
    const models = buildScenePaletteModels([], [
      user('a', { tags: ['crane', 'indoor'] }),
      user('b', { tags: ['map'] }),
    ]);
    expect(models.map((model) => model.item.category)).toEqual([
      'indoor',
      'outdoor',
    ]);
    expect(models.map((model) => model.group)).toEqual(['indoor', '']);
  });

  it('게시 전에는 보이지만 놓을 수 없다', () => {
    const [model] = buildScenePaletteModels([], [
      user('a', {}, { status: 'draft' }),
    ]);
    expect(model.blocked).toBe('unpublished');
  });

  it('이 브라우저에만 있는 파일은 게시해도 놓을 수 없다', () => {
    const [model] = buildScenePaletteModels([], [
      user('a', {}, { ref: { storage: 'browser', key: 'files/a/v1/a.glb' } }),
    ]);
    expect(model.blocked).toBe('local-file');
    expect(model.item.path).toBe('');
  });

  it('지도·도면·CAD 는 모델 팔레트에 나오지 않는다', () => {
    const models = buildScenePaletteModels([], [
      user('m', { kind: 'map' }),
      user('d', { kind: 'drawing' }),
      user('c', { kind: 'cad' }),
    ]);
    expect(models).toEqual([]);
  });

  it('카탈로그 밖 내장 자산(코드가 직접 로드)은 나오지 않는다', () => {
    expect(
      buildScenePaletteModels(catalog, [asset({ id: 'rt-forklift' })]).map(
        (model) => model.item.id,
      ),
    ).toEqual(['crane-a', 'bay-b']);
  });
});

describe('selectPlaceableCatalog', () => {
  it('내용이 같으면 직전 배열을 그대로 돌려준다', () => {
    const models = buildScenePaletteModels(catalog, [
      asset({ id: 'crane-a', name: 'Crane A' }),
      // 라이브러리에 남은 옛 스케일은 무시된다(카탈로그가 원천).
      asset({ id: 'bay-b', name: 'Bay B', defaultScale: [9, 9, 9] }),
    ]);
    expect(selectPlaceableCatalog(models, catalog)).toBe(catalog);
  });

  it('이름·개수 중 하나라도 달라지면 새 배열이다', () => {
    const renamed = buildScenePaletteModels(catalog, [
      asset({ id: 'crane-a', name: '다른 이름' }),
    ]);
    const next = selectPlaceableCatalog(renamed, catalog);
    expect(next).not.toBe(catalog);
    expect(next[0].label).toBe('다른 이름');

    const added = buildScenePaletteModels(catalog, [
      asset({ id: 'new-one', origin: 'user' }),
    ]);
    expect(selectPlaceableCatalog(added, catalog)).toHaveLength(3);
  });

  it('막힌 자산은 빠진다', () => {
    const models = buildScenePaletteModels(catalog, [
      asset({ id: 'crane-a' }, { status: 'withdrawn' }),
    ]);
    expect(selectPlaceableCatalog(models, catalog).map((item) => item.id)).toEqual([
      'bay-b',
    ]);
  });

  it('전부 막히면 빈 목록 — 직전이 비어 있었으면 그 배열을 유지한다', () => {
    const models = buildScenePaletteModels([catalog[0]], [
      asset({ id: 'crane-a' }, { status: 'draft' }),
    ]);
    const empty: SceneModelCatalogItem[] = [];
    expect(selectPlaceableCatalog(models, catalog)).toEqual([]);
    expect(selectPlaceableCatalog(models, empty)).toBe(empty);
  });
});

describe('listScenePaletteGroups', () => {
  it('카탈로그의 분류가 앞에 오고, 자산이 없어도 나온다', () => {
    expect(listScenePaletteGroups([], ['indoor', 'outdoor'])).toEqual([
      { group: 'indoor', count: 0 },
      { group: 'outdoor', count: 0 },
    ]);
  });

  it('묶음이 정해지지 않은 자산은 뒤의 빈 묶음에 모인다', () => {
    const models = buildScenePaletteModels(catalog, [
      asset({ id: 'crane-a', tags: ['indoor'] }),
      asset({ id: 'x', origin: 'user', tags: ['outdoor'] }),
      asset({ id: 'y', origin: 'user', tags: ['hull'] }),
      asset({ id: 'z', origin: 'user', tags: [] }),
    ]);
    expect(listScenePaletteGroups(models, ['indoor', 'outdoor'])).toEqual([
      { group: 'indoor', count: 2 },
      { group: 'outdoor', count: 1 },
      { group: '', count: 2 },
    ]);
  });

  it('그 밖의 묶음은 뒤에 이름순(숫자는 수로)으로 붙는다', () => {
    const model = (group: string) => ({
      ...buildScenePaletteModels(catalog, null)[0],
      group,
    });
    expect(
      listScenePaletteGroups(
        [model('yard 10'), model('yard 2'), model('')],
        ['indoor'],
      ).map((entry) => entry.group),
    ).toEqual(['indoor', '', 'yard 2', 'yard 10']);
  });
});

describe('resolvePaletteGroup', () => {
  it('묶음 태그가 있으면 그것이 묶음이다', () => {
    expect(resolvePaletteGroup(['crane', 'indoor'], 'outdoor')).toBe('indoor');
    expect(resolvePaletteGroup(['outdoor'], '')).toBe('outdoor');
  });

  it('둘 다 있으면 앞에 적힌 태그다', () => {
    expect(resolvePaletteGroup(['outdoor', 'indoor'], '')).toBe('outdoor');
    expect(resolvePaletteGroup(['indoor', 'outdoor'], '')).toBe('indoor');
  });

  it('대소문자를 가리지 않고, 묶음 이름은 소문자로 맞춘다', () => {
    expect(resolvePaletteGroup(['Indoor'], '')).toBe('indoor');
    expect(resolvePaletteGroup(['OUTDOOR'], 'indoor')).toBe('outdoor');
  });

  it('묶음 태그가 없으면 fallback — 빈 태그 목록도', () => {
    expect(resolvePaletteGroup([], 'outdoor')).toBe('outdoor');
    expect(resolvePaletteGroup(['crane', 'okpo'], '')).toBe('');
  });

  it('map 과 묶음 이름을 품은 다른 태그는 묶음이 아니다', () => {
    expect(resolvePaletteGroup(['map'], '')).toBe('');
    expect(resolvePaletteGroup(['indoors', 'outdoor-crane'], 'x')).toBe('x');
  });
});
