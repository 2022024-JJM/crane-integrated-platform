// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useCollisionGuardSimulation } from '../use-collision-guard-simulation';
import {
  useCollisionGuardStore,
  type CollisionGuardZone,
} from '../use-collision-guard-store';

/**
 * 시뮬레이션은 Math.random과 useFrame delta에만 의존한다. 둘 다 통제한다:
 * - Math.random → 시드 고정 PRNG(mulberry32) — 실행마다 같은 궤적
 * - useFrame → 콜백을 잡아 두고 dt를 수동 주입
 *
 * 에이전트 내부 상태(agentsRef)는 밖에서 볼 수 없으므로, 스토어에 나타나는
 * 관측 가능한 전이(트랙 생성 좌표·phase)로 경계값을 검증한다.
 */
const captured = vi.hoisted(() => ({
  frameCallback: null as null | ((state: unknown, delta: number) => void),
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    captured.frameCallback = callback;
  },
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RADIUS = 20;
const EXIT_HYSTERESIS_M = 5; // 구현의 이탈 히스테리시스와 같은 값

const zone: CollisionGuardZone = {
  center: [0, 0],
  y: 0,
  radius: RADIUS,
  dangerRadius: 6,
  metersPerUnit: 1,
  sizeMultiplier: 1,
};

function step(dt = 0.1) {
  act(() => {
    captured.frameCallback?.(undefined, dt);
  });
}

/** 조건이 참이 될 때까지 최대 maxSteps 프레임 진행. 걸린 스텝 수, 실패 시 -1 */
function stepUntil(condition: () => boolean, maxSteps: number): number {
  for (let i = 0; i < maxSteps; i++) {
    if (condition()) return i;
    step();
  }
  return condition() ? maxSteps : -1;
}

function tracks() {
  return useCollisionGuardStore.getState().tracks;
}

beforeEach(() => {
  vi.spyOn(Math, 'random').mockImplementation(mulberry32(20260901));
  useCollisionGuardStore.setState({ enabled: false, tracks: [] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useCollisionGuardStore.setState({ enabled: false, tracks: [] });
});

describe('useCollisionGuardSimulation', () => {
  it('꺼져 있으면 아무 트랙도 만들지 않는다', () => {
    renderHook(() => useCollisionGuardSimulation([zone]));
    for (let i = 0; i < 100; i++) step();
    expect(tracks()).toHaveLength(0);
  });

  it('에이전트가 감지 반경을 넘는 순간 트랙이 생긴다 — 첫 좌표는 경계 안', () => {
    renderHook(() => useCollisionGuardSimulation([zone]));
    act(() => useCollisionGuardStore.getState().setEnabled(true));

    const found = stepUntil(() => tracks().length > 0, 1200);
    expect(found).toBeGreaterThanOrEqual(0);

    const first = tracks()[0];
    const dist = Math.hypot(first.target.x, first.target.z);
    // 스폰은 반경 밖(1.12r)에서 일어나므로, 첫 관측은 경계를 갓 넘은
    // 위치여야 한다: radius 이하 & 센서 주기(0.2s) 동안 이동 가능 거리 이내.
    expect(dist).toBeLessThanOrEqual(RADIUS);
    expect(dist).toBeGreaterThan(RADIUS - 2.5);
    expect(first.phase).toBe('active');
    expect(['person', 'car', 'forklift']).toContain(first.type);
  });

  it('이탈(목표 도달·반경+히스테리시스 밖)하면 phase가 leaving으로 전이한다', () => {
    renderHook(() => useCollisionGuardSimulation([zone]));
    act(() => useCollisionGuardStore.getState().setEnabled(true));

    expect(stepUntil(() => tracks().length > 0, 1200)).toBeGreaterThanOrEqual(0);

    const found = stepUntil(
      () => tracks().some((t) => t.phase === 'leaving'),
      4000,
    );
    expect(found).toBeGreaterThanOrEqual(0);

    // markLeaving은 제거가 아니다 — fade-out은 렌더러 몫이라 트랙은 남는다.
    expect(tracks().length).toBeGreaterThan(0);
  });

  it('가드를 끄면 다음 프레임에 남은 트랙을 정리한다', () => {
    renderHook(() => useCollisionGuardSimulation([zone]));
    act(() => useCollisionGuardStore.getState().setEnabled(true));
    expect(stepUntil(() => tracks().length > 0, 1200)).toBeGreaterThanOrEqual(0);

    act(() => useCollisionGuardStore.getState().setEnabled(false));
    step();
    expect(tracks()).toHaveLength(0);
  });

  it('언마운트 시 스토어를 정리하고 enabled도 내린다', () => {
    const { unmount } = renderHook(() => useCollisionGuardSimulation([zone]));
    act(() => useCollisionGuardStore.getState().setEnabled(true));
    expect(stepUntil(() => tracks().length > 0, 1200)).toBeGreaterThanOrEqual(0);

    unmount();
    expect(tracks()).toHaveLength(0);
    expect(useCollisionGuardStore.getState().enabled).toBe(false);
  });

  it('트랙 좌표는 항상 반경+히스테리시스 안에서만 갱신된다', () => {
    renderHook(() => useCollisionGuardSimulation([zone]));
    act(() => useCollisionGuardStore.getState().setEnabled(true));

    const outerBound = RADIUS + EXIT_HYSTERESIS_M / zone.metersPerUnit;
    for (let i = 0; i < 2000; i++) {
      step();
      for (const track of tracks()) {
        if (track.phase !== 'active') continue;
        const dist = Math.hypot(track.target.x, track.target.z);
        expect(dist).toBeLessThanOrEqual(outerBound);
      }
    }
  });
});
