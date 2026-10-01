import {
  ASSET_CATEGORY_MAX,
  AssetLibraryConflictError,
} from '@crane/domain/asset-library';
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AssetFileRef,
  AssetLibraryDocument,
  AssetLibraryRepository,
  AssetStatsTable,
  BuiltinAssetSource,
} from '@crane/domain/asset-library';
import {
  ASSET_FAVORITES_STORAGE_KEY,
  createAssetLibraryStore,
} from '../use-asset-library-store';

const builtin: BuiltinAssetSource = {
  id: 'okpo-ttc',
  kind: 'model',
  name: 'Okpo TTC',
  path: '/models/okpo_ttc.glb',
  category: 'outdoor',
  catalogId: 'okpo-ttc',
};

const emptyDocument: AssetLibraryDocument = {
  schemaVersion: 1,
  assets: [],
  collections: [],
};

/** 메모리 저장소 — 저장한 문서와 파일 호출을 기록한다. */
function createRepository(initial: AssetLibraryDocument = emptyDocument) {
  const saved: AssetLibraryDocument[] = [];
  const files = new Map<string, Blob>();
  const removed: string[] = [];
  let failSave = false;
  let conflictSave = false;
  let failPut = false;
  let loadCalls = 0;
  let table: AssetStatsTable = {};

  const repository: AssetLibraryRepository = {
    localOnly: true,
    load: async () => {
      loadCalls += 1;
      return initial;
    },
    loadStatsTable: async () => table,
    save: async (document) => {
      if (conflictSave) throw new AssetLibraryConflictError();
      if (failSave) throw new Error('save failed');
      saved.push(structuredClone(document));
    },
    putVersionFile: async (target, blob) => {
      if (failPut) throw new Error('put failed');
      const key = `files/${target.assetId}/v${target.version}/${target.fileName}`;
      files.set(key, blob);
      return { storage: 'browser', key } satisfies AssetFileRef;
    },
    putThumbnail: async (assetId, blob) => {
      if (failPut) throw new Error('put failed');
      const key = `thumbnails/${assetId}.png`;
      files.set(key, blob);
      return { storage: 'browser', key };
    },
    removeAssetFiles: async (assetId) => {
      removed.push(assetId);
    },
    removeVersionFiles: async (assetId, version) => {
      removed.push(`${assetId}@v${version}`);
    },
    resolveUrl: async () => null,
  };

  return {
    repository,
    saved,
    files,
    removed,
    get loadCalls() {
      return loadCalls;
    },
    setFailSave: (value: boolean) => {
      failSave = value;
    },
    setConflictSave: (value: boolean) => {
      conflictSave = value;
    },
    setFailPut: (value: boolean) => {
      failPut = value;
    },
    setTable: (value: AssetStatsTable) => {
      table = value;
    },
  };
}

function setup(initial?: AssetLibraryDocument) {
  const repo = createRepository(initial);
  let tick = 0;
  let id = 0;
  const store = createAssetLibraryStore({
    getRepository: () => repo.repository,
    getBuiltinSources: () => [builtin],
    loadSceneSources: async () => ({
      sources: [
        {
          sceneFile: 'okpo.json',
          regionIds: ['dock-1'],
          site: 'okpo',
          editorPath: '/outdoor-work/dock-1/3d-viewer-edit',
          modelPaths: ['/models/okpo_ttc.glb', '/models/okpo_ttc.glb'],
          mapPaths: [],
        },
      ],
      failed: ['broken.json'],
    }),
    // 호출마다 1분씩 흐르는 결정론적 시계.
    now: () => new Date(Date.UTC(2026, 0, 1, 0, tick++)).toISOString(),
    createId: () => `id-${++id}`,
  });
  return { store, repo };
}

