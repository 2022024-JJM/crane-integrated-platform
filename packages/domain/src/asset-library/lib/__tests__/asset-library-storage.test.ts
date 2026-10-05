// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAssetHashManifest } from '@crane/core/lib/asset-url';
import {
  ASSET_LIBRARY_DOCUMENT_PATH,
  ASSET_LIBRARY_REVISION_HEADER,
  DEV_ASSET_LIBRARY_API_PATH,
  hashAssetLibraryText,
} from '../../model/asset-library-paths';
import { createMemoryBlobStore } from '../asset-blob-store';
import {
  ASSET_LIBRARY_STORAGE_KEY,
  AssetLibraryConflictError,
  createBrowserAssetLibraryRepository,
  createDevAssetLibraryRepository,
} from '../asset-library-storage';
import { asset, document } from './fixtures';

const fetchMock = vi.fn<typeof fetch>();

function respond(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

const deployed = document([asset({ id: 'deployed' })]);
const local = document([asset({ id: 'local-edit' })]);

function storeEnvelope(baseVersion: string | null, doc = local) {
  window.localStorage.setItem(
    ASSET_LIBRARY_STORAGE_KEY,
    JSON.stringify({ baseVersion, document: doc }),
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  window.localStorage.clear();
  registerAssetHashManifest({ [ASSET_LIBRARY_DOCUMENT_PATH]: 'hash-now' });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  registerAssetHashManifest({});
});

describe('브라우저 저장소 — load', () => {
  it('로컬 저장본이 없으면 배포 문서를 읽는다', async () => {
    fetchMock.mockResolvedValue(respond(deployed));
    const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    expect((await repo.load()).assets.map((a) => a.id)).toEqual(['deployed']);
  });

  it('로컬 저장본이 현재 배포 기준이면 배포 문서를 받지 않고 그것을 쓴다', async () => {
    storeEnvelope('hash-now');
    const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    expect((await repo.load()).assets.map((a) => a.id)).toEqual(['local-edit']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('배포가 바뀌었으면 배포 문서가 이기고, 받은 뒤에 로컬을 지운다', async () => {
    storeEnvelope('hash-old');
    fetchMock.mockResolvedValue(respond(deployed));
    const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    expect((await repo.load()).assets.map((a) => a.id)).toEqual(['deployed']);
    expect(window.localStorage.getItem(ASSET_LIBRARY_STORAGE_KEY)).toBeNull();
  });

  it('배포 문서를 못 받으면 낡은 로컬로 폴백하고 로컬을 지우지 않는다', async () => {
    storeEnvelope('hash-old');
    fetchMock.mockRejectedValue(new Error('offline'));
    const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    expect((await repo.load()).assets.map((a) => a.id)).toEqual(['local-edit']);
    expect(window.localStorage.getItem(ASSET_LIBRARY_STORAGE_KEY)).not.toBeNull();
  });

  it('로컬도 없고 배포 문서도 못 받으면 던진다', async () => {
    fetchMock.mockResolvedValue(respond(null, 500));
    const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    await expect(repo.load()).rejects.toThrow('HTTP 500');
  });

  it('배포 문서가 아직 없으면(404) 빈 문서로 본다', async () => {
    fetchMock.mockResolvedValue(respond(null, 404));
    const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    expect(await repo.load()).toEqual(document());
  });

  it('손상된 JSON·봉투가 아닌 값은 무시하고 배포 문서를 읽는다', async () => {
    fetchMock.mockResolvedValue(respond(deployed));
    const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    for (const raw of ['{not json', '"text"', '{"assets":[]}', 'null']) {
      window.localStorage.setItem(ASSET_LIBRARY_STORAGE_KEY, raw);
      expect((await repo.load()).assets.map((a) => a.id)).toEqual(['deployed']);
    }
  });

  it('로컬 저장본도 정규화를 거친다', async () => {
    storeEnvelope('hash-now', {
      schemaVersion: 1,
      assets: [null, asset({ id: 'kept' }), { id: 'broken' }],
      collections: 'x',
    } as never);
    const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    const loaded = await repo.load();
    expect(loaded.assets.map((a) => a.id)).toEqual(['kept']);
    expect(loaded.collections).toEqual([]);
  });
});

describe('브라우저 저장소 — save·파일', () => {
  it('현재 배포 해시를 도장 찍어 봉투로 저장한다', async () => {
    const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    expect(repo.localOnly).toBe(true);
    await repo.save(local);
    expect(
      JSON.parse(window.localStorage.getItem(ASSET_LIBRARY_STORAGE_KEY) ?? ''),
    ).toEqual({ baseVersion: 'hash-now', revision: 1, document: local });
  });

  it('용량 초과는 삼키지 않고 던진다', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    await expect(repo.save(local)).rejects.toThrow('quota');
  });

  it('파일을 넣으면 브라우저 참조를 돌려주고 같은 키에는 URL 을 하나만 만든다', async () => {
    const createObjectURL = vi.fn(() => 'blob:one');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const blobs = createMemoryBlobStore();
    const repo = createBrowserAssetLibraryRepository(blobs);

    const stored = await repo.putVersionFile(
      { assetId: 'a', version: 2, fileName: 'a.glb' },
      new Blob(['x']),
      // 브라우저에서는 최적화할 수 없다 — 요청해도 올린 그대로 저장한다.
      { optimize: 'model' },
    );
    expect(repo.canOptimize).toBe(false);
    expect(stored).toEqual({
      ref: { storage: 'browser', key: 'files/a/v2/a.glb' },
      sizeBytes: 1,
      optimized: false,
      report: [],
    });
    const { ref } = stored;
    expect(await repo.resolveUrl(ref)).toBe('blob:one');
    expect(await repo.resolveUrl(ref)).toBe('blob:one');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('없는 파일의 URL 은 null, 배포 파일은 경로 그대로', async () => {
    const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    expect(await repo.resolveUrl({ storage: 'browser', key: 'files/x/v1/x.glb' })).toBeNull();
    expect(await repo.resolveUrl({ storage: 'public', path: '/models/a.glb' })).toBe(
      '/models/a.glb',
    );
  });

  it('자산 파일 삭제는 그 자산의 버전·썸네일만 지우고 URL 을 해제한다', async () => {
    const createObjectURL = vi.fn(() => 'blob:one');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const blobs = createMemoryBlobStore();
    const repo = createBrowserAssetLibraryRepository(blobs);
    const { ref: mine } = await repo.putVersionFile(
      { assetId: 'a', version: 1, fileName: 'a.glb' },
      new Blob(['x']),
    );
    await repo.putThumbnail('a', new Blob(['t']));
    // id 가 'a' 로 시작하는 다른 자산 — 접두어 매칭에 휩쓸리면 안 된다.
    await repo.putVersionFile(
      { assetId: 'ab', version: 1, fileName: 'b.glb' },
      new Blob(['y']),
    );
    await repo.resolveUrl(mine);

    await repo.removeAssetFiles('a');
    expect(await blobs.keys()).toEqual(['files/ab/v1/b.glb']);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:one');
    expect(await repo.resolveUrl(mine)).toBeNull();
  });

  it('통계 표를 못 받으면 빈 표(라이브러리는 열린다)', async () => {
    const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await repo.loadStatsTable()).toEqual({});
    fetchMock.mockResolvedValue(respond(null, 404));
    expect(await repo.loadStatsTable()).toEqual({});
    fetchMock.mockResolvedValue(
      respond({ '/models/a.glb': { hash: 'abcd', bytes: 5 } }),
    );
    expect(await repo.loadStatsTable()).toEqual({
      '/models/a.glb': { hash: 'abcd', bytes: 5 },
    });
  });
});

describe('dev 저장소', () => {
  it('문서를 미들웨어로 POST 한다', async () => {
    fetchMock.mockResolvedValue(respond({ ok: true }));
    const repo = createDevAssetLibraryRepository();
    expect(repo.localOnly).toBe(false);
    await repo.save(local);
    expect(fetchMock).toHaveBeenCalledWith(
      DEV_ASSET_LIBRARY_API_PATH,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(local) }),
    );
  });

  it('저장 실패(HTTP 에러)는 던진다', async () => {
    fetchMock.mockResolvedValue(respond(null, 500));
    await expect(createDevAssetLibraryRepository().save(local)).rejects.toThrow(
      'HTTP 500',
    );
  });

  it('파일은 키를 붙여 올리고 배포 경로 참조를 돌려준다', async () => {
    fetchMock.mockResolvedValue(respond({ ok: true }));
    const repo = createDevAssetLibraryRepository();
    const blob = new Blob(['x']);
    const stored = await repo.putVersionFile(
      { assetId: 'a', version: 3, fileName: 'a.glb' },
      blob,
    );
    expect(repo.canOptimize).toBe(true);
    // 서버가 크기를 알려 주지 않으면 올린 크기로 본다.
    expect(stored).toEqual({
      ref: { storage: 'public', path: '/asset-library/files/a/v3/a.glb' },
      sizeBytes: 1,
      optimized: false,
      report: [],
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${DEV_ASSET_LIBRARY_API_PATH}/file?key=files%2Fa%2Fv3%2Fa.glb`,
    );
    expect(init).toMatchObject({ method: 'POST', body: blob });
    expect(await repo.putThumbnail('a', blob)).toEqual({
      storage: 'public',
      path: '/asset-library/thumbnails/a.png',
    });
  });

  it('이미 있는 버전 경로(409)는 덮어쓰지 않고 던진다', async () => {
    fetchMock.mockResolvedValue(respond(null, 409));
    await expect(
      createDevAssetLibraryRepository().putVersionFile(
        { assetId: 'a', version: 1, fileName: 'a.glb' },
        new Blob(['x']),
      ),
    ).rejects.toThrow('HTTP 409');
  });

  it('브라우저 참조는 dev 저장소가 풀 수 없다(null)', async () => {
    expect(
      await createDevAssetLibraryRepository().resolveUrl({
        storage: 'browser',
        key: 'files/a/v1/a.glb',
      }),
    ).toBeNull();
  });
});

describe('읽을 수 없는 문서·레코드', () => {
  it('모양이 틀린 배포 문서는 빈 문서로 열지 않고 던진다', async () => {
    for (const body of [[], 'x', { assets: 'no' }, { schemaVersion: 99, assets: [] }]) {
      fetchMock.mockResolvedValue(respond(body));
      const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
      await expect(repo.load()).rejects.toThrow();
    }
  });

  it('읽지 못한 레코드는 저장할 때 원본 그대로 도로 붙는다(브라우저)', async () => {
    const broken = { id: 'BAD ID', keep: 'me' };
    fetchMock.mockResolvedValue(
      respond({ schemaVersion: 1, assets: [asset({ id: 'ok' }), broken] }),
    );
    const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    const loaded = await repo.load();
    expect(loaded.assets.map((a) => a.id)).toEqual(['ok']);
    await repo.save(loaded);
    const stored = JSON.parse(
      window.localStorage.getItem(ASSET_LIBRARY_STORAGE_KEY)!,
    );
    expect(stored.document.assets).toHaveLength(2);
    expect(stored.document.assets[1]).toEqual(broken);
  });

  it('읽지 못한 레코드는 저장할 때 원본 그대로 도로 붙는다(dev)', async () => {
    const broken = { id: 'BAD ID', keep: 'me' };
    fetchMock.mockResolvedValueOnce(
      respond({ schemaVersion: 1, assets: [asset({ id: 'ok' }), broken] }),
    );
    const repo = createDevAssetLibraryRepository();
    const loaded = await repo.load();
    fetchMock.mockResolvedValueOnce(respond({ ok: true, revision: 'r2' }));
    await repo.save(loaded);
    const body = JSON.parse(fetchMock.mock.calls[1][1]!.body as string);
    expect(body.assets[1]).toEqual(broken);
  });
});

describe('다른 곳에서 바뀐 문서를 덮어쓰지 않는다', () => {
  it('브라우저 — 다른 탭이 그사이 저장했으면 충돌로 던지고 쓰지 않는다', async () => {
    storeEnvelope('hash-now');
    const mine = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    const other = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    const myCopy = await mine.load();
    const otherCopy = await other.load();
    await other.save({ ...otherCopy, assets: [asset({ id: 'theirs' })] });
    await expect(mine.save(myCopy)).rejects.toBeInstanceOf(
      AssetLibraryConflictError,
    );
    const stored = JSON.parse(
      window.localStorage.getItem(ASSET_LIBRARY_STORAGE_KEY)!,
    );
    expect(stored.document.assets.map((a: { id: string }) => a.id)).toEqual([
      'theirs',
    ]);
  });

  it('브라우저 — 혼자 이어서 저장하면 충돌이 아니다', async () => {
    fetchMock.mockResolvedValue(respond(deployed));
    const repo = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    const copy = await repo.load();
    await repo.save(copy);
    await repo.save(copy);
    await expect(repo.save(copy)).resolves.toBeUndefined();
  });

  it('브라우저 — 다시 읽으면 충돌이 풀린다', async () => {
    storeEnvelope('hash-now');
    const mine = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    const other = createBrowserAssetLibraryRepository(createMemoryBlobStore());
    await mine.load();
    await other.save(await other.load());
    const fresh = await mine.load();
    await expect(mine.save(fresh)).resolves.toBeUndefined();
  });

  it('dev — 읽은 글자의 지문을 헤더로 싣고, 받은 새 지문으로 이어 쓴다', async () => {
    fetchMock.mockResolvedValueOnce(respond(deployed));
    const repo = createDevAssetLibraryRepository();
    const copy = await repo.load();
    fetchMock.mockResolvedValueOnce(respond({ ok: true, revision: 'rev-2' }));
    await repo.save(copy);
    fetchMock.mockResolvedValueOnce(respond({ ok: true, revision: 'rev-3' }));
    await repo.save(copy);
    const headerOf = (call: number) =>
      (fetchMock.mock.calls[call][1]!.headers as Record<string, string>)[
        ASSET_LIBRARY_REVISION_HEADER
      ];
    expect(headerOf(1)).toBe(hashAssetLibraryText(JSON.stringify(deployed)));
    expect(headerOf(2)).toBe('rev-2');
  });

  it('dev — 409 는 충돌로, 그 밖의 실패는 일반 오류로 던진다', async () => {
    fetchMock.mockResolvedValueOnce(respond(deployed));
    const repo = createDevAssetLibraryRepository();
    const copy = await repo.load();
    fetchMock.mockResolvedValueOnce(respond({}, 409));
    await expect(repo.save(copy)).rejects.toBeInstanceOf(
      AssetLibraryConflictError,
    );
    fetchMock.mockResolvedValueOnce(respond({}, 500));
    const failure = await repo.save(copy).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(AssetLibraryConflictError);
  });

  it('dev — 문서가 없던 곳(404)에서 시작하면 빈 지문을 싣는다', async () => {
    fetchMock.mockResolvedValueOnce(respond({}, 404));
    const repo = createDevAssetLibraryRepository();
    const copy = await repo.load();
    fetchMock.mockResolvedValueOnce(respond({ ok: true, revision: 'r' }));
    await repo.save(copy);
    expect(
      (fetchMock.mock.calls[1][1]!.headers as Record<string, string>)[
        ASSET_LIBRARY_REVISION_HEADER
      ],
    ).toBe('');
  });
});

describe('파일을 다룰 수 있는 환경(canManageFiles)', () => {
  it('dev 저장소는 올리고 지울 수 있고, 브라우저 저장소는 할 수 없다', () => {
    expect(createDevAssetLibraryRepository().canManageFiles).toBe(true);
    expect(
      createBrowserAssetLibraryRepository(createMemoryBlobStore()).canManageFiles,
    ).toBe(false);
  });
});

describe('dev 저장소 — 자산 파일 삭제', () => {
  const deleteUrl = () => {
    const [url, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe('DELETE');
    return new URL(String(url), 'http://localhost');
  };

  it('자산 id 만으로 지운다 — 옛 경로가 없으면 path 를 붙이지 않는다', async () => {
    fetchMock.mockResolvedValue(respond({ ok: true }));
    await createDevAssetLibraryRepository().removeAssetFiles('a');
    const url = deleteUrl();
    expect(url.searchParams.get('assetId')).toBe('a');
    expect(url.searchParams.getAll('path')).toEqual([]);
  });

  it('옛 배포 경로의 파일을 path 로 함께 보낸다', async () => {
    fetchMock.mockResolvedValue(respond({ ok: true }));
    await createDevAssetLibraryRepository().removeAssetFiles('okpo-ttc', [
      '/models/okpo_ttc.glb',
      '/maps/okpo.glb',
    ]);
    expect(deleteUrl().searchParams.getAll('path')).toEqual([
      '/models/okpo_ttc.glb',
      '/maps/okpo.glb',
    ]);
  });

  it('지워서는 안 되는 경로는 보내지 않는다(라이브러리 안 파일·씬 JSON·상위 탈출)', async () => {
    fetchMock.mockResolvedValue(respond({ ok: true }));
    await createDevAssetLibraryRepository().removeAssetFiles('a', [
      '/asset-library/files/a/v2/a.glb',
      '/scenes/okpo.json',
      '/models/../scenes/okpo.json',
      'models/a.glb',
      '/models/a.glb',
    ]);
    expect(deleteUrl().searchParams.getAll('path')).toEqual(['/models/a.glb']);
  });

  it('삭제 실패(HTTP 에러)는 던진다', async () => {
    fetchMock.mockResolvedValue(respond(null, 500));
    await expect(
      createDevAssetLibraryRepository().removeAssetFiles('a'),
    ).rejects.toThrow('HTTP 500');
  });
});

describe('dev 저장소 — 최적화 요청', () => {
  it('종류(optimize=model)를 붙여 올리고, 서버가 알려 준 크기·결과·보고를 돌려준다', async () => {
    fetchMock.mockResolvedValue(
      respond({ bytes: 40, optimized: true, report: ['meshopt 적용'] }),
    );
    const stored = await createDevAssetLibraryRepository().putVersionFile(
      { assetId: 'a', version: 1, fileName: 'a.glb' },
      new Blob(['x'.repeat(100)]),
      { optimize: 'model' },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${DEV_ASSET_LIBRARY_API_PATH}/file?key=files%2Fa%2Fv1%2Fa.glb&optimize=model`,
    );
    expect(stored).toMatchObject({
      sizeBytes: 40,
      optimized: true,
      report: ['meshopt 적용'],
    });
  });

  it('지도는 지도 파이프라인(optimize=map)으로 올린다', async () => {
    fetchMock.mockResolvedValue(respond({ bytes: 40, optimized: true }));
    await createDevAssetLibraryRepository().putVersionFile(
      { assetId: 'm', version: 2, fileName: 'm.glb' },
      new Blob(['x']),
      { optimize: 'map' },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${DEV_ASSET_LIBRARY_API_PATH}/file?key=files%2Fm%2Fv2%2Fm.glb&optimize=map`,
    );
  });

  it('최적화를 요청하지 않으면 optimize 를 붙이지 않는다', async () => {
    fetchMock.mockResolvedValue(respond({ bytes: 1 }));
    await createDevAssetLibraryRepository().putVersionFile(
      { assetId: 'a', version: 1, fileName: 'a.glb' },
      new Blob(['x']),
    );
    expect(fetchMock.mock.calls[0][0]).not.toContain('optimize');
  });

  it('서버가 최적화에 실패해 원본을 저장했으면 optimized 는 false 이고 이유가 보고에 온다', async () => {
    fetchMock.mockResolvedValue(
      respond({ bytes: 100, optimized: false, report: ['최적화 실패: boom'] }),
    );
    const stored = await createDevAssetLibraryRepository().putVersionFile(
      { assetId: 'a', version: 1, fileName: 'a.glb' },
      new Blob(['x'.repeat(100)]),
      { optimize: 'model' },
    );
    expect(stored).toMatchObject({
      sizeBytes: 100,
      optimized: false,
      report: ['최적화 실패: boom'],
    });
  });

  it('지도 파이프라인이 지운 루트 오프셋을 돌려준다', async () => {
    fetchMock.mockResolvedValue(
      respond({ bytes: 1, optimized: true, rootOffset: [515.305, 0, -814.879] }),
    );
    const stored = await createDevAssetLibraryRepository().putVersionFile(
      { assetId: 'm', version: 1, fileName: 'm.glb' },
      new Blob(['x']),
      { optimize: 'map' },
    );
    expect(stored.rootOffset).toEqual([515.305, 0, -814.879]);
  });

  it.each([
    ['없음', undefined],
    ['두 칸', [1, 2]],
    ['문자열이 섞임', [1, '2', 3]],
    ['NaN', [1, Number.NaN, 3]],
    ['배열이 아님', '1,2,3'],
  ])('루트 오프셋이 깨졌으면(%s) 필드를 싣지 않는다', async (_label, rootOffset) => {
    fetchMock.mockResolvedValue(respond({ bytes: 1, rootOffset }));
    const stored = await createDevAssetLibraryRepository().putVersionFile(
      { assetId: 'm', version: 1, fileName: 'm.glb' },
      new Blob(['x']),
    );
    expect(stored).not.toHaveProperty('rootOffset');
  });

  it('보고가 배열이 아니거나 문자열이 아닌 줄이 섞이면 문자열만 남긴다', async () => {
    const repo = createDevAssetLibraryRepository();
    fetchMock.mockResolvedValue(respond({ bytes: 1, report: 'done' }));
    expect(
      (
        await repo.putVersionFile(
          { assetId: 'a', version: 1, fileName: 'a.glb' },
          new Blob(['x']),
        )
      ).report,
    ).toEqual([]);
    fetchMock.mockResolvedValue(respond({ bytes: 1, report: ['a', 3, null, 'b'] }));
    expect(
      (
        await repo.putVersionFile(
          { assetId: 'a', version: 2, fileName: 'a.glb' },
          new Blob(['x']),
        )
      ).report,
    ).toEqual(['a', 'b']);
  });

  it('응답의 크기가 비정상이면 올린 크기로 본다', async () => {
    fetchMock.mockResolvedValue(respond({ bytes: 'big', optimized: 'yes' }));
    const stored = await createDevAssetLibraryRepository().putVersionFile(
      { assetId: 'a', version: 1, fileName: 'a.glb' },
      new Blob(['xyz']),
    );
    expect(stored).toMatchObject({ sizeBytes: 3, optimized: false });
  });
});
