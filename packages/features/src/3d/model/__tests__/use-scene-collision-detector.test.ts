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
import {
  BASELINE_SETTLE_MS,
  BVH_RETRY_MS,
  FLASH_MS,
  SCAN_INTERVAL_MS,
} from '../../lib/scene-collision-pairs';
import { rigValueStore } from '../rig-value-store';
import { sceneCollisionRuntime } from '../scene-collision-runtime';
import { useActiveTransformStore } from '../use-active-transform-store';
import { useSceneCollisionDetector } from '../use-scene-collision-detector';
import { useSceneCollisionStore } from '../use-scene-collision-store';
import { useRealtimeStore } from '../use-realtime-store';
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

/** 기준선 완료 — 첫 스캔이 안정화 창을 열고, 창이 끝난 뒤 한 번 더 스캔. */
function settle() {
  scan();
  nowMs += BASELINE_SETTLE_MS;
  scan();
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

function moveX(root: Group, x: number) {
  root.position.x = x;
  root.updateMatrixWorld(true);
}

beforeEach(() => {
  nowMs = 0;
  vi.useFakeTimers();
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  modelObjectRegistry.clear();
  sceneCollisionRuntime.disarm();
  rigValueStore.reset();
  useSceneCollisionStore.setState({
    enabled: true,
    pauseOnCollision: true,
    history: [],
    activeRecordId: null,
    activeMode: null,
    baselinePending: false,
  });
  useVirtualTagStore.setState({ isRunning: true });
  useRealtimeStore.setState({ isRunning: true, held: false, buffer: [] });
  useActiveTransformStore.getState().end();
  captured.frameCallback = null;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  modelObjectRegistry.clear();
  sceneCollisionRuntime.disarm();
  useVirtualTagStore.setState({ isRunning: false });
});

describe('useSceneCollisionDetector — 스캔 게이트', () => {
  it('SCAN_INTERVAL 미만 프레임은 런타임을 호출하지 않는다', () => {
    const tick = vi.spyOn(sceneCollisionRuntime, 'tick');
    renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene([]),
        enabled: true,
        runner: 'simulation',
      }),
    );
    frame();
    expect(tick).not.toHaveBeenCalled();
    scan();
    expect(tick).toHaveBeenCalledTimes(1);
    nowMs += 10;
    frame();
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('기즈모 드래그 중엔 스캔을 건너뛰고, 종료 뒤 첫 프레임에 재기준선을 잡는다', () => {
    const tick = vi.spyOn(sceneCollisionRuntime, 'tick');
    const rebaseline = vi.spyOn(sceneCollisionRuntime, 'rebaseline');
    renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene([]),
        enabled: true,
        runner: 'simulation',
      }),
    );
    scan();
    expect(rebaseline).toHaveBeenCalledTimes(1); // 마운트 후 첫 게이트 열림
    useActiveTransformStore.getState().begin();
    scan();
    expect(tick).toHaveBeenCalledTimes(1);
    useActiveTransformStore.getState().end();
    scan();
    expect(tick).toHaveBeenCalledTimes(2);
    expect(rebaseline).toHaveBeenCalledTimes(2);
    // 계속 열려 있는 동안엔 다시 잡지 않는다(전이에서만).
    scan();
    scan();
    expect(rebaseline).toHaveBeenCalledTimes(2);
  });

  it('러너가 정지 중이면 스캔하지 않고, 재생 전이 첫 프레임에 재기준선 뒤 스캔한다', () => {
    const tick = vi.spyOn(sceneCollisionRuntime, 'tick');
    const rebaseline = vi.spyOn(sceneCollisionRuntime, 'rebaseline');
    useVirtualTagStore.setState({ isRunning: false });
    renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene([]),
        enabled: true,
        runner: 'simulation',
      }),
    );
    scan();
    scan();
    expect(tick).not.toHaveBeenCalled();
    expect(rebaseline).not.toHaveBeenCalled();
    act(() => useVirtualTagStore.setState({ isRunning: true }));
    scan();
    expect(rebaseline).toHaveBeenCalledTimes(1);
    expect(tick).toHaveBeenCalledTimes(1);
    act(() => useVirtualTagStore.setState({ isRunning: false }));
    scan();
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("runner='realtime' 은 실시간 러너의 isRunning 만 보고, 보류(held) 중에도 스캔한다", () => {
    const tick = vi.spyOn(sceneCollisionRuntime, 'tick');
    useVirtualTagStore.setState({ isRunning: false });
    useRealtimeStore.setState({ isRunning: true, held: true });
    renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene([]),
        enabled: true,
        runner: 'realtime',
      }),
    );
    scan();
    expect(tick).toHaveBeenCalledTimes(1);
    useRealtimeStore.setState({ isRunning: false });
    scan();
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("runner='simulation' 은 실시간 러너가 돌아도 가상 태그가 정지면 스캔하지 않는다", () => {
    const tick = vi.spyOn(sceneCollisionRuntime, 'tick');
    useVirtualTagStore.setState({ isRunning: false });
    useRealtimeStore.setState({ isRunning: true });
    renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene([]),
        enabled: true,
        runner: 'simulation',
      }),
    );
    scan();
    expect(tick).not.toHaveBeenCalled();
  });

  it('드래그로 겹쳐 놓은 쌍은 기록되지 않고 억제되며, 창 뒤 시뮬레이션이 떼었다 붙이면 기록된다', () => {
    const a = mountModel('a', 0);
    mountModel('b', 5);
    renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene(['a', 'b']),
        enabled: true,
        runner: 'simulation',
      }),
    );
    settle();
    expect(sceneCollisionRuntime.currentPhase).toBe('scanning');
    useActiveTransformStore.getState().begin();
    moveX(a, 4.6);
    scan();
    useActiveTransformStore.getState().end();
    scan();
    expect(useSceneCollisionStore.getState().history).toHaveLength(0);
    expect(sceneCollisionRuntime.suppressedKeys.has('a|b')).toBe(true);
    expect(sceneCollisionRuntime.currentPhase).toBe('baseline');
    nowMs += BASELINE_SETTLE_MS;
    scan();
    expect(sceneCollisionRuntime.currentPhase).toBe('scanning');
    moveX(a, -10);
    scan();
    expect(sceneCollisionRuntime.suppressedKeys.has('a|b')).toBe(false);
    moveX(a, 4.6);
    scan();
    expect(useSceneCollisionStore.getState().history).toHaveLength(1);
  });
});