const glbFile = (name = 'Crane Model.glb') =>
  new File([new Uint8Array([1, 2, 3, 4])], name);

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('load', () => {
  it('builtin 과 저장 문서를 합쳐 ready 가 된다', async () => {
    const { store } = setup();
    expect(store.getState().status).toBe('idle');
    await store.getState().load();
    const state = store.getState();
    expect(state.status).toBe('ready');
    expect(state.assets.map((a) => a.id)).toEqual(['okpo-ttc']);
    expect(state.localOnly).toBe(true);
  });

  it('동시에 여러 번 불러도, ready 뒤에 다시 불러도 한 번만 읽는다', async () => {
    const { store, repo } = setup();
    await Promise.all([store.getState().load(), store.getState().load()]);
    await store.getState().load();
    expect(repo.loadCalls).toBe(1);
  });

  it('읽기에 실패하면 error 가 되고 다시 부르면 재시도한다', async () => {
    const { store, repo } = setup();
    const load = vi
      .spyOn(repo.repository, 'load')
      .mockRejectedValueOnce(new Error('offline'));
    await store.getState().load();
    expect(store.getState().status).toBe('error');
    expect(store.getState().assets).toEqual([]);
    await store.getState().load();
    expect(store.getState().status).toBe('ready');
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('메타데이터·상태', () => {
  it('바꾸면 저장하고, 같은 값이면 저장하지 않으며 목록 참조를 유지한다', async () => {
    const { store, repo } = setup();
    await store.getState().load();

    expect(
      await store.getState().updateMetadata('okpo-ttc', { sites: ['okpo'] }, 'me'),
    ).toBe(true);
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].assets[0].sites).toEqual(['okpo']);

    const before = store.getState().assets;
    expect(
      await store.getState().updateMetadata('okpo-ttc', { sites: ['okpo'] }, 'me'),
    ).toBe(false);
    expect(store.getState().assets).toBe(before);
    expect(repo.saved).toHaveLength(1);
  });

  it('없는 자산은 false 이고 저장하지 않는다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    expect(await store.getState().updateMetadata('nope', { name: 'x' }, 'me')).toBe(false);
    expect(repo.saved).toHaveLength(0);
  });

  it('표가 허용하지 않는 상태 전이는 no-op', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    // builtin 버전 1 은 published — 바로 approved 로 갈 수 없다.
    expect(
      await store.getState().transitionStatus('okpo-ttc', 1, 'approved', 'me'),
    ).toBe(false);
    expect(
      await store.getState().transitionStatus('okpo-ttc', 1, 'withdrawn', 'me'),
    ).toBe(true);
    expect(store.getState().assets[0].versions[0].status).toBe('withdrawn');
    expect(repo.saved).toHaveLength(1);
  });

  it('통계는 비어 있을 때만 채운다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const stats = {
      triangles: 5,
      vertices: 5,
      meshes: 1,
      materials: 1,
      textures: 0,
      drawCalls: 1,
      nodes: 1,
      textureMemoryBytes: 0,
      size: null,
      lodLevels: 1,
      animations: 0,
    };
    expect(await store.getState().recordVersionStats('okpo-ttc', 1, stats)).toBe(true);
    expect(
      await store.getState().recordVersionStats('okpo-ttc', 1, { ...stats, triangles: 99 }),
    ).toBe(false);
    expect(store.getState().assets[0].versions[0].stats?.triangles).toBe(5);
    expect(repo.saved).toHaveLength(1);
  });
});

