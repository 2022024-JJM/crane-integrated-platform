// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isVirtualTagSetStoredLocallyOnly,
  loadVirtualTagSet,
  saveVirtualTagSet,
  VIRTUAL_TAGS_PUBLIC_PATH,
  VIRTUAL_TAGS_STORAGE_KEY,
} from '../virtual-tag-storage';
import { registerAssetHashManifest } from '@crane/core/lib/asset-url';
import type { VirtualTagSet } from '../../model/types';

function set(key = 'C_1:x'): VirtualTagSet {
  return {
    version: 1,
    tickMs: 100,
    tags: [
      {
        id: 'a',
        key,
        name: '',
        min: 0,
        max: 10,
        initial: 0,
        pattern: { kind: 'manual' },
        enabled: true,
      },
    ],
  };
}

const empty: VirtualTagSet = { version: 1, tickMs: 100, tags: [] };
const fetchMock = vi.fn<typeof fetch>();

function fetchOk(body: unknown) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

function stored(): unknown {
  const raw = window.localStorage.getItem(VIRTUAL_TAGS_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  registerAssetHashManifest({ [VIRTUAL_TAGS_PUBLIC_PATH]: 'hash-v1' });
  window.localStorage.clear();
});

afterEach(() => {
  fetchMock.mockReset();
  registerAssetHashManifest({});
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('dev (파일)', () => {
  beforeEach(() => vi.stubEnv('DEV', true));

  it('저장은 미들웨어에 POST 하고 응답을 정규화해 돌려준다', async () => {
    fetchOk({ ...set(), tickMs: 5 });
    const out = await saveVirtualTagSet(set());
    expect(fetchMock).toHaveBeenCalledWith(
      '/__dev/virtual-tags',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(set()) }),
    );
    expect(out.tickMs).toBe(16);
    expect(stored()).toBeNull();
    expect(isVirtualTagSetStoredLocallyOnly()).toBe(false);
  });

  it('저장 실패(HTTP 500)는 throw', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(saveVirtualTagSet(set())).rejects.toThrow('HTTP 500');
  });

  it('로드는 localStorage 를 무시하고 항상 파일을 읽는다', async () => {
    window.localStorage.setItem(
      VIRTUAL_TAGS_STORAGE_KEY,
      JSON.stringify({ baseVersion: 'hash-v1', set: set('local') }),
    );
    fetchOk(set('file'));
    const out = await loadVirtualTagSet();
    expect(out.tags[0].key).toBe('file');
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/simulation/virtual-tags.json',
    );
  });
});

describe('운영 (localStorage 봉투)', () => {
  beforeEach(() => vi.stubEnv('DEV', false));

  it('저장은 배포 해시를 도장으로 찍어 봉투로 남긴다', async () => {
    await saveVirtualTagSet(set());
    expect(stored()).toEqual({ baseVersion: 'hash-v1', set: set() });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isVirtualTagSetStoredLocallyOnly()).toBe(true);
  });

  it('도장이 현재 배포와 같으면 로컬을 쓰고 fetch 하지 않는다', async () => {
    await saveVirtualTagSet(set('local'));
    const out = await loadVirtualTagSet();
    expect(out.tags[0].key).toBe('local');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('배포가 바뀌면(해시 불일치) 배포본을 쓰고 stale 로컬은 지운다', async () => {
    await saveVirtualTagSet(set('local'));
    registerAssetHashManifest({ [VIRTUAL_TAGS_PUBLIC_PATH]: 'hash-v2' });
    fetchOk(set('deployed'));
    const out = await loadVirtualTagSet();
    expect(out.tags[0].key).toBe('deployed');
    expect(stored()).toBeNull();
  });

  it('봉투 이전 포맷(세트 그대로)은 stale — 배포본 성공 시 정리한다', async () => {
    window.localStorage.setItem(
      VIRTUAL_TAGS_STORAGE_KEY,
      JSON.stringify(set('old')),
    );
    fetchOk(set('deployed'));
    const out = await loadVirtualTagSet();
    expect(out.tags[0].key).toBe('deployed');
    expect(stored()).toBeNull();
  });

  it('배포본 fetch 가 실패하면 stale 로컬로 폴백하고 지우지 않는다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await saveVirtualTagSet(set('local'));
    registerAssetHashManifest({ [VIRTUAL_TAGS_PUBLIC_PATH]: 'hash-v2' });
    fetchMock.mockRejectedValue(new Error('offline'));
    const out = await loadVirtualTagSet();
    expect(out.tags[0].key).toBe('local');
    expect(stored()).not.toBeNull();
  });

  it('로컬도 없고 배포본도 실패하면 throw', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 } as Response);
    await expect(loadVirtualTagSet()).rejects.toThrow('HTTP 404');
  });

  it('손상 JSON 로컬은 무시하고 배포본을 쓴다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.localStorage.setItem(VIRTUAL_TAGS_STORAGE_KEY, '{broken');
    fetchOk(empty);
    expect(await loadVirtualTagSet()).toEqual(empty);
  });

  it('배포본도 정규화를 거친다(손상 항목 제거)', async () => {
    fetchOk({ version: 1, tickMs: 'x', tags: [set().tags[0], { id: 'bad' }] });
    const out = await loadVirtualTagSet();
    expect(out.tickMs).toBe(100);
    expect(out.tags.map((t) => t.id)).toEqual(['a']);
  });
});
