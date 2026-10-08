import {
  ASSET_LIBRARY_SCHEMA_VERSION,
  AssetLibraryConflictError,
  countAssetPlacements,
} from '@crane/domain/asset-library';
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AssetFileRef,
  AssetLibraryDocument,
  AssetLibraryRepository,
  AssetOptimizeKind,
  AssetRecord,
  AssetStatsTable,
  AssetUsageSource,
} from '@crane/domain/asset-library';
import {
  ASSET_FAVORITES_STORAGE_KEY,
  createAssetLibraryStore,
  toAssetUsageState,
} from '../use-asset-library-store';

/** 배포돼 있는 게시된 모델 — 파일은 옛 배포 경로에 있다. */
const okpoTtc: AssetRecord = {
  id: 'okpo-ttc',
  kind: 'model',
  name: 'Okpo TTC',
  description: '',
  categories: ['outdoor'],
  owner: '',
  relatedAssetIds: [],
  versions: [
    {
      version: 1,
      status: 'published',
      file: {
        ref: { storage: 'public', path: '/models/okpo_ttc.glb' },
        fileName: 'okpo_ttc.glb',
        format: 'glb',
        sizeBytes: null,
        contentHash: null,
      },
      note: '',
      createdAt: '',
      createdBy: 'system',
    },
  ],
  currentVersion: 1,
  createdAt: '',
  updatedAt: '',
  history: [],
};

const baseDocument: AssetLibraryDocument = {
  schemaVersion: ASSET_LIBRARY_SCHEMA_VERSION,
  assets: [okpoTtc],
  collections: [],
};

/** okpo.json 이 okpo-ttc v1 을 두 번 놓았다. */
const okpoScene: AssetUsageSource = {
  kind: 'scene',
  name: 'okpo.json',
  regionIds: ['dock-1'],
  editorPath: '/outdoor-work/dock-1/3d-viewer-edit',
  refs: [
    { path: '/models/okpo_ttc.glb', asset: { id: 'okpo-ttc', version: 1 } },
    { path: '/models/okpo_ttc.glb', asset: { id: 'okpo-ttc', version: 1 } },
  ],
};

