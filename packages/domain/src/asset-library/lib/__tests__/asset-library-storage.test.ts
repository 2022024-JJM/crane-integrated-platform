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

    const ref = await repo.putVersionFile(
      { assetId: 'a', version: 2, fileName: 'a.glb' },
      new Blob(['x']),
    );
    expect(ref).toEqual({ storage: 'browser', key: 'files/a/v2/a.glb' });
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
    const mine = await repo.putVersionFile(
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
    const ref = await repo.putVersionFile(
      { assetId: 'a', version: 3, fileName: 'a.glb' },
      blob,
    );
    expect(ref).toEqual({
      storage: 'public',
      path: '/asset-library/files/a/v3/a.glb',
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