describe('저장 실패', () => {
  it('메모리 상태는 유지하고 saveState 가 error 가 되며 재시도로 복구한다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    repo.setFailSave(true);
    expect(
      await store.getState().updateMetadata('okpo-ttc', { name: 'Renamed' }, 'me'),
    ).toBe(false);
    expect(store.getState().saveState).toBe('error');
    expect(store.getState().assets[0].name).toBe('Renamed');

    repo.setFailSave(false);
    expect(await store.getState().retrySave()).toBe(true);
    expect(store.getState().saveState).toBe('idle');
    expect(repo.saved.at(-1)?.assets[0].name).toBe('Renamed');
  });

  it('앞선 저장이 실패해도 다음 저장은 진행하고 최신 상태를 담는다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    repo.setFailSave(true);
    const first = store.getState().updateMetadata('okpo-ttc', { name: 'One' }, 'me');
    repo.setFailSave(false);
    const second = store.getState().updateMetadata('okpo-ttc', { owner: 'kim' }, 'me');
    await Promise.all([first, second]);
    expect(store.getState().saveState).toBe('idle');
    expect(repo.saved.at(-1)?.assets[0]).toMatchObject({ name: 'One', owner: 'kim' });
  });
});

describe('importAsset', () => {
  it('파일을 저장하고 초안 자산을 만들어 저장한다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const record = await store.getState().importAsset(
      {
        file: glbFile(),
        kind: 'model',
        name: 'Crane Model',
        description: '',
        sites: ['philly'],
        tags: ['crane'],
        note: 'first',
        contentHash: 'sha256:abc',
      },
      'crane.ocean',
    );
    expect(record).toMatchObject({
      id: 'crane-model',
      origin: 'user',
      owner: 'crane.ocean',
      sites: ['philly'],
    });
    expect(record?.versions[0]).toMatchObject({
      version: 1,
      status: 'draft',
      note: 'first',
      file: {
        ref: { storage: 'browser', key: 'files/crane-model/v1/Crane-Model.glb' },
        fileName: 'Crane-Model.glb',
        format: 'glb',
        sizeBytes: 4,
        contentHash: 'sha256:abc',
      },
    });
    expect(repo.files.has('files/crane-model/v1/Crane-Model.glb')).toBe(true);
    expect(repo.saved.at(-1)?.assets.map((a) => a.id)).toEqual([
      'okpo-ttc',
      'crane-model',
    ]);
  });

  it('이미 있는 id 와 겹치면 번호를 붙인다', async () => {
    const { store } = setup();
    await store.getState().load();
    const input = {
      file: glbFile('a.glb'),
      kind: 'model' as const,
      name: 'Okpo TTC',
      description: '',
      sites: [],
      tags: [],
      note: '',
      contentHash: null,
    };
    expect((await store.getState().importAsset(input, 'me'))?.id).toBe('okpo-ttc-2');
    expect((await store.getState().importAsset(input, 'me'))?.id).toBe('okpo-ttc-3');
  });

  it('분류를 다듬어 싣고, 주지 않으면 비운다', async () => {
    const { store } = setup();
    await store.getState().load();
    const base = {
      file: glbFile(),
      kind: 'model' as const,
      description: '',
      sites: [],
      tags: [],
      note: '',
      contentHash: null,
    };
    const withCategory = await store
      .getState()
      .importAsset({ ...base, name: 'A', category: '  hull  ' }, 'me');
    expect(withCategory?.category).toBe('hull');
    const without = await store
      .getState()
      .importAsset({ ...base, name: 'B' }, 'me');
    expect(without?.category).toBe('');
    // 상한을 넘는 분류는 잘라 싣는다.
    const long = await store
      .getState()
      .importAsset({ ...base, name: 'C', category: 'x'.repeat(200) }, 'me');
    expect(long?.category).toHaveLength(ASSET_CATEGORY_MAX);
  });

  it('파일 저장이 실패하면 자산을 만들지 않는다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    repo.setFailPut(true);
    const record = await store.getState().importAsset(
      {
        file: glbFile(),
        kind: 'model',
        name: 'Crane',
        description: '',
        sites: [],
        tags: [],
        note: '',
        contentHash: null,
      },
      'me',
    );
    expect(record).toBeNull();
    expect(store.getState().assets).toHaveLength(1);
    expect(repo.saved).toHaveLength(0);
  });
});

