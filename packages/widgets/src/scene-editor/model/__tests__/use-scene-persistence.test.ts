// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { SavedCameraInfo, SavedSceneInfo } from '@crane/domain/3d';
import { UnknownRegionError } from '@crane/domain/3d';
import { useSceneHistory } from '../use-scene-history';
import { useScenePersistence } from '../use-scene-persistence';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/** 저장·로드 어댑터만 대체한다 — sanitize 등 나머지 도메인은 실물을 쓴다. */
const { loadMock, saveMock, toastMock } = vi.hoisted(() => ({
  loadMock: vi.fn<(regionId: string) => Promise<SavedSceneInfo>>(),
  saveMock:
    vi.fn<(regionId: string, scene: SavedSceneInfo) => Promise<SavedSceneInfo>>(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@crane/domain/3d', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@crane/domain/3d')>();
  return {
    ...actual,
    loadSceneInfoByRegionId: loadMock,
    saveSceneInfoByRegionId: saveMock,
  };
});

vi.mock('sonner', () => ({ toast: toastMock }));

const CAMERA: SavedCameraInfo = {
  position: [10, 20, 30],
  target: [0, 0, 0],
};

function storedScene(): SavedSceneInfo {
  return {
    maps: [{ id: 'map-1', path: '/maps/okpo.glb', locked: false }],
    models: [],
    texts: [],
    camera: CAMERA,
    environmentId: 'env-1',
  };
}

const noopReset = () => {};

function setup(getCameraState?: () => SavedCameraInfo | null) {
  return renderHook(() => {
    const history = useSceneHistory();
    const persistence = useScenePersistence({
      regionId: 'dock-1',
      sceneInfo: history.sceneInfo,
      replaceScene: history.replaceScene,
      updateScene: history.updateScene,
      onLoadReset: noopReset,
      getCameraState,
    });
    return { history, persistence };
  });
}

beforeEach(() => {
  loadMock.mockResolvedValue(storedScene());
  // dev 미들웨어처럼 저장한 씬을 그대로 돌려준다.
  saveMock.mockImplementation((_regionId, scene) => Promise.resolve(scene));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('로드', () => {
  it('로드된 씬은 정규화 + 지도 전체 잠금으로 세션을 시작한다', async () => {
    const { result } = setup();

    await waitFor(() => expect(result.current.history.sceneInfo).not.toBeNull());

    const loaded = result.current.history.sceneInfo!;
    // 저장본에 locked: false가 남아 있어도 세션은 항상 잠금으로 연다.
    expect(loaded.maps[0].locked).toBe(true);
    expect(result.current.persistence.initialCamera).toEqual(CAMERA);
    expect(result.current.persistence.isDirty).toBe(false);
  });

  it('로드 실패는 toast로 알린다 — UnknownRegionError는 메시지 그대로', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    loadMock.mockRejectedValue(new UnknownRegionError('nowhere'));

    setup();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(String(toastMock.error.mock.calls[0][0])).toContain('nowhere');
    errorSpy.mockRestore();
  });
});

describe('dirty 판정', () => {
  it('편집하면 dirty, 같은 내용으로 되돌리는 updateScene은 참조 유지로 clean', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.history.sceneInfo).not.toBeNull());

    act(() =>
      result.current.history.updateScene((prev) => ({
        ...prev!,
        environmentId: 'env-2',
      })),
    );
    expect(result.current.persistence.isDirty).toBe(true);

    act(() => result.current.history.undo());
    // undo로 돌아온 present는 저장 기준선과 같은 객체다.
    expect(result.current.persistence.isDirty).toBe(false);
  });
});

describe('저장', () => {
  it('저장 성공: 카메라를 실어 sanitize된 씬을 보내고, 기준선이 갱신돼 clean', async () => {
    const { result } = setup(() => ({
      position: [1, 1, 1],
      target: [2, 2, 2],
    }));
    await waitFor(() => expect(result.current.history.sceneInfo).not.toBeNull());

    act(() =>
      result.current.history.updateScene((prev) => ({
        ...prev!,
        environmentId: 'env-2',
      })),
    );

    let saved = false;
    await act(async () => {
      saved = await result.current.persistence.saveCurrentScene();
    });

    expect(saved).toBe(true);
    expect(saveMock).toHaveBeenCalledTimes(1);
    const [regionId, sentScene] = saveMock.mock.calls[0];
    expect(regionId).toBe('dock-1');
    expect(sentScene.environmentId).toBe('env-2');
    // getCameraState의 현재 카메라가 로드 카메라를 대체한다.
    expect(sentScene.camera).toEqual({ position: [1, 1, 1], target: [2, 2, 2] });

    expect(result.current.persistence.isDirty).toBe(false);
    expect(result.current.persistence.initialCamera).toEqual({
      position: [1, 1, 1],
      target: [2, 2, 2],
    });
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('씬이 없으면 저장하지 않고 false', async () => {
    loadMock.mockReturnValue(new Promise(() => {})); // 로드가 끝나지 않은 상태
    const { result } = setup();

    let saved = true;
    await act(async () => {
      saved = await result.current.persistence.saveCurrentScene();
    });
    expect(saved).toBe(false);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('저장 실패: UnknownRegionError는 메시지를 그대로 알리고 false', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = setup();
    await waitFor(() => expect(result.current.history.sceneInfo).not.toBeNull());
    saveMock.mockRejectedValue(new UnknownRegionError('dock-x'));

    let saved = true;
    await act(async () => {
      saved = await result.current.persistence.saveCurrentScene();
    });

    expect(saved).toBe(false);
    expect(toastMock.error).toHaveBeenCalled();
    expect(String(toastMock.error.mock.calls[0][0])).toContain('dock-x');
    // dirty 기준선은 그대로 — 저장 안 된 편집은 계속 dirty다.
    errorSpy.mockRestore();
  });

  it('일반 저장 실패는 Retry 액션이 달린 toast를 띄운다', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = setup();
    await waitFor(() => expect(result.current.history.sceneInfo).not.toBeNull());
    saveMock.mockRejectedValue(new Error('network'));

    await act(async () => {
      await result.current.persistence.saveCurrentScene();
    });

    const lastErrorCall = toastMock.error.mock.calls.at(-1);
    expect(lastErrorCall?.[1]).toMatchObject({
      action: expect.objectContaining({ label: 'Retry' }),
    });
    errorSpy.mockRestore();
  });
});