describe('useSceneCollisionDetector — 충돌 시 정지 모드', () => {
  it('기록 → 쌍 억제 → 러너 정지 → freeze → pin, 감시는 계속되며 같은 자세면 조용하다', () => {
    const a = mountModel('a', 0);
    mountModel('b', 5);
    const pause = vi.fn(() =>
      useVirtualTagStore.setState({ isRunning: false }),
    );
    useVirtualTagStore.setState({ pause });
    rigValueStore.set('a/j', 10, { smooth: true, smoothTime: 0.2 });
    rigValueStore.step(1 / 60);
    const midway = rigValueStore.get('a/j');

    renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene(['a', 'b']),
        enabled: true,
        runner: 'simulation',
      }),
    );
    settle(); // 기준선
    moveX(a, 4.6);
    scan();
    const state = useSceneCollisionStore.getState();
    expect(state.history).toHaveLength(1);
    expect(state.history[0].pairKey).toBe('a|b');
    expect(state.history[0].values).toEqual([['a/j', midway]]);
    expect(state).toMatchObject({
      activeRecordId: state.history[0].id,
      activeMode: 'pinned',
    });
    expect(pause).toHaveBeenCalledTimes(1);
    // 실시간(WebSocket)은 화면 반영을 보류한다.
    expect(useRealtimeStore.getState().held).toBe(true);
    // 런타임은 멈추지 않고 그 쌍만 억제된다.
    expect(sceneCollisionRuntime.currentPhase).toBe('scanning');
    expect(sceneCollisionRuntime.suppressedKeys.has('a|b')).toBe(true);
    for (let i = 0; i < 30; i += 1) rigValueStore.step(1 / 60);
    expect(rigValueStore.get('a/j')).toBe(midway);

    // 러너가 멈췄으므로 스캔도 멈춘다 — 스토어 참조 불변.
    const tick = vi.spyOn(sceneCollisionRuntime, 'tick');
    scan();
    scan();
    expect(tick).not.toHaveBeenCalled();
    expect(useSceneCollisionStore.getState()).toBe(state);
  });

  it('정지 중 기즈모로 떼었다 붙여도 기록되지 않고, ▶ 뒤 겹친 채면 억제되며 시뮬레이션이 떼었다 붙여야 두 번째 기록', () => {
    const a = mountModel('a', 0);
    mountModel('b', 5);
    useVirtualTagStore.setState({
      pause: () => useVirtualTagStore.setState({ isRunning: false }),
    });
    renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene(['a', 'b']),
        enabled: true,
        runner: 'simulation',
      }),
    );
    settle();
    moveX(a, 4.6);
    scan();
    const first = useSceneCollisionStore.getState().history[0];
    expect(useSceneCollisionStore.getState().activeRecordId).toBe(first.id);
    expect(useVirtualTagStore.getState().isRunning).toBe(false);

    moveX(a, 0); // 정지 중 떼어 놓음 — 스캔이 없어 억제도 그대로
    scan();
    expect(sceneCollisionRuntime.suppressedKeys.has('a|b')).toBe(true);
    moveX(a, 4.7); // 다시 붙임 — 기록 없음
    scan();
    expect(useSceneCollisionStore.getState().history).toHaveLength(1);

    // ▶ — 고정은 풀리고, 겹친 채 재개된 쌍은 재기준선이 조용히 넘긴다.
    act(() => useVirtualTagStore.setState({ isRunning: true }));
    expect(useSceneCollisionStore.getState().activeRecordId).toBeNull();
    scan();
    expect(sceneCollisionRuntime.currentPhase).toBe('baseline');
    expect(useSceneCollisionStore.getState().history).toHaveLength(1);
    expect(sceneCollisionRuntime.suppressedKeys.has('a|b')).toBe(true);
    nowMs += BASELINE_SETTLE_MS;
    scan();
    expect(sceneCollisionRuntime.currentPhase).toBe('scanning');

    // 시뮬레이션이 떼었다 다시 붙이면 새 기록 + pin 이동.
    moveX(a, -10);
    scan();
    expect(sceneCollisionRuntime.suppressedKeys.has('a|b')).toBe(false);
    moveX(a, 4.6);
    scan();
    const state = useSceneCollisionStore.getState();
    expect(state.history).toHaveLength(2);
    expect(state.history[0].id).not.toBe(first.id);
    expect(state).toMatchObject({
      activeRecordId: state.history[0].id,
      activeMode: 'pinned',
    });
  });

  it('▶ 재생(isRunning false→true)이 resume 을 불러 고정을 풀고, 같은 방향이 아닌 전이는 무시한다', () => {
    const a = mountModel('a', 0);
    mountModel('b', 5);
    useVirtualTagStore.setState({
      pause: () => useVirtualTagStore.setState({ isRunning: false }),
    });
    renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene(['a', 'b']),
        enabled: true,
        runner: 'simulation',
      }),
    );
    settle();
    moveX(a, 4.6);
    scan();
    expect(useSceneCollisionStore.getState().activeMode).toBe('pinned');
    const resume = vi.spyOn(useSceneCollisionStore.getState(), 'resume');
    useSceneCollisionStore.setState({ resume });

    act(() => useVirtualTagStore.setState({ isRunning: false })); // false→false
    expect(resume).not.toHaveBeenCalled();
    act(() => useVirtualTagStore.setState({ isRunning: true })); // false→true
    expect(resume).toHaveBeenCalledTimes(1);
    // 런타임은 멈춘 적이 없어 resume 은 arm 하지 않고 고정만 푼다. 재기준선은
    // 다음 프레임에 검사기가 잡는다.
    expect(sceneCollisionRuntime.currentPhase).toBe('scanning');
    expect(useSceneCollisionStore.getState().activeRecordId).toBeNull();
    frame();
    expect(sceneCollisionRuntime.currentPhase).toBe('baseline');
    act(() => useVirtualTagStore.setState({ isRunning: true })); // true→true
    expect(resume).toHaveBeenCalledTimes(1);
  });
});