describe('addVersion·saveThumbnail', () => {
  it('새 버전은 draft 로 붙고 현재 버전은 그대로다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const added = await store.getState().addVersion(
      'okpo-ttc',
      { file: glbFile('new.glb'), note: 'lighter', contentHash: 'sha256:v2' },
      'me',
    );
    expect(added).toBe(2);
    const asset = store.getState().assets[0];
    expect(asset.currentVersion).toBe(1);
    expect(asset.versions[1]).toMatchObject({ version: 2, status: 'draft', note: 'lighter' });
    expect(repo.files.has('files/okpo-ttc/v2/new.glb')).toBe(true);

    expect(await store.getState().setCurrentVersion('okpo-ttc', 2, 'me')).toBe(true);
    expect(store.getState().assets[0].currentVersion).toBe(2);
  });

  it('없는 자산·파일 저장 실패는 null', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const input = { file: glbFile(), note: '', contentHash: null };
    expect(await store.getState().addVersion('nope', input, 'me')).toBeNull();
    repo.setFailPut(true);
    expect(await store.getState().addVersion('okpo-ttc', input, 'me')).toBeNull();
    expect(store.getState().assets[0].versions).toHaveLength(1);
  });

  it('썸네일을 저장하고 참조를 붙인다. 파일 저장이 실패하면 그대로다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    expect(await store.getState().saveThumbnail('okpo-ttc', new Blob(['p']), 'me')).toBe(true);
    expect(store.getState().assets[0].thumbnail?.ref).toEqual({
      storage: 'browser',
      key: 'thumbnails/okpo-ttc.png',
    });
    expect(store.getState().assets[0].history.at(-1)?.action).toBe('thumbnail');
    repo.setFailPut(true);
    const before = store.getState().assets;
    expect(await store.getState().saveThumbnail('okpo-ttc', new Blob(['p']), 'me')).toBe(false);
    expect(store.getState().assets).toBe(before);
  });

  it('행위자 없이 저장한 썸네일(자동 생성)은 이력을 남기지 않는다', async () => {
    const { store } = setup();
    await store.getState().load();
    expect(await store.getState().saveThumbnail('okpo-ttc', new Blob(['p']), null)).toBe(true);
    expect(store.getState().assets[0].thumbnail).toBeDefined();
    expect(store.getState().assets[0].history).toEqual([]);
  });
});

describe('removeAsset', () => {
  it('builtin 자산은 지울 수 없다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    expect(await store.getState().removeAsset('okpo-ttc')).toBe(false);
    expect(store.getState().assets).toHaveLength(1);
    expect(repo.removed).toEqual([]);
  });

  it('사용자 자산을 지우면 파일·컬렉션·연결·즐겨찾기에서도 빠진다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const record = await store.getState().importAsset(
      {
        file: glbFile(),
        kind: 'model',
        name: 'Temp',
        description: '',
        sites: [],
        tags: [],
        note: '',
        contentHash: null,
      },
      'me',
    );
    const id = record!.id;
    const collectionId = (await store.getState().createCollection('Yard'))!;
    await store.getState().setCollectionMembership(collectionId, [id, 'okpo-ttc'], true);
    await store.getState().updateMetadata('okpo-ttc', { relatedAssetIds: [id] }, 'me');
    store.getState().toggleFavorite(id);

    expect(await store.getState().removeAsset(id)).toBe(true);
    const state = store.getState();
    expect(state.assets.map((a) => a.id)).toEqual(['okpo-ttc']);
    expect(state.assets[0].relatedAssetIds).toEqual([]);
    expect(state.collections[0].assetIds).toEqual(['okpo-ttc']);
    expect(state.favorites).toEqual([]);
    expect(repo.removed).toEqual([id]);
  });

  it('파일 삭제가 실패해도 문서에서는 빠진다(고아 파일로 남는다)', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const record = await store.getState().importAsset(
      {
        file: glbFile(),
        kind: 'model',
        name: 'Temp',
        description: '',
        sites: [],
        tags: [],
        note: '',
        contentHash: null,
      },
      'me',
    );
    vi.spyOn(repo.repository, 'removeAssetFiles').mockRejectedValue(new Error('io'));
    expect(await store.getState().removeAsset(record!.id)).toBe(true);
    expect(store.getState().assets).toHaveLength(1);
  });
});

