// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isScenarioSetStoredLocallyOnly,
  loadScenarioSet,
  saveScenarioSet,
  SCENARIOS_PUBLIC_PATH,
  SCENARIOS_STORAGE_KEY,
} from '../scenario-storage';
import { registerAssetHashManifest } from '@crane/core/lib/asset-url';
import type { ScenarioSet } from '../../model/types';

function set(name = 'x'): ScenarioSet {
  return {
    version: 1,
    tickSec: 0.1,
    scenarios: [
      {
        id: 's',
        name,
        sceneFile: 'dock-in.json',
        tags: [
          {
            id: 'a',
            modelId: 'm',
            code: 'tl_distance',
            name: '',
            dataType: 'number',
            min: 0,
            max: 10,
            initial: 0,
            pattern: { kind: 'manual' },
          },
        ],
      },
    ],
  };
}

function firstName(out: ScenarioSet): string {
  return out.scenarios[0].name;
}

const empty: ScenarioSet = { version: 1, tickSec: 0.1, scenarios: [] };
const fetchMock = vi.fn<typeof fetch>();

function fetchOk(body: unknown) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

function stored(): unknown {
  const raw = window.localStorage.getItem(SCENARIOS_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  registerAssetHashManifest({ [SCENARIOS_PUBLIC_PATH]: 'hash-v1' });
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
    fetchOk({ ...set(), tickSec: 0.005 });
    const out = await saveScenarioSet(set());
    expect(fetchMock).toHaveBeenCalledWith(
      '/__dev/scenarios',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(set()) }),
    );
    expect(out.tickSec).toBe(0.016);
    expect(stored()).toBeNull();
    expect(isScenarioSetStoredLocallyOnly()).toBe(false);
  });

  it('저장 실패(HTTP 500)는 throw', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(saveScenarioSet(set())).rejects.toThrow('HTTP 500');
  });

  it('로드는 localStorage 를 무시하고 항상 파일을 읽는다', async () => {
    window.localStorage.setItem(
      SCENARIOS_STORAGE_KEY,
      JSON.stringify({ baseVersion: 'hash-v1', set: set('local') }),
    );
    fetchOk(set('file'));
    const out = await loadScenarioSet();
    expect(firstName(out)).toBe('file');
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/simulation/scenarios.json',
    );
  });
});

describe('운영 (localStorage 봉투)', () => {
  beforeEach(() => vi.stubEnv('DEV', false));

  it('저장은 배포 해시를 도장으로 찍어 봉투로 남긴다', async () => {
    await saveScenarioSet(set());
    expect(stored()).toEqual({ baseVersion: 'hash-v1', set: set() });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isScenarioSetStoredLocallyOnly()).toBe(true);
  });

  it('도장이 현재 배포와 같으면 로컬을 쓰고 fetch 하지 않는다', async () => {
    await saveScenarioSet(set('local'));
    const out = await loadScenarioSet();
    expect(firstName(out)).toBe('local');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('배포가 바뀌면(해시 불일치) 배포본을 쓰고 stale 로컬은 지운다', async () => {
    await saveScenarioSet(set('local'));
    registerAssetHashManifest({ [SCENARIOS_PUBLIC_PATH]: 'hash-v2' });
    fetchOk(set('deployed'));
    const out = await loadScenarioSet();
    expect(firstName(out)).toBe('deployed');
    expect(stored()).toBeNull();
  });

  it('봉투 이전 포맷(세트 그대로)은 stale — 배포본 성공 시 정리한다', async () => {
    window.localStorage.setItem(
      SCENARIOS_STORAGE_KEY,
      JSON.stringify(set('old')),
    );
    fetchOk(set('deployed'));
    const out = await loadScenarioSet();
    expect(firstName(out)).toBe('deployed');
    expect(stored()).toBeNull();
  });

  it('배포본 fetch 가 실패하면 stale 로컬로 폴백하고 지우지 않는다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await saveScenarioSet(set('local'));
    registerAssetHashManifest({ [SCENARIOS_PUBLIC_PATH]: 'hash-v2' });
    fetchMock.mockRejectedValue(new Error('offline'));
    const out = await loadScenarioSet();
    expect(firstName(out)).toBe('local');
    expect(stored()).not.toBeNull();
  });

  it('옛 가상 태그 봉투 키(crane:virtual-tags)는 읽지 않는다', async () => {
    window.localStorage.setItem(
      'crane:virtual-tags',
      JSON.stringify({
        baseVersion: 'hash-v1',
        set: { version: 3, equipments: [] },
      }),
    );
    fetchOk(set('deployed'));
    const out = await loadScenarioSet();
    expect(firstName(out)).toBe('deployed');
  });

  it('로컬도 없고 배포본도 실패하면 throw', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 } as Response);
    await expect(loadScenarioSet()).rejects.toThrow('HTTP 404');
  });

  it('손상 JSON 로컬은 무시하고 배포본을 쓴다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.localStorage.setItem(SCENARIOS_STORAGE_KEY, '{broken');
    fetchOk(empty);
    expect(await loadScenarioSet()).toEqual(empty);
  });

  it('배포본도 정규화를 거친다(손상 항목 제거)', async () => {
    fetchOk({
      version: 1,
      tickSec: 'x',
      scenarios: [set().scenarios[0], { id: 'bad' }],
    });
    const out = await loadScenarioSet();
    expect(out.tickSec).toBe(0.1);
    expect(out.scenarios.map((s) => s.id)).toEqual(['s']);
  });
});
