// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { modelObjectRegistry, type SavedMapInfo } from '@crane/domain/3d';
import {
  GROUND_SAMPLE_INTERVAL_S,
  useCollisionGuardGroundZones,
} from '../use-collision-guard-ground';
import type { CollisionGuardZone } from '../use-collision-guard-store';

/**
 * 훅은 useFrame 과 레지스트리·raycast 에만 기댄다. useFrame 은 콜백을 잡아
 * 두고 clock 을 수동 주입해 스로틀을 결정론적으로 검사한다. 지도는 실제
 * three 메시(수평 바닥판)를 레지스트리에 등록해 raycast 가 실제로 돌게 한다.
 */
const captured = vi.hoisted(() => ({
  frameCallback: null as
    | null
    | ((state: { clock: { elapsedTime: number } }) => void),
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: { clock: { elapsedTime: number } }) => void) => {
    captured.frameCallback = callback;
  },
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/** y 높이에 놓인 400×400 수평 바닥판 */
function flatGround(y: number): Mesh {
  const mesh = new Mesh(new PlaneGeometry(400, 400), new MeshBasicMaterial());
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.updateMatrixWorld(true);
  return mesh;
}

function zone(center: [number, number], y: number): CollisionGuardZone {
  return {
    center,
    y,
    radius: 60,
    dangerRadius: 25.6,
    metersPerUnit: 1.17,
    sizeMultiplier: 4,
  };
}

const MAP_A: SavedMapInfo = { id: 'map-a', path: '/maps/a.glb' };
const MAP_B: SavedMapInfo = { id: 'map-b', path: '/maps/b.glb' };

let clock = 0;
function frame(advanceS = GROUND_SAMPLE_INTERVAL_S) {
  clock += advanceS;
  act(() => {
    captured.frameCallback?.({ clock: { elapsedTime: clock } });
  });
}

beforeEach(() => {
  clock = 0;
  captured.frameCallback = null;
});

afterEach(() => {
  cleanup();
  modelObjectRegistry.clear();
});

describe('useCollisionGuardGroundZones', () => {
  it('groundMaps 가 비면 입력 참조를 그대로 돌려주고 raycast 하지 않는다', () => {
    modelObjectRegistry.register(MAP_A.id, flatGround(3.5));
    const zones = [zone([10, 10], 5)];
    const { result } = renderHook(() =>
      useCollisionGuardGroundZones(zones, []),
    );
    expect(result.current).toBe(zones);
    frame();
    expect(result.current).toBe(zones);
  });

  it('지도가 아직 등록되지 않았으면 폴백 y·입력 참조를 유지하고, 등록 뒤 프레임에 표면 y 로 해석한다', () => {
    const zones = [zone([10, 10], 5), zone([-50, 20], 5)];
    const maps = [MAP_A];
    const { result } = renderHook(() =>
      useCollisionGuardGroundZones(zones, maps),
    );
    frame();
    expect(result.current).toBe(zones);
    expect(result.current[0].y).toBe(5);

    modelObjectRegistry.register(MAP_A.id, flatGround(3.587));
    frame();
    expect(result.current).not.toBe(zones);
    expect(result.current[0].y).toBeCloseTo(3.587, 5);
    expect(result.current[1].y).toBeCloseTo(3.587, 5);
    // y 외 필드는 그대로
    expect(result.current[0].center).toBe(zones[0].center);
    expect(result.current[0].radius).toBe(60);
  });

  it('해석 뒤 같은 값이 다시 나오면 결과 배열 참조를 유지한다', () => {
    modelObjectRegistry.register(MAP_A.id, flatGround(3.587));
    const zones = [zone([0, 0], 5)];
    const maps = [MAP_A];
    const { result } = renderHook(() =>
      useCollisionGuardGroundZones(zones, maps),
    );
    frame();
    const resolved = result.current;
    expect(resolved[0].y).toBeCloseTo(3.587, 5);
    frame();
    frame(10);
    expect(result.current).toBe(resolved);
  });

  it('겹친 지도는 가장 높은 표면, 일부 존만 miss 면 그 존은 폴백 y 를 유지한다', () => {
    modelObjectRegistry.register(MAP_A.id, flatGround(0.593));
    modelObjectRegistry.register(MAP_B.id, flatGround(3.587));
    const zones = [zone([0, 0], 5), zone([1000, 1000], 5)];
    const maps = [MAP_A, MAP_B];
    const { result } = renderHook(() =>
      useCollisionGuardGroundZones(zones, maps),
    );
    frame();
    expect(result.current[0].y).toBeCloseTo(3.587, 5);
    expect(result.current[1].y).toBe(5);
    expect(result.current[1]).toBe(zones[1]);
  });

  it('모든 존이 miss 면 입력 참조를 돌려준다', () => {
    modelObjectRegistry.register(MAP_A.id, flatGround(2));
    const zones = [zone([1000, 1000], 5)];
    const maps = [MAP_A];
    const { result } = renderHook(() =>
      useCollisionGuardGroundZones(zones, maps),
    );
    frame();
    expect(result.current).toBe(zones);
  });

  it('미해석 상태에서는 스로틀 간격이 지나기 전엔 raycast 를 재시도하지 않는다', () => {
    const zones = [zone([0, 0], 5)];
    const maps = [MAP_A];
    const getSpy = vi.spyOn(modelObjectRegistry, 'get');
    const { result } = renderHook(() =>
      useCollisionGuardGroundZones(zones, maps),
    );
    frame();
    const callsAfterFirst = getSpy.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    modelObjectRegistry.register(MAP_A.id, flatGround(3));
    frame(GROUND_SAMPLE_INTERVAL_S / 2);
    expect(getSpy.mock.calls.length).toBe(callsAfterFirst);
    expect(result.current).toBe(zones);

    frame(GROUND_SAMPLE_INTERVAL_S / 2);
    expect(getSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    expect(result.current[0].y).toBeCloseTo(3, 5);
    getSpy.mockRestore();
  });

  it('같은 id 의 지도 객체가 교체되면(재로드) 스로틀 뒤 다시 잰다', () => {
    modelObjectRegistry.register(MAP_A.id, flatGround(3.587));
    const zones = [zone([0, 0], 5)];
    const maps = [MAP_A];
    const { result } = renderHook(() =>
      useCollisionGuardGroundZones(zones, maps),
    );
    frame();
    expect(result.current[0].y).toBeCloseTo(3.587, 5);

    modelObjectRegistry.register(MAP_A.id, flatGround(7.25));
    frame();
    expect(result.current[0].y).toBeCloseTo(7.25, 5);
  });

  it('zones 참조가 바뀌면(크레인 이동) 이전 해석을 버리고 스로틀 없이 바로 다시 잰다', () => {
    modelObjectRegistry.register(MAP_A.id, flatGround(3.587));
    const zonesA = [zone([0, 0], 5)];
    const maps = [MAP_A];
    const { result, rerender } = renderHook(
      ({ zones }) => useCollisionGuardGroundZones(zones, maps),
      { initialProps: { zones: zonesA } },
    );
    frame();
    expect(result.current[0].y).toBeCloseTo(3.587, 5);

    // 새 존은 지도 밖 — 이전 해석값(3.587)이 새 존에 붙으면 안 된다.
    const zonesB = [zone([1000, 1000], 9)];
    rerender({ zones: zonesB });
    expect(result.current).toBe(zonesB);
    frame(0);
    expect(result.current).toBe(zonesB);
    expect(result.current[0].y).toBe(9);
  });

  it('groundMaps 참조가 바뀌면 그 지도로 다시 잰다', () => {
    modelObjectRegistry.register(MAP_A.id, flatGround(1));
    modelObjectRegistry.register(MAP_B.id, flatGround(4));
    const zones = [zone([0, 0], 5)];
    const { result, rerender } = renderHook(
      ({ maps }) => useCollisionGuardGroundZones(zones, maps),
      { initialProps: { maps: [MAP_A] as readonly SavedMapInfo[] } },
    );
    frame();
    expect(result.current[0].y).toBeCloseTo(1, 5);
    rerender({ maps: [MAP_B] });
    frame(0);
    expect(result.current[0].y).toBeCloseTo(4, 5);
  });
});