describe('컬렉션', () => {
  it('이름을 다듬어 만들고, 빈 이름·같은 이름은 거부한다', async () => {
    const { store } = setup();
    await store.getState().load();
    const id = await store.getState().createCollection('  Yard A  ');
    expect(id).toBe('yard-a');
    expect(store.getState().collections).toEqual([
      { id: 'yard-a', name: 'Yard A', assetIds: [] },
    ]);
    expect(await store.getState().createCollection('   ')).toBeNull();
    expect(await store.getState().createCollection('Yard A')).toBeNull();
    expect(store.getState().collections).toHaveLength(1);
  });

  it('소속 변경은 아는 자산만 받고, 변화가 없으면 no-op', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const id = (await store.getState().createCollection('Yard'))!;
    const savedBefore = repo.saved.length;

    expect(await store.getState().setCollectionMembership(id, ['ghost'], true)).toBe(false);
    expect(await store.getState().setCollectionMembership(id, ['okpo-ttc'], true)).toBe(true);
    // 이미 속해 있다.
    expect(await store.getState().setCollectionMembership(id, ['okpo-ttc'], true)).toBe(false);
    expect(await store.getState().setCollectionMembership(id, ['okpo-ttc'], false)).toBe(true);
    // 이미 빠져 있다.
    expect(await store.getState().setCollectionMembership(id, ['okpo-ttc'], false)).toBe(false);
    expect(await store.getState().setCollectionMembership('nope', ['okpo-ttc'], true)).toBe(false);
    expect(repo.saved.length).toBe(savedBefore + 2);
  });

  it('이름 바꾸기·삭제', async () => {
    const { store } = setup();
    await store.getState().load();
    const a = (await store.getState().createCollection('A'))!;
    await store.getState().createCollection('B');
    expect(await store.getState().renameCollection(a, 'B')).toBe(false);
    expect(await store.getState().renameCollection(a, 'A')).toBe(false);
    expect(await store.getState().renameCollection(a, 'C')).toBe(true);
    expect(await store.getState().removeCollection(a)).toBe(true);
    expect(await store.getState().removeCollection(a)).toBe(false);
    expect(store.getState().collections.map((c) => c.name)).toEqual(['B']);
  });
});

describe('즐겨찾기', () => {
  it('토글하고 localStorage 에 남긴다', async () => {
    const { store } = setup();
    store.getState().toggleFavorite('okpo-ttc');
    expect(store.getState().favorites).toEqual(['okpo-ttc']);
    expect(
      JSON.parse(window.localStorage.getItem(ASSET_FAVORITES_STORAGE_KEY) ?? ''),
    ).toEqual(['okpo-ttc']);
    store.getState().toggleFavorite('okpo-ttc');
    expect(store.getState().favorites).toEqual([]);
  });

  it('저장된 값이 배열이 아니거나 오염돼 있으면 문자열만 살린다', () => {
    window.localStorage.setItem(ASSET_FAVORITES_STORAGE_KEY, '{"a":1}');
    expect(setup().store.getState().favorites).toEqual([]);
    window.localStorage.setItem(
      ASSET_FAVORITES_STORAGE_KEY,
      JSON.stringify(['a', 3, null, 'b']),
    );
    expect(setup().store.getState().favorites).toEqual(['a', 'b']);
    window.localStorage.setItem(ASSET_FAVORITES_STORAGE_KEY, '{broken');
    expect(setup().store.getState().favorites).toEqual([]);
  });
});

