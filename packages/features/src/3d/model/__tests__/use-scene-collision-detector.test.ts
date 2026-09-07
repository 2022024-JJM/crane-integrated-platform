// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import {
  modelObjectRegistry,
  type SavedModelInfo,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import { SCAN_INTERVAL_MS } from '../../lib/scene-collision-pairs';
import { rigValueStore } from '../rig-value-store';
import { sceneCollisionRuntime } from '../scene-collision-runtime';
import { useActiveTransformStore } from '../use-active-transform-store';
import { useSceneCollisionDetector } from '../use-scene-collision-detector';
import { useSceneCollisionStore } from '../use-scene-collision-store';
import { useVirtualTagStore } from '../use-virtual-tag-store';

/** R3F 프레임 루프를 가로챈다(use-rig-driver.test 와 같은 방식). */
const captured = vi.hoisted(() => ({
  frameCallback: null as null | ((state: unknown, delta: number) => void),
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    captured.frameCallback = callback;
  },
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

type BvhGeometry = BufferGeometry & { boundsTree?: MeshBVH };

let nowMs = 0;

function frame() {
  act(() => {
    captured.frameCallback?.(undefined, 1 / 60);
  });
}

/** 스캔 간격만큼 시계를 밀고 한 프레임. */
function scan() {
  nowMs += SCAN_INTERVAL_MS;
  frame();
}

function mountModel(id: string, x: number) {
  const root = new Group();
  const body = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  body.name = 'Body';
  root.add(body);
  root.position.set(x, 0, 0);
  root.updateMatrixWorld(true);
  (body.geometry as BvhGeometry).boundsTree = new MeshBVH(body.geometry);
  modelObjectRegistry.register(id, root);
  return root;
}

function model(id: string): SavedModelInfo {
  return {
    id,
    equipName: id,
    path: '/m.glb',
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

function scene(ids: string[]): SavedSceneInfo {
  return { maps: [], models: ids.map(model) };
}

beforeEach(() => {
  nowMs = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  modelObjectRegistry.clear();
  sceneCollisionRuntime.disarm();
  rigValueStore.reset();
  useSceneCollisionStore.setState({
    enabled: true,
    phase: 'scanning',
    report: null,
  });
  useVirtualTagStore.setState({ isRunning: true });
  useActiveTransformStore.getState().end();
  captured.frameCallback = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  modelObjectRegistry.clear();
  sceneCollisionRuntime.disarm();
  useVirtualTagStore.setState({ isRunning: false });
});

describe('useSceneCollisionDetector', () => {
  it('SCAN_INTERVAL 미만 프레임은 런타임을 호출하지 않는다', () => {
    const tick = vi.spyOn(sceneCollisionRuntime, 'tick');
    renderHook(() =>
      useSceneCollisionDetector({ sceneInfo: scene([]), enabled: true }),
    );
    frame(); // now=0, last=0 → 0 < 50 → 스킵
    expect(tick).not.toHaveBeenCalled();
    scan();
    expect(tick).toHaveBeenCalledTimes(1);
    nowMs += 10;
    frame();
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('기즈모 드래그 중엔 스캔을 건너뛴다', () => {
    const tick = vi.spyOn(sceneCollisionRuntime, 'tick');
    renderHook(() =>
      useSceneCollisionDetector({ sceneInfo: scene([]), enabled: true }),
    );
    useActiveTransformStore.getState().begin();
    scan();
    expect(tick).not.toHaveBeenCalled();
    useActiveTransformStore.getState().end();
    scan();
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('충돌 시 스토어 보고 → 러너 정지 → 값 저장소 freeze, 이후 스캔은 조용하다', () => {
    const a = mountModel('a', 0);
    mountModel('b', 5);
    const pause = vi.spyOn(useVirtualTagStore.getState(), 'pause');
    useVirtualTagStore.setState({ pause });
    rigValueStore.set('a/j', 10, { smooth: true, smoothTime: 0.2 });
    rigValueStore.step(1 / 60);
    const midway = rigValueStore.get('a/j');

    renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene(['a', 'b']),
        enabled: true,
      }),
    );
    scan(); // 기준선
    expect(useSceneCollisionStore.getState().phase).toBe('scanning');

    a.position.x = 4.6;
    a.updateMatrixWorld(true);
    scan();
    const state = useSceneCollisionStore.getState();
    expect(state.phase).toBe('collided');
    expect(state.report?.pairKey).toBe('a|b');
    expect(state.report?.a.nodePath).toBe('[0]Body');
    expect(pause).toHaveBeenCalledTimes(1);
    // freeze — step 을 더 돌려도 값이 그대로.
    for (let i = 0; i < 30; i += 1) rigValueStore.step(1 / 60);
    expect(rigValueStore.get('a/j')).toBe(midway);

    const tick = vi.spyOn(sceneCollisionRuntime, 'tick');
    scan();
    scan();
    // halted 라 tick 은 불리지만 null — 스토어는 그대로.
    expect(tick).toHaveBeenCalledTimes(2);
    expect(useSceneCollisionStore.getState()).toBe(state);
  });

  it('enabled=false 전환·언마운트 시 런타임을 내리고 report 를 비운다(enabled 는 유지)', () => {
    const disarm = vi.spyOn(sceneCollisionRuntime, 'disarm');
    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useSceneCollisionDetector({ sceneInfo: scene([]), enabled }),
      { initialProps: { enabled: true } },
    );
    expect(sceneCollisionRuntime.currentPhase).toBe('baseline');
    rerender({ enabled: false });
    expect(disarm).toHaveBeenCalledTimes(1);
    expect(sceneCollisionRuntime.currentPhase).toBe('idle');
    scan();
    rerender({ enabled: true });
    expect(sceneCollisionRuntime.currentPhase).toBe('baseline');
    unmount();
    expect(disarm).toHaveBeenCalledTimes(2);
    expect(useSceneCollisionStore.getState().enabled).toBe(true);
    expect(useSceneCollisionStore.getState().report).toBeNull();
  });

  it('sceneInfo 참조가 바뀌면 sync 를 다시 부르고, 같은 참조면 부르지 않는다', () => {
    const sync = vi.spyOn(sceneCollisionRuntime, 'sync');
    const first = scene(['a']);
    const { rerender } = renderHook(
      ({ info }: { info: SavedSceneInfo }) =>
        useSceneCollisionDetector({ sceneInfo: info, enabled: true }),
      { initialProps: { info: first } },
    );
    expect(sync).toHaveBeenCalledTimes(1);
    rerender({ info: first });
    expect(sync).toHaveBeenCalledTimes(1);
    rerender({ info: scene(['a', 'b']) });
    expect(sync).toHaveBeenCalledTimes(2);
    rerender({ info: null as unknown as SavedSceneInfo });
    expect(sync).toHaveBeenLastCalledWith(undefined);
  });
});