describe('useSceneCollisionDetector — 정지 안 함 모드', () => {
  it('기록 + flash 만 하고 러너는 계속 돌며, 붙어 있는 동안 같은 쌍은 다시 기록되지 않는다', () => {
    useSceneCollisionStore.setState({ pauseOnCollision: false });
    const a = mountModel('a', 0);
    mountModel('b', 5);
    const pause = vi.fn();
    useVirtualTagStore.setState({ pause });
    renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene(['a', 'b']),
        enabled: true,
        runner: 'simulation',
      }),
    );
    settle();
    moveX(a, 4.6);
    scan();
    let state = useSceneCollisionStore.getState();
    expect(state.history).toHaveLength(1);
    expect(state.activeMode).toBe('flash');
    expect(pause).not.toHaveBeenCalled();
    expect(useRealtimeStore.getState().held).toBe(false);
    expect(sceneCollisionRuntime.currentPhase).toBe('scanning');

    moveX(a, 4.7);
    scan();
    expect(useSceneCollisionStore.getState().history).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(FLASH_MS);
    });
    state = useSceneCollisionStore.getState();
    expect(state.activeRecordId).toBeNull();
    expect(state.history).toHaveLength(1);

    // 분리 뒤 재접근 → 새 기록.
    moveX(a, -10);
    scan();
    moveX(a, 4.6);
    scan();
    expect(useSceneCollisionStore.getState().history).toHaveLength(2);
  });
});