describe('loadUsage', () => {
  it('씬의 배치 개수를 인덱스로 만들고 실패한 씬을 알린다', async () => {
    const { store } = setup();
    await store.getState().loadUsage();
    const state = store.getState();
    expect(state.usageStatus).toBe('ready');
    expect(state.usageIndex.get('/models/okpo_ttc.glb')?.[0].count).toBe(2);
    expect(state.usageFailedScenes).toEqual(['broken.json']);
  });

  it('씬 읽기가 통째로 실패하면 error', async () => {
    const repo = createRepository();
    const store = createAssetLibraryStore({
      getRepository: () => repo.repository,
      getBuiltinSources: () => [],
      loadSceneSources: () => Promise.reject(new Error('boom')),
    });
    await store.getState().loadUsage();
    expect(store.getState().usageStatus).toBe('error');
    expect(store.getState().usageIndex.size).toBe(0);
  });
});

describe('읽기 전·읽기 실패 상태에서는 고치지도 저장하지도 않는다', () => {
  const input = {
    file: glbFile(),
    kind: 'model' as const,
    name: 'Crane',
    description: '',
    sites: [],
    tags: [],
    note: '',
    contentHash: null,
  };

  it('읽기 전(idle)에는 어떤 변경도 문서를 쓰지 않는다', async () => {
    const { store, repo } = setup();
    expect(await store.getState().createCollection('Yard')).toBeNull();
    expect(await store.getState().importAsset(input, 'me')).toBeNull();
    expect(
      await store.getState().updateMetadata('okpo-ttc', { name: 'X' }, 'me'),
    ).toBe(false);
    expect(await store.getState().retrySave()).toBe(false);
    expect(repo.saved).toHaveLength(0);
    expect(repo.files.size).toBe(0);
    expect(store.getState().collections).toEqual([]);
  });

  it('읽기에 실패한 뒤에도 빈 문서를 덮어쓰지 않는다', async () => {
    const { store, repo } = setup();
    vi.spyOn(repo.repository, 'load').mockRejectedValueOnce(
      new Error('offline'),
    );
    await store.getState().load();
    expect(store.getState().status).toBe('error');
    expect(await store.getState().createCollection('Yard')).toBeNull();
    expect(repo.saved).toHaveLength(0);
  });
});

describe('다른 곳에서 문서가 바뀌었을 때', () => {
  it('저장은 실패로 끝나고 conflict 로 남는다 — 뒤이은 성공이 감추지 않는다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    repo.setConflictSave(true);
    expect(
      await store.getState().updateMetadata('okpo-ttc', { name: 'A' }, 'me'),
    ).toBe(false);
    expect(store.getState().saveState).toBe('conflict');
    repo.setConflictSave(false);
    await store.getState().updateMetadata('okpo-ttc', { name: 'B' }, 'me');
    expect(store.getState().saveState).toBe('conflict');
  });

  it('다시 읽으면 풀리고, 저장 못 한 변경은 버려진다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    repo.setConflictSave(true);
    await store.getState().updateMetadata('okpo-ttc', { name: 'Mine' }, 'me');
    repo.setConflictSave(false);
    await store.getState().load({ force: true });
    expect(store.getState().saveState).toBe('idle');
    expect(repo.loadCalls).toBe(2);
    expect(store.getState().assets[0].name).not.toBe('Mine');
  });

  it('force 없이 다시 부르면 읽지 않는다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    await store.getState().load();
    expect(repo.loadCalls).toBe(1);
  });
});

describe('removeAsset — 저장 실패', () => {
  it('파일을 지우지 않고 화면도 지우기 전으로 되돌린다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const record = await store.getState().importAsset(
      {
        file: glbFile(),
        kind: 'model',
        name: 'Temp',
        description: '',
        sites: [],
        tags: [],
        note: '',
        contentHash: null,
      },
      'me',
    );
    const before = store.getState().assets;
    repo.setFailSave(true);
    expect(await store.getState().removeAsset(record!.id)).toBe(false);
    expect(repo.removed).toEqual([]);
    expect(store.getState().assets).toBe(before);
    expect(store.getState().saveState).toBe('error');
  });
});

