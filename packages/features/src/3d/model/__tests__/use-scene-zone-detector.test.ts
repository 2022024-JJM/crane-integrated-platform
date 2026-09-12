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
  type SavedModelZone,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import { ZONE_SCAN_INTERVAL_MS } from '../../lib/scene-zones';
import { sceneZoneRuntime } from '../scene-zone-runtime';
import { useSceneZoneDetector } from '../use-scene-zone-detector';
import { useSceneZoneStore } from '../use-scene-zone-store';

/** R3F 프레임 루프·invalidate 를 가로챈다(use-rig-driver.test 와 같은 방식). */
const captured = vi.hoisted(() => ({
  frameCallback: null as null | ((state: unknown, delta: number) => void),
  invalidate: vi.fn(),
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    captured.frameCallback = callback;
  },
  useThree: (selector: (s: { invalidate: () => void }) => unknown) =>
    selector({ invalidate: captured.invalidate }),
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
  nowMs += ZONE_SCAN_INTERVAL_MS;
  frame();
}

function mountModel(id: string, x: number) {
  const root = new Group();
  const body = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  root.add(body);
  root.position.set(x, 0, 0);
  root.updateMatrixWorld(true);
  (body.geometry as BvhGeometry).boundsTree = new MeshBVH(body.geometry);
  modelObjectRegistry.register(id, root);
  return root;
}

function model(id: string, zones?: SavedModelZone[]): SavedModelInfo {
  const info: SavedModelInfo = {
    id,
    equipName: id,
    path: '/m.glb',
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
  if (zones) info.zones = zones;
  return info;
}

const ZONE: SavedModelZone = {
  id: 'z',
  name: 'Z',
  color: '#38bdf8',
  radius: 2,
};

function scene(): SavedSceneInfo {
  return { maps: [], models: [model('a', [ZONE]), model('b')] };
}

function moveX(root: Group, x: number) {
  root.position.x = x;
  root.updateMatrixWorld(true);
}

function render(
  props: Partial<Parameters<typeof useSceneZoneDetector>[0]> = {},
) {
  const initial = { sceneInfo: scene(), enabled: true, ...props };
  return renderHook(
    (p: Parameters<typeof useSceneZoneDetector>[0]) => useSceneZoneDetector(p),
    { initialProps: initial },
  );
}

beforeEach(() => {
  nowMs = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  modelObjectRegistry.clear();
  sceneZoneRuntime.disarm();
  useSceneZoneStore.setState({ enabled: true, intrusions: [] });
  captured.frameCallback = null;
  captured.invalidate.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  modelObjectRegistry.clear();
  sceneZoneRuntime.disarm();
});

describe('useSceneZoneDetector — 무장·해제', () => {
  it('enabled=false 면 프레임이 런타임을 건드리지 않는다', () => {
    const tick = vi.spyOn(sceneZoneRuntime, 'tick');
    render({ enabled: false });
    scan();
    scan();
    expect(tick).not.toHaveBeenCalled();
    expect(sceneZoneRuntime.isArmed).toBe(false);
  });

  it('enabled 면 arm 하고 첫 프레임을 요청하며, 언마운트 시 disarm + 목록 비움', () => {
    mountModel('a', 0);
    mountModel('b', 1);
    const { unmount } = render();
    expect(sceneZoneRuntime.isArmed).toBe(true);
    expect(captured.invalidate).toHaveBeenCalled();
    scan();
    expect(useSceneZoneStore.getState().intrusions).toHaveLength(1);

    unmount();
    expect(sceneZoneRuntime.isArmed).toBe(false);
    expect(useSceneZoneStore.getState().intrusions).toEqual([]);
  });

  it('스캔 간격 미만의 프레임은 tick 을 부르지 않는다', () => {
    const tick = vi.spyOn(sceneZoneRuntime, 'tick');
    render();
    frame();
    frame();
    expect(tick).toHaveBeenCalledTimes(0);
    scan();
    expect(tick).toHaveBeenCalledTimes(1);
    nowMs += ZONE_SCAN_INTERVAL_MS - 1;
    frame();
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('models 참조가 바뀌면 sync 한다', () => {
    const sync = vi.spyOn(sceneZoneRuntime, 'sync');
    const { rerender } = render();
    expect(sync).toHaveBeenCalledTimes(1);
    rerender({ sceneInfo: scene(), enabled: true });
    expect(sync).toHaveBeenCalledTimes(2);
  });
});

describe('useSceneZoneDetector — 상태 갱신·프레임 요청', () => {
  it('러너와 무관하게 현재 침범 목록이 갱신되고 나가면 비워진다', () => {
    mountModel('a', 0);
    const b = mountModel('b', 5);
    render();
    scan();
    expect(useSceneZoneStore.getState().intrusions).toEqual([]);

    moveX(b, 1);
    scan();
    expect(useSceneZoneStore.getState().intrusions).toHaveLength(1);
    expect(useSceneZoneStore.getState().intrusions[0].intruders[0].id).toBe(
      'b',
    );

    moveX(b, 10);
    scan();
    expect(useSceneZoneStore.getState().intrusions).toEqual([]);
  });

  it('움직임·전이가 있는 틱만 프레임을 다시 요청한다', () => {
    mountModel('a', 0);
    const b = mountModel('b', 5);
    render();
    captured.invalidate.mockClear();
    scan(); // 첫 스캔: 항목 생성·박스 측정 → moved
    expect(captured.invalidate).toHaveBeenCalledTimes(1);
    captured.invalidate.mockClear();
    scan(); // 조용한 틱
    expect(captured.invalidate).not.toHaveBeenCalled();

    moveX(b, 1);
    scan(); // moved + enter → 2회
    expect(captured.invalidate).toHaveBeenCalledTimes(2);
  });
});