describe('useSceneCollisionDetector — 수명', () => {
  it('enabled=false 전환·언마운트 시 런타임을 내리고 active 를 비운다(enabled·기록 유지)', () => {
    const disarm = vi.spyOn(sceneCollisionRuntime, 'disarm');
    useSceneCollisionStore.getState().pushRecord({
      id: 7,
      pairKey: 'x|y',
      at: 0,
      a: { modelId: 'x', equipName: 'X', nodePath: '' },
      b: { modelId: 'y', equipName: 'Y', nodePath: '' },
      contactPoint: [0, 0, 0],
      values: [],
    });
    useSceneCollisionStore.getState().pin(7);
    useRealtimeStore.getState().hold();
    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useSceneCollisionDetector({
          sceneInfo: scene([]),
          enabled,
          runner: 'simulation',
        }),
      { initialProps: { enabled: true } },
    );
    expect(sceneCollisionRuntime.currentPhase).toBe('baseline');
    rerender({ enabled: false });
    expect(disarm).toHaveBeenCalledTimes(1);
    expect(useSceneCollisionStore.getState().activeRecordId).toBeNull();
    // 실시간 보류가 검사기 없이 남지 않는다.
    expect(useRealtimeStore.getState().held).toBe(false);
    expect(useSceneCollisionStore.getState().history).toHaveLength(1);
    rerender({ enabled: true });
    expect(sceneCollisionRuntime.currentPhase).toBe('baseline');
    unmount();
    expect(disarm).toHaveBeenCalledTimes(2);
    expect(useSceneCollisionStore.getState().enabled).toBe(true);
  });

  it('언마운트 뒤에는 ▶ 전이를 더 이상 듣지 않는다', () => {
    const { unmount } = renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene([]),
        enabled: true,
        runner: 'simulation',
      }),
    );
    unmount();
    const resume = vi.fn();
    useSceneCollisionStore.setState({ resume });
    act(() => useVirtualTagStore.setState({ isRunning: false }));
    act(() => useVirtualTagStore.setState({ isRunning: true }));
    expect(resume).not.toHaveBeenCalled();
  });

  it('sceneInfo 참조가 바뀌면 sync 를 다시 부르고, 같은 참조면 부르지 않는다', () => {
    const sync = vi.spyOn(sceneCollisionRuntime, 'sync');
    const first = scene(['a']);
    const { rerender } = renderHook(
      ({ info }: { info: SavedSceneInfo }) =>
        useSceneCollisionDetector({
          sceneInfo: info,
          enabled: true,
          runner: 'simulation',
        }),
      { initialProps: { info: first } },
    );
    expect(sync).toHaveBeenCalledTimes(1);
    rerender({ info: first });
    expect(sync).toHaveBeenCalledTimes(1);
    rerender({ info: scene(['a', 'b']) });
    expect(sync).toHaveBeenCalledTimes(2);
  });
});