describe('버전 지우기·일괄 작업', () => {
  const input = (name: string) => ({
    file: glbFile(`${name}.glb`),
    kind: 'model' as const,
    name,
    description: '',
    sites: [],
    tags: [],
    note: '',
    contentHash: null,
  });

  it('초안 버전을 지우면 그 버전의 파일만 지운다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const record = await store.getState().importAsset(input('Temp'), 'me');
    const added = await store
      .getState()
      .addVersion(record!.id, { file: glbFile('b.glb'), note: '', contentHash: null }, 'me');
    expect(added).toBe(2);
    expect(await store.getState().removeVersion(record!.id, 2, 'me')).toBe(true);
    expect(repo.removed).toEqual([`${record!.id}@v2`]);
    const after = store.getState().assets.find((a) => a.id === record!.id)!;
    expect(after.versions.map((v) => v.version)).toEqual([1]);
    // 지운 번호는 다시 쓰지 않는다.
    expect(
      await store
        .getState()
        .addVersion(record!.id, { file: glbFile('c.glb'), note: '', contentHash: null }, 'me'),
    ).toBe(3);
  });

  it('현재 버전은 지우지 않고 파일도 건드리지 않는다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const record = await store.getState().importAsset(input('Temp'), 'me');
    expect(await store.getState().removeVersion(record!.id, 1, 'me')).toBe(false);
    expect(repo.removed).toEqual([]);
  });

  it('여러 자산을 고쳐도 저장은 한 번이다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const a = await store.getState().importAsset(input('A'), 'me');
    const b = await store.getState().importAsset(input('B'), 'me');
    const before = repo.saved.length;
    const changed = await store
      .getState()
      .updateManyMetadata([a!.id, b!.id, 'nope'], () => ({ category: 'hull' }), 'me');
    expect(changed).toBe(2);
    expect(repo.saved.length).toBe(before + 1);
    expect(
      store.getState().assets.filter((x) => x.category === 'hull'),
    ).toHaveLength(2);
  });

  it('바뀐 것이 없으면 저장하지 않는다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const a = await store.getState().importAsset(input('A'), 'me');
    const before = repo.saved.length;
    expect(
      await store.getState().updateManyMetadata([a!.id], () => null, 'me'),
    ).toBe(0);
    expect(repo.saved.length).toBe(before);
  });

  it('일괄 상태 전환은 허용되는 자산만 옮긴다', async () => {
    const { store } = setup();
    await store.getState().load();
    const a = await store.getState().importAsset(input('A'), 'me');
    // a 는 초안, 내장 자산(okpo-ttc)은 게시됨 — 검토 요청은 a 에만 걸린다.
    const changed = await store
      .getState()
      .transitionManyStatus([a!.id, 'okpo-ttc'], 'in-review', 'me');
    expect(changed).toBe(1);
    const after = store.getState().assets.find((x) => x.id === a!.id)!;
    expect(after.versions[0].status).toBe('in-review');
  });

  it('일괄 삭제는 등록한 자산만 지우고, 저장에 실패하면 되돌린다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const a = await store.getState().importAsset(input('A'), 'me');
    const b = await store.getState().importAsset(input('B'), 'me');
    repo.setFailSave(true);
    const snapshot = store.getState().assets;
    expect(await store.getState().removeManyAssets([a!.id, b!.id])).toBe(0);
    expect(store.getState().assets).toBe(snapshot);
    expect(repo.removed).toEqual([]);
    repo.setFailSave(false);
    expect(
      await store.getState().removeManyAssets([a!.id, b!.id, 'okpo-ttc']),
    ).toBe(2);
    expect(repo.removed.sort()).toEqual([a!.id, b!.id].sort());
    expect(store.getState().assets.map((x) => x.id)).toEqual(['okpo-ttc']);
  });
});
