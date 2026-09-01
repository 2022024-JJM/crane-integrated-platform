// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UnknownRegionError,
  isSceneStoredLocallyOnly,
  loadSceneInfoByRegionId,
  saveSceneInfoByRegionId,
} from '../scene-dev-storage';
import { registerAssetHashManifest } from '../asset-url';
import type { SavedSceneInfo } from '../../model/types';

/**
 * 등록된 region 'dock-1' → scenes/1dock.json 을 기준으로 저장·로드 왕복과
 * "배포 해시가 더 새로우면 로컬 저장본 폐기" 규칙을 특성화한다.
 * 배포 해시는 asset-url의 매니페스트 주입으로 통제한다.
 */
const REGION = 'dock-1';
const STORAGE_KEY = `crane:scene:${REGION}`;
const SCENE_MANIFEST_PATH = '/scenes/1dock.json';

function scene(environmentId?: string): SavedSceneInfo {
  const base: SavedSceneInfo = {
    maps: [],
    models: [],
    texts: [],
    camera: null,
  };
  return environmentId ? { ...base, environmentId } : base;
}

const fetchMock = vi.fn<typeof fetch>();

function fetchOk(body: unknown) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  registerAssetHashManifest({ [SCENE_MANIFEST_PATH]: 'hash-v1' });
  window.localStorage.clear();
});

afterEach(() => {
  fetchMock.mockReset();
  registerAssetHashManifest({});
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('미등록 region 방어', () => {
  it('저장은 환경과 무관하게 UnknownRegionError로 막는다', async () => {
    await expect(
      saveSceneInfoByRegionId('nowhere', scene()),
    ).rejects.toBeInstanceOf(UnknownRegionError);
    await expect(
      saveSceneInfoByRegionId('nowhere', scene()),
    ).rejects.toMatchObject({ regionId: 'nowhere' });
  });

  it('로드도 기본 파일로 대체하지 않고 UnknownRegionError를 던진다', async () => {
    await expect(loadSceneInfoByRegionId('nowhere')).rejects.toBeInstanceOf(
      UnknownRegionError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('dev 환경 (파일 저장 경유)', () => {
  // vitest의 import.meta.env.DEV 기본값이 true — 그대로 dev 분기를 탄다.
  it('저장은 /__dev/scene POST로 가고 서버 응답을 돌려준다', async () => {
    const serverEcho = scene('echo');
    fetchOk(serverEcho);

    const result = await saveSceneInfoByRegionId(REGION, scene('draft'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/__dev/scene?regionId=${REGION}`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(scene('draft'));
    expect(result).toEqual(serverEcho);
    // dev는 localStorage를 쓰지 않는다.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('저장 실패(HTTP 에러)는 throw', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(saveSceneInfoByRegionId(REGION, scene())).rejects.toThrow(
      'HTTP 500',
    );
  });

  it('로드는 localStorage에 최신 저장본이 있어도 배포 파일만 본다', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ baseVersion: 'hash-v1', sceneInfo: scene('local') }),
    );
    fetchOk(scene('deployed'));

    const result = await loadSceneInfoByRegionId(REGION);
    expect(result.environmentId).toBe('deployed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('운영 환경 (localStorage)', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', false);
  });

  it('isSceneStoredLocallyOnly가 true — 저장이 브라우저 안에만 남는다', () => {
    expect(isSceneStoredLocallyOnly()).toBe(true);
  });

  it('저장은 현재 배포 해시를 도장 찍은 봉투로 localStorage에 남긴다', async () => {
    const result = await saveSceneInfoByRegionId(REGION, scene('mine'));

    expect(result).toEqual(scene('mine'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string)).toEqual({
      baseVersion: 'hash-v1',
      sceneInfo: scene('mine'),
    });
  });

  it('저장·로드 왕복: 현재 배포 기준 저장본은 fetch 없이 (정규화 거쳐) 돌아온다', async () => {
    await saveSceneInfoByRegionId(REGION, scene('mine'));

    const loaded = await loadSceneInfoByRegionId(REGION);
    expect(loaded.environmentId).toBe('mine');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('배포 해시가 더 새로우면(불일치) 로컬 저장본을 버리고 배포본을 쓴다', async () => {
    await saveSceneInfoByRegionId(REGION, scene('mine'));
    // 이후 재배포로 해시가 바뀐 상황.
    registerAssetHashManifest({ [SCENE_MANIFEST_PATH]: 'hash-v2' });
    fetchOk(scene('deployed'));

    const loaded = await loadSceneInfoByRegionId(REGION);
    expect(loaded.environmentId).toBe('deployed');
    // 배포본 로드 성공 후에만 로컬 저장본이 삭제된다.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('봉투 이전 포맷(씬 객체 그대로)은 stale로 간주해 배포본이 이긴다', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scene('legacy')));
    fetchOk(scene('deployed'));

    const loaded = await loadSceneInfoByRegionId(REGION);
    expect(loaded.environmentId).toBe('deployed');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('stale 저장본 + 배포본 로드 실패면 stale이라도 보여주고, 저장본은 지우지 않는다', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await saveSceneInfoByRegionId(REGION, scene('mine'));
    registerAssetHashManifest({ [SCENE_MANIFEST_PATH]: 'hash-v2' });
    fetchMock.mockRejectedValue(new Error('network down'));

    const loaded = await loadSceneInfoByRegionId(REGION);
    expect(loaded.environmentId).toBe('mine');
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    warnSpy.mockRestore();
  });

  it('저장본 없이 배포본 로드가 실패하면 throw', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 } as Response);
    await expect(loadSceneInfoByRegionId(REGION)).rejects.toThrow('HTTP 404');
  });

  it('깨진 localStorage JSON은 무시하고 배포본으로 진행한다', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.localStorage.setItem(STORAGE_KEY, '{not-json');
    fetchOk(scene('deployed'));

    const loaded = await loadSceneInfoByRegionId(REGION);
    expect(loaded.environmentId).toBe('deployed');
    warnSpy.mockRestore();
  });
});