/** 메모리 저장소 — 저장한 문서와 파일 호출을 기록한다. */
function createRepository(
  initial: AssetLibraryDocument = baseDocument,
  options: { canManageFiles?: boolean } = {},
) {
  const saved: AssetLibraryDocument[] = [];
  const files = new Map<string, Blob>();
  const removed: string[] = [];
  /** 자산을 지울 때 함께 넘어온 옛 배포 경로. */
  const removedLegacyPaths: string[][] = [];
  const optimizeRequests: (AssetOptimizeKind | null)[] = [];
  let failSave = false;
  let conflictSave = false;
  let failPut = false;
  let loadCalls = 0;
  let table: AssetStatsTable = {};

  const repository: AssetLibraryRepository = {
    localOnly: true,
    canManageFiles: options.canManageFiles ?? true,
    canOptimize: true,
    load: async () => {
      loadCalls += 1;
      return structuredClone(initial);
    },
    loadStatsTable: async () => table,
    save: async (document) => {
      if (conflictSave) throw new AssetLibraryConflictError();
      if (failSave) throw new Error('save failed');
      saved.push(structuredClone(document));
    },
    putVersionFile: async (target, blob, options) => {
      if (failPut) throw new Error('put failed');
      const key = `files/${target.assetId}/v${target.version}/${target.fileName}`;
      files.set(key, blob);
      optimizeRequests.push(options?.optimize ?? null);
      const ref = { storage: 'browser', key } satisfies AssetFileRef;
      // 최적화를 요청받으면 절반 크기로 줄어든 것으로 친다.
      return options?.optimize
        ? {
            ref,
            sizeBytes: Math.floor(blob.size / 2),
            optimized: true,
            report: [`${options.optimize} pipeline`],
          }
        : { ref, sizeBytes: blob.size, optimized: false, report: [] };
    },
    putThumbnail: async (assetId, blob) => {
      if (failPut) throw new Error('put failed');
      const key = `thumbnails/${assetId}.png`;
      files.set(key, blob);
      return { storage: 'browser', key };
    },
    removeAssetFiles: async (assetId, legacyPaths = []) => {
      removed.push(assetId);
      removedLegacyPaths.push([...legacyPaths]);
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
    removedLegacyPaths,
    optimizeRequests,
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

interface SetupOptions {
  initial?: AssetLibraryDocument;
  /** 씬이 쓰는 자산. 기본은 "아무 씬도 쓰지 않는다". */
  scenes?: AssetUsageSource[];
  /** 읽지 못한 씬 파일. */
  failedScenes?: string[];
  /** 화면 코드가 쓰는 자산. */
  code?: AssetUsageSource[];
  canManageFiles?: boolean;
}

function setup(options: SetupOptions = {}) {
  const repo = createRepository(options.initial, {
    canManageFiles: options.canManageFiles,
  });
  let tick = 0;
  let id = 0;
  // 테스트가 도중에 사용처를 바꿀 수 있다 — 지우기 직전에 다시 읽는지 본다.
  const usage = {
    scenes: options.scenes ?? [],
    failed: options.failedScenes ?? [],
    reads: 0,
  };
  const store = createAssetLibraryStore({
    getRepository: () => repo.repository,
    getCodeSources: () => options.code ?? [],
    loadSceneSources: async () => {
      usage.reads += 1;
      return { sources: usage.scenes, failed: usage.failed };
    },
    // 호출마다 1분씩 흐르는 결정론적 시계.
    now: () => new Date(Date.UTC(2026, 0, 1, 0, tick++)).toISOString(),
    createId: () => `id-${++id}`,
  });
  return { store, repo, usage };
}

const glbFile = (name = 'Crane Model.glb') =>
  new File([new Uint8Array([1, 2, 3, 4])], name);

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('load', () => {
  it('저장 문서를 읽어 ready 가 된다 — 문서가 자산의 유일한 원천이다', async () => {
    const { store } = setup();
    expect(store.getState().status).toBe('idle');
    await store.getState().load();
    const state = store.getState();
    expect(state.status).toBe('ready');
    expect(state.assets.map((a) => a.id)).toEqual(['okpo-ttc']);
    expect(state.localOnly).toBe(true);
    expect(state.canManageFiles).toBe(true);
  });

  it('빈 문서는 빈 라이브러리다 — 코드에서 채워지는 자산이 없다', async () => {
    const { store } = setup({
      initial: {
        schemaVersion: ASSET_LIBRARY_SCHEMA_VERSION,
        assets: [],
        collections: [],
      },
    });
    await store.getState().load();
    expect(store.getState().status).toBe('ready');
    expect(store.getState().assets).toEqual([]);
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
      await store
        .getState()
        .updateMetadata('okpo-ttc', { categories: ['outdoor', 'okpo'] }, 'me'),
    ).toBe(true);
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].assets[0].categories).toEqual(['outdoor', 'okpo']);

    const before = store.getState().assets;
    expect(
      await store
        .getState()
        .updateMetadata('okpo-ttc', { categories: ['outdoor', 'okpo'] }, 'me'),
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
    // 버전 1 은 published — 바로 approved 로 갈 수 없다.
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
        categories: ['crane', 'philly'],
        contentHash: 'sha256:abc',
      },
      'crane.ocean',
    );
    expect(record).toMatchObject({
      id: 'crane-model',
      owner: 'crane.ocean',
      categories: ['crane', 'philly'],
    });
    expect(record?.versions[0]).toMatchObject({
      version: 1,
      status: 'draft',
      // 첫 버전은 변경 메모 없이 시작한다.
      note: '',
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
      categories: [],
      contentHash: null,
    };
    expect((await store.getState().importAsset(input, 'me'))?.id).toBe('okpo-ttc-2');
    expect((await store.getState().importAsset(input, 'me'))?.id).toBe('okpo-ttc-3');
  });

  it('카테고리 없이 등록하면 종류 바로 아래에 놓인다(조선소·분류 필드는 없다)', async () => {
    const { store } = setup();
    await store.getState().load();
    const record = await store.getState().importAsset(
      {
        file: glbFile(),
        kind: 'model',
        name: 'Bare',
        description: '',
        categories: [],
        contentHash: null,
      },
      'me',
    );
    expect(record?.categories).toEqual([]);
    expect(record).not.toHaveProperty('sites');
    expect(record).not.toHaveProperty('category');
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
        categories: [],
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

  it('찍을 때의 카메라 자세를 썸네일에 함께 남기고, 없이 다시 찍으면 지운다', async () => {
    const { store } = setup();
    await store.getState().load();
    const view = {
      direction: [0, 0, 1] as [number, number, number],
      distance: 3,
      targetOffset: [0, 0, 0] as [number, number, number],
    };
    expect(await store.getState().saveThumbnail('okpo-ttc', new Blob(['p']), 'me', view)).toBe(true);
    expect(store.getState().assets[0].thumbnail?.view).toEqual(view);
    // 자세 없이 찍은 썸네일(배경 등)은 옛 자세를 물려받지 않는다.
    expect(await store.getState().saveThumbnail('okpo-ttc', new Blob(['p']), 'me', null)).toBe(true);
    expect(store.getState().assets[0].thumbnail).not.toHaveProperty('view');
  });
});

describe('removeAsset', () => {
  it('없는 자산은 false', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    expect(await store.getState().removeAsset('nope')).toBe(false);
    expect(repo.removed).toEqual([]);
  });

  it('자산을 지우면 파일·컬렉션·연결·즐겨찾기에서도 빠진다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const record = await store.getState().importAsset(
      {
        file: glbFile(),
        kind: 'model',
        name: 'Temp',
        description: '',
        categories: [],
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
        categories: [],
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

  it('같은 id 가 두 번 저장돼 있으면 한 번만 읽는다', () => {
    window.localStorage.setItem(
      ASSET_FAVORITES_STORAGE_KEY,
      JSON.stringify(['okpo-ttc', 'b', 'okpo-ttc']),
    );
    expect(setup().store.getState().favorites).toEqual(['okpo-ttc', 'b']);
  });
});

describe('즐겨찾기 — 없어진 자산', () => {
  const stored = () =>
    JSON.parse(window.localStorage.getItem(ASSET_FAVORITES_STORAGE_KEY) ?? 'null');

  it('라이브러리를 읽으면 없는 자산의 id 를 걷어내고 저장소에도 남기지 않는다', async () => {
    window.localStorage.setItem(
      ASSET_FAVORITES_STORAGE_KEY,
      JSON.stringify(['gone-a', 'okpo-ttc', 'gone-b']),
    );
    const { store } = setup();
    // 읽기 전에는 저장된 그대로다 — 무엇이 있는지 아직 모른다.
    expect(store.getState().favorites).toEqual(['gone-a', 'okpo-ttc', 'gone-b']);
    await store.getState().load();
    expect(store.getState().favorites).toEqual(['okpo-ttc']);
    expect(stored()).toEqual(['okpo-ttc']);
  });

  it('전부 없는 자산이면 빈 목록이 된다', async () => {
    window.localStorage.setItem(
      ASSET_FAVORITES_STORAGE_KEY,
      JSON.stringify(['gone']),
    );
    const { store } = setup();
    await store.getState().load();
    expect(store.getState().favorites).toEqual([]);
    expect(stored()).toEqual([]);
  });

  it('걷어낼 것이 없으면 목록 참조를 유지하고 저장소에 다시 쓰지 않는다', async () => {
    window.localStorage.setItem(
      ASSET_FAVORITES_STORAGE_KEY,
      JSON.stringify(['okpo-ttc']),
    );
    const { store } = setup();
    const before = store.getState().favorites;
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await store.getState().load();
    expect(store.getState().favorites).toBe(before);
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });

  it('즐겨찾기가 없으면 아무것도 쓰지 않는다', async () => {
    const { store } = setup();
    const before = store.getState().favorites;
    await store.getState().load();
    expect(store.getState().favorites).toBe(before);
    expect(stored()).toBeNull();
  });

  it('읽기에 실패하면 걷어내지 않는다 — 빈 목록으로 견줘 전부 지우지 않는다', async () => {
    window.localStorage.setItem(
      ASSET_FAVORITES_STORAGE_KEY,
      JSON.stringify(['okpo-ttc', 'gone']),
    );
    const { store, repo } = setup();
    vi.spyOn(repo.repository, 'load').mockRejectedValueOnce(new Error('offline'));
    await store.getState().load();
    expect(store.getState().status).toBe('error');
    expect(store.getState().favorites).toEqual(['okpo-ttc', 'gone']);
    expect(stored()).toEqual(['okpo-ttc', 'gone']);
    // 다시 읽어 성공하면 그때 걷어낸다.
    await store.getState().load();
    expect(store.getState().favorites).toEqual(['okpo-ttc']);
    expect(stored()).toEqual(['okpo-ttc']);
  });

  it('즐겨찾기해 둔 자산이 다시 읽었을 때 사라져 있으면 함께 걷힌다', async () => {
    const { store } = setup();
    await store.getState().load();
    const record = await store.getState().importAsset(
      {
        file: glbFile(),
        kind: 'model',
        name: 'Mine',
        description: '',
        categories: [],
        contentHash: null,
      },
      'me',
    );
    store.getState().toggleFavorite(record!.id);
    // 저장소의 문서에 그 자산이 없는 채(이 테스트의 저장소는 처음 문서를
    // 돌려준다) 다시 읽으면 사라진 자산이다 — 즐겨찾기도 걷힌다.
    await store.getState().load({ force: true });
    expect(store.getState().assets.map((a) => a.id)).toEqual(['okpo-ttc']);
    expect(store.getState().favorites).toEqual([]);
  });
});

const codeUse = (id: string, path: string): AssetUsageSource => ({
  kind: 'code',
  name: 'crane-type-model',
  regionIds: [],
  editorPath: '',
  refs: [{ path, asset: { id, version: 1 } }],
});

describe('loadUsage', () => {
  it('씬의 배치 개수를 인덱스로 만들고 실패한 씬을 알린다', async () => {
    const { store } = setup({
      scenes: [okpoScene],
      failedScenes: ['broken.json'],
    });
    await store.getState().loadUsage();
    const state = store.getState();
    expect(state.usageStatus).toBe('ready');
    expect(countAssetPlacements(okpoTtc, state.usageIndex)).toBe(2);
    expect(state.usageFailedScenes).toEqual(['broken.json']);
    // 읽지 못한 씬이 있으면 사용처를 다 안다고 보지 않는다.
    expect(toAssetUsageState(state).known).toBe(false);
  });

  it('씬을 전부 읽으면 사용처를 다 아는 상태다', async () => {
    const { store } = setup({ scenes: [okpoScene] });
    expect(toAssetUsageState(store.getState()).known).toBe(false);
    await store.getState().loadUsage();
    expect(toAssetUsageState(store.getState()).known).toBe(true);
  });

  it('화면 코드가 쓰는 자산은 씬을 읽기 전부터 사용처에 있다', () => {
    const { store } = setup({
      code: [codeUse('okpo-ttc', '/models/okpo_ttc.glb')],
    });
    expect(store.getState().usageStatus).toBe('idle');
    expect(countAssetPlacements(okpoTtc, store.getState().usageIndex)).toBe(1);
  });

  it('씬과 코드의 사용을 합쳐 센다', async () => {
    const { store } = setup({
      scenes: [okpoScene],
      code: [codeUse('okpo-ttc', '/models/okpo_ttc.glb')],
    });
    await store.getState().loadUsage();
    expect(countAssetPlacements(okpoTtc, store.getState().usageIndex)).toBe(3);
  });

  it('씬 읽기가 통째로 실패하면 error — 코드가 쓰는 자산은 사용처에 남는다', async () => {
    const repo = createRepository();
    const store = createAssetLibraryStore({
      getRepository: () => repo.repository,
      getCodeSources: () => [codeUse('okpo-ttc', '/models/okpo_ttc.glb')],
      loadSceneSources: () => Promise.reject(new Error('boom')),
    });
    await store.getState().loadUsage();
    const state = store.getState();
    expect(state.usageStatus).toBe('error');
    expect(countAssetPlacements(okpoTtc, state.usageIndex)).toBe(1);
    expect(toAssetUsageState(state).known).toBe(false);
  });

  it('동시에 여러 번 불러도 씬은 한 번만 읽는다', async () => {
    const { store, usage } = setup({ scenes: [okpoScene] });
    await Promise.all([store.getState().loadUsage(), store.getState().loadUsage()]);
    expect(usage.reads).toBe(1);
  });

  it('이미 읽은 뒤 다시 읽는 동안에는 "읽는 중" 으로 되돌아가지 않는다', async () => {
    const { store } = setup({ scenes: [okpoScene] });
    await store.getState().loadUsage();
    const again = store.getState().loadUsage();
    expect(store.getState().usageStatus).toBe('ready');
    await again;
    expect(store.getState().usageStatus).toBe('ready');
  });
});

describe('쓰이고 있는 자산의 보호', () => {
  it('씬에 놓인 자산은 지우지 않는다 — 문서도 파일도 그대로', async () => {
    const { store, repo } = setup({ scenes: [okpoScene] });
    await store.getState().load();
    expect(await store.getState().removeAsset('okpo-ttc')).toBe(false);
    expect(store.getState().assets.map((a) => a.id)).toEqual(['okpo-ttc']);
    expect(repo.saved).toHaveLength(0);
    expect(repo.removed).toEqual([]);
  });

  it('화면 코드가 쓰는 자산도 지우지 않는다', async () => {
    const { store, repo } = setup({
      code: [codeUse('okpo-ttc', '/models/okpo_ttc.glb')],
    });
    await store.getState().load();
    expect(await store.getState().removeAsset('okpo-ttc')).toBe(false);
    expect(repo.removed).toEqual([]);
  });

  it('어디에서도 쓰이지 않으면 지우고, 옛 배포 경로의 파일을 함께 넘긴다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    expect(await store.getState().removeAsset('okpo-ttc')).toBe(true);
    expect(store.getState().assets).toEqual([]);
    expect(repo.removed).toEqual(['okpo-ttc']);
    expect(repo.removedLegacyPaths).toEqual([['/models/okpo_ttc.glb']]);
  });

  it('남는 자산이 같은 파일을 가리키면 그 경로는 넘기지 않는다', async () => {
    const twin: AssetRecord = { ...okpoTtc, id: 'okpo-ttc-twin' };
    const { store, repo } = setup({
      initial: { ...baseDocument, assets: [okpoTtc, twin] },
    });
    await store.getState().load();
    expect(await store.getState().removeAsset('okpo-ttc')).toBe(true);
    expect(repo.removedLegacyPaths).toEqual([[]]);
  });

  it('읽지 못한 씬이 있으면 안 쓰이는 것처럼 보여도 지우지 않는다', async () => {
    const { store, repo } = setup({ failedScenes: ['broken.json'] });
    await store.getState().load();
    expect(await store.getState().removeAsset('okpo-ttc')).toBe(false);
    expect(repo.removed).toEqual([]);
  });

  it('씬 읽기가 실패하면 지우지 않는다', async () => {
    const repo = createRepository();
    const store = createAssetLibraryStore({
      getRepository: () => repo.repository,
      getCodeSources: () => [],
      loadSceneSources: () => Promise.reject(new Error('offline')),
    });
    await store.getState().load();
    expect(await store.getState().removeAsset('okpo-ttc')).toBe(false);
    expect(repo.removed).toEqual([]);
  });

  it('지우기 직전에 사용처를 다시 읽는다 — 화면을 연 뒤 놓인 것도 막는다', async () => {
    const { store, repo, usage } = setup();
    await store.getState().load();
    await store.getState().loadUsage();
    // 처음 읽었을 때는 안 쓰였다. 그 뒤 씬에 놓였다.
    usage.scenes = [okpoScene];
    expect(await store.getState().removeAsset('okpo-ttc')).toBe(false);
    expect(usage.reads).toBe(2);
    expect(repo.removed).toEqual([]);
  });

  it('쓰이는 버전은 철회하지 않는다', async () => {
    const { store, repo } = setup({ scenes: [okpoScene] });
    await store.getState().load();
    expect(
      await store.getState().transitionStatus('okpo-ttc', 1, 'withdrawn', 'me'),
    ).toBe(false);
    expect(store.getState().assets[0].versions[0].status).toBe('published');
    expect(repo.saved).toHaveLength(0);
  });

  it('쓰이지 않는 버전은 같은 자산의 다른 버전이 쓰여도 철회한다', async () => {
    const twoVersions: AssetRecord = {
      ...okpoTtc,
      versions: [
        okpoTtc.versions[0],
        {
          ...okpoTtc.versions[0],
          version: 2,
          file: {
            ...okpoTtc.versions[0].file,
            ref: {
              storage: 'public',
              path: '/asset-library/files/okpo-ttc/v2/okpo_ttc.glb',
            },
          },
        },
      ],
    };
    // 씬은 v1 만 쓴다.
    const { store } = setup({
      initial: { ...baseDocument, assets: [twoVersions] },
      scenes: [okpoScene],
    });
    await store.getState().load();
    expect(
      await store.getState().transitionStatus('okpo-ttc', 2, 'withdrawn', 'me'),
    ).toBe(true);
    expect(
      await store.getState().transitionStatus('okpo-ttc', 1, 'withdrawn', 'me'),
    ).toBe(false);
  });

  it('철회가 아닌 전이는 사용처를 읽지 않는다', async () => {
    const { store, usage } = setup({ scenes: [okpoScene] });
    await store.getState().load();
    await store.getState().importAsset(
      {
        file: glbFile(),
        kind: 'model',
        name: 'Draft',
        description: '',
        categories: [],
        contentHash: null,
      },
      'me',
    );
    expect(
      await store.getState().transitionStatus('draft', 1, 'in-review', 'me'),
    ).toBe(true);
    expect(usage.reads).toBe(0);
  });

  it('일괄 철회는 쓰이는 자산을 건너뛴다', async () => {
    const free: AssetRecord = {
      ...okpoTtc,
      id: 'free',
      versions: [
        {
          ...okpoTtc.versions[0],
          file: {
            ...okpoTtc.versions[0].file,
            ref: { storage: 'public', path: '/models/free.glb' },
          },
        },
      ],
    };
    const { store } = setup({
      initial: { ...baseDocument, assets: [okpoTtc, free] },
      scenes: [okpoScene],
    });
    await store.getState().load();
    expect(
      await store
        .getState()
        .transitionManyStatus(['okpo-ttc', 'free'], 'withdrawn', 'me'),
    ).toBe(1);
    const status = (id: string) =>
      store.getState().assets.find((a) => a.id === id)!.versions[0].status;
    expect(status('okpo-ttc')).toBe('published');
    expect(status('free')).toBe('withdrawn');
  });
});

describe('파일을 다룰 수 없는 환경(운영)', () => {
  const input = {
    file: glbFile(),
    kind: 'model' as const,
    name: 'Crane',
    description: '',
    categories: [],
    contentHash: null,
  };

  it('등록·새 버전·삭제는 아무것도 하지 않는다', async () => {
    const { store, repo } = setup({ canManageFiles: false });
    await store.getState().load();
    expect(store.getState().canManageFiles).toBe(false);

    expect(await store.getState().importAsset(input, 'me')).toBeNull();
    expect(
      await store
        .getState()
        .addVersion('okpo-ttc', { file: glbFile(), note: '', contentHash: null }, 'me'),
    ).toBeNull();
    expect(await store.getState().removeAsset('okpo-ttc')).toBe(false);
    expect(await store.getState().removeManyAssets(['okpo-ttc'])).toBe(0);
    expect(await store.getState().removeVersion('okpo-ttc', 1, 'me')).toBe(false);

    expect(repo.files.size).toBe(0);
    expect(repo.removed).toEqual([]);
    expect(repo.saved).toHaveLength(0);
    expect(store.getState().assets.map((a) => a.id)).toEqual(['okpo-ttc']);
  });

  it('이름·카테고리·상태 같은 문서 수정은 된다(이 브라우저에 저장된다)', async () => {
    const { store, repo } = setup({ canManageFiles: false });
    await store.getState().load();
    expect(
      await store.getState().updateMetadata('okpo-ttc', { name: 'Renamed' }, 'me'),
    ).toBe(true);
    expect(
      await store.getState().transitionStatus('okpo-ttc', 1, 'withdrawn', 'me'),
    ).toBe(true);
    expect(repo.saved).toHaveLength(2);
  });

  it('썸네일은 저장할 수 있다 — 처음 열 때 자동으로 찍힌다', async () => {
    const { store } = setup({ canManageFiles: false });
    await store.getState().load();
    expect(
      await store.getState().saveThumbnail('okpo-ttc', new Blob(['p']), null),
    ).toBe(true);
  });
});

describe('읽기 전·읽기 실패 상태에서는 고치지도 저장하지도 않는다', () => {
  const input = {
    file: glbFile(),
    kind: 'model' as const,
    name: 'Crane',
    description: '',
    categories: [],
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
        categories: [],
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
    categories: [],
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
      .updateManyMetadata([a!.id, b!.id, 'nope'], () => ({ categories: ['hull'] }), 'me');
    expect(changed).toBe(2);
    expect(repo.saved.length).toBe(before + 1);
    expect(
      store.getState().assets.filter((x) => x.categories.includes('hull')),
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

  it('일괄 삭제는 쓰이지 않는 자산만 지우고, 저장에 실패하면 되돌린다', async () => {
    // okpo-ttc 는 씬에 놓여 있다 — 고른 목록에 있어도 남는다.
    const { store, repo } = setup({ scenes: [okpoScene] });
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

describe('등록 시 최적화', () => {
  const base = {
    description: '',
    categories: [],
    contentHash: 'sha256:orig',
  };

  it('모델 GLB 에 요청하면 최적화해 저장하고 원본 크기를 남긴다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    expect(store.getState().canOptimize).toBe(true);
    const record = await store.getState().importAsset(
      { ...base, file: glbFile(), kind: 'model', name: 'Opt', optimize: true },
      'me',
    );
    expect(repo.optimizeRequests).toEqual(['model']);
    expect(record?.versions[0].file).toMatchObject({
      sizeBytes: 2,
      originalSizeBytes: 4,
      // 해시는 올린 원본의 것이다.
      contentHash: 'sha256:orig',
    });
  });

  it('요청하지 않으면 올린 그대로 — 원본 크기 필드가 없다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const record = await store
      .getState()
      .importAsset({ ...base, file: glbFile(), kind: 'model', name: 'Raw' }, 'me');
    expect(repo.optimizeRequests).toEqual([null]);
    expect(record?.versions[0].file.sizeBytes).toBe(4);
    expect(record?.versions[0].file).not.toHaveProperty('originalSizeBytes');
    // 요청하지 않은 일은 알리지 않는다.
    expect(store.getState().fileReport).toMatchObject({
      requested: false,
      optimized: false,
      lines: [],
    });
  });

  it('지도는 지도 파이프라인으로 최적화한다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const record = await store.getState().importAsset(
      { ...base, file: glbFile(), kind: 'map', name: 'Map', optimize: true },
      'me',
    );
    expect(repo.optimizeRequests).toEqual(['map']);
    expect(record?.versions[0].file.originalSizeBytes).toBe(4);
  });

  it('지도 파이프라인이 지운 루트 오프셋은 새 지도의 기본 위치가 된다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    vi.spyOn(repo.repository, 'putVersionFile').mockResolvedValue({
      ref: { storage: 'public', path: '/asset-library/files/terrain/v1/t.glb' },
      sizeBytes: 2,
      optimized: true,
      report: ['루트 오프셋 (515.305, 0, -814.879) 제거'],
      rootOffset: [515.305, 0, -814.879],
    });
    const record = await store.getState().importAsset(
      { ...base, file: glbFile(), kind: 'map', name: 'Terrain', optimize: true },
      'me',
    );
    expect(record?.placement).toEqual({
      defaultPosition: [515.305, 0, -814.879],
    });
  });

  it('루트 오프셋은 새 버전에는 적용하지 않는다 — 기본 위치는 그 자산의 것이다', async () => {
    const map: AssetRecord = {
      ...okpoTtc,
      id: 'map-a',
      kind: 'map',
      placement: { defaultPosition: [1, 2, 3] },
    };
    const { store, repo } = setup({
      initial: { ...baseDocument, assets: [map] },
    });
    await store.getState().load();
    vi.spyOn(repo.repository, 'putVersionFile').mockResolvedValue({
      ref: { storage: 'public', path: '/asset-library/files/map-a/v2/a.glb' },
      sizeBytes: 2,
      optimized: true,
      report: [],
      rootOffset: [9, 9, 9],
    });
    await store
      .getState()
      .addVersion('map-a', { file: glbFile(), note: '', contentHash: null }, 'me');
    expect(store.getState().assets[0].placement).toEqual({
      defaultPosition: [1, 2, 3],
    });
  });

  it('GLB 가 아닌 종류(도면·배경)에는 요청해도 걸지 않는다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    await store.getState().importAsset(
      {
        ...base,
        file: new File([new Uint8Array([1])], 'plan.pdf'),
        kind: 'drawing',
        name: 'Plan',
        optimize: true,
      },
      'me',
    );
    await store.getState().importAsset(
      {
        ...base,
        file: new File([new Uint8Array([1])], 'sky.exr'),
        kind: 'environment',
        name: 'Sky',
        optimize: true,
      },
      'me',
    );
    expect(repo.optimizeRequests).toEqual([null, null]);
  });

  it('파이프라인이 한 일을 fileReport 로 남긴다', async () => {
    const { store } = setup();
    await store.getState().load();
    expect(store.getState().fileReport).toBeNull();
    const record = await store.getState().importAsset(
      { ...base, file: glbFile(), kind: 'map', name: 'Map', optimize: true },
      'me',
    );
    expect(store.getState().fileReport).toEqual({
      assetId: record!.id,
      version: 1,
      requested: true,
      optimized: true,
      lines: ['map pipeline'],
    });
  });

  it('새 버전에도 같은 규칙이다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    const record = await store
      .getState()
      .importAsset({ ...base, file: glbFile(), kind: 'model', name: 'V' }, 'me');
    await store.getState().addVersion(
      record!.id,
      { file: glbFile('b.glb'), note: '', contentHash: null, optimize: true },
      'me',
    );
    expect(repo.optimizeRequests).toEqual([null, 'model']);
    const after = store.getState().assets.find((a) => a.id === record!.id)!;
    expect(after.versions[1].file.originalSizeBytes).toBe(4);
    expect(store.getState().fileReport).toMatchObject({
      assetId: record!.id,
      version: 2,
      requested: true,
      optimized: true,
    });
  });

  it('파일 저장에 실패한 새 버전은 fileReport 를 바꾸지 않는다', async () => {
    const { store, repo } = setup();
    await store.getState().load();
    repo.setFailPut(true);
    await store
      .getState()
      .addVersion('okpo-ttc', { file: glbFile(), note: '', contentHash: null }, 'me');
    expect(store.getState().fileReport).toBeNull();
  });
});