describe('useSceneCollisionDetector — 기준선 신호(baselinePending)', () => {
  it('러너 정지 중엔 무장해도 false, 재생 첫 스캔에 true, 안정화 창이 끝나면 false', () => {
    mountModel('a', 0);
    mountModel('b', 5);
    useVirtualTagStore.setState({ isRunning: false });
    renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene(['a', 'b']),
        enabled: true,
        runner: 'simulation',
      }),
    );
    expect(sceneCollisionRuntime.currentPhase).toBe('baseline');
    expect(useSceneCollisionStore.getState().baselinePending).toBe(false);
    scan();
    expect(useSceneCollisionStore.getState().baselinePending).toBe(false);
    act(() => useVirtualTagStore.setState({ isRunning: true }));
    scan();
    expect(useSceneCollisionStore.getState().baselinePending).toBe(true);
    // 창 안의 스캔은 값이 같아 스토어 참조를 흔들지 않는다.
    const before = useSceneCollisionStore.getState();
    scan();
    expect(useSceneCollisionStore.getState()).toBe(before);
    nowMs += BASELINE_SETTLE_MS;
    scan();
    expect(sceneCollisionRuntime.currentPhase).toBe('scanning');
    expect(useSceneCollisionStore.getState().baselinePending).toBe(false);
  });

  it('러너 정지·드래그 시작 전이에서 즉시 false 로 내리고(phase 는 baseline 유지), 재개하면 새 창으로 다시 true', () => {
    mountModel('a', 0);
    mountModel('b', 5);
    renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene(['a', 'b']),
        enabled: true,
        runner: 'simulation',
      }),
    );
    scan();
    expect(useSceneCollisionStore.getState().baselinePending).toBe(true);
    act(() => useVirtualTagStore.setState({ isRunning: false }));
    frame();
    expect(useSceneCollisionStore.getState().baselinePending).toBe(false);
    expect(sceneCollisionRuntime.currentPhase).toBe('baseline');
    const before = useSceneCollisionStore.getState();
    frame();
    expect(useSceneCollisionStore.getState()).toBe(before);

    act(() => useVirtualTagStore.setState({ isRunning: true }));
    scan();
    expect(useSceneCollisionStore.getState().baselinePending).toBe(true);
    useActiveTransformStore.getState().begin();
    frame();
    expect(useSceneCollisionStore.getState().baselinePending).toBe(false);
    useActiveTransformStore.getState().end();
    nowMs += BASELINE_SETTLE_MS; // 옛 창은 지났지만 재개가 새 창을 연다
    scan();
    expect(useSceneCollisionStore.getState().baselinePending).toBe(true);
    nowMs += BASELINE_SETTLE_MS;
    scan();
    expect(useSceneCollisionStore.getState().baselinePending).toBe(false);
  });

  it('BVH 가 없어 재시도 중인 쌍이 있으면 기준선이 유지되고, BVH 가 생기면 풀린다', () => {
    const a = mountModel('a', 0);
    mountModel('b', 0.5); // 겹침 → 정밀 검사 필요
    const body = a.children[0] as Mesh;
    const geometry = body.geometry as BvhGeometry;
    delete geometry.boundsTree;
    renderHook(() =>
      useSceneCollisionDetector({
        sceneInfo: scene(['a', 'b']),
        enabled: true,
        runner: 'simulation',
      }),
    );
    scan();
    expect(sceneCollisionRuntime.currentPhase).toBe('baseline');
    expect(useSceneCollisionStore.getState().baselinePending).toBe(true);

    // 변화 없는 스캔은 스토어 참조를 흔들지 않는다.
    const before = useSceneCollisionStore.getState();
    scan();
    expect(useSceneCollisionStore.getState()).toBe(before);

    geometry.boundsTree = new MeshBVH(geometry);
    // 재시도 대기와 안정화 창은 독립이다 — 둘 다 지나야 scanning.
    nowMs += Math.max(BVH_RETRY_MS, BASELINE_SETTLE_MS);
    scan();
    expect(sceneCollisionRuntime.currentPhase).toBe('scanning');
    expect(useSceneCollisionStore.getState().baselinePending).toBe(false);
  });

  it('enabled=false 전환·언마운트 시 false 로 돌아간다', () => {
    const a = mountModel('a', 0);
    mountModel('b', 0.5);
    delete (a.children[0] as Mesh).geometry.boundsTree;
    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useSceneCollisionDetector({
          sceneInfo: scene(['a', 'b']),
          enabled,
          runner: 'simulation',
        }),
      { initialProps: { enabled: true } },
    );
    scan();
    expect(useSceneCollisionStore.getState().baselinePending).toBe(true);
    rerender({ enabled: false });
    expect(useSceneCollisionStore.getState().baselinePending).toBe(false);
    rerender({ enabled: true });
    // 무장만으로는 올리지 않는다 — 첫 스캔이 올린다.
    expect(useSceneCollisionStore.getState().baselinePending).toBe(false);
    scan();
    expect(useSceneCollisionStore.getState().baselinePending).toBe(true);
    unmount();
    expect(useSceneCollisionStore.getState().baselinePending).toBe(false);
  });
});
