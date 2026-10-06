// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSceneCanvasDpr } from '../use-scene-canvas-dpr';
import { useSceneGraphicsStore } from '../use-scene-graphics-store';

/** change 리스너를 모아 두는 matchMedia 대역 — 마지막에 건 것만 살아 있다. */
function installMatchMedia() {
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addEventListener: (_type: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.delete(listener);
      },
    })),
  );
  return {
    listeners,
    /** 기기 값을 바꾸고 브라우저의 change 를 흉내 낸다. */
    change(devicePixelRatio: number) {
      vi.stubGlobal('devicePixelRatio', devicePixelRatio);
      for (const listener of [...listeners]) listener();
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  useSceneGraphicsStore.setState({ renderScale: 1 });
  vi.stubGlobal('devicePixelRatio', 1);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSceneCanvasDpr', () => {
  it('배율 1(기본)이면 기본 범위 [1, 1.5]', () => {
    installMatchMedia();
    const { result } = renderHook(() => useSceneCanvasDpr());
    expect(result.current).toEqual([1, 1.5]);
  });

  it('배율을 낮추면 기기 값 × 배율 숫자로 바뀐다', () => {
    installMatchMedia();
    const { result } = renderHook(() => useSceneCanvasDpr());
    act(() => useSceneGraphicsStore.getState().setRenderScale(0.7));
    expect(result.current).toBeCloseTo(0.7, 10);
    act(() => useSceneGraphicsStore.getState().setRenderScale(0.5));
    expect(result.current).toBeCloseTo(0.5, 10);
  });

  it('배율을 1 로 되돌리면 기본 범위로 돌아온다', () => {
    installMatchMedia();
    const { result } = renderHook(() => useSceneCanvasDpr());
    act(() => useSceneGraphicsStore.getState().setRenderScale(0.7));
    act(() => useSceneGraphicsStore.getState().setRenderScale(1));
    expect(result.current).toEqual([1, 1.5]);
  });

  it('기기 값이 바뀌면(모니터 이동·브라우저 확대) 다시 계산한다', () => {
    const media = installMatchMedia();
    useSceneGraphicsStore.setState({ renderScale: 0.5 });
    const { result } = renderHook(() => useSceneCanvasDpr());
    expect(result.current).toBeCloseTo(0.5, 10);
    act(() => media.change(1.25));
    expect(result.current).toBeCloseTo(0.625, 10);
    // 상한(1.5)을 넘는 기기 값은 잘린다.
    act(() => media.change(3));
    expect(result.current).toBeCloseTo(0.75, 10);
  });

  it('값이 그대로인 리렌더에는 같은 참조를 돌려준다 (Canvas prop 이 흔들리지 않는다)', () => {
    installMatchMedia();
    const { result, rerender } = renderHook(() => useSceneCanvasDpr());
    const before = result.current;
    rerender();
    expect(result.current).toBe(before);
  });

  it('언마운트하면 기기 값 리스너를 걷어낸다', () => {
    const media = installMatchMedia();
    const { unmount } = renderHook(() => useSceneCanvasDpr());
    expect(media.listeners.size).toBe(1);
    unmount();
    expect(media.listeners.size).toBe(0);
  });

  it('matchMedia 가 없어도 마운트 시점의 기기 값으로 동작한다', () => {
    vi.stubGlobal('matchMedia', undefined);
    vi.stubGlobal('devicePixelRatio', 2);
    useSceneGraphicsStore.setState({ renderScale: 0.7 });
    const { result } = renderHook(() => useSceneCanvasDpr());
    expect(result.current).toBeCloseTo(1.05, 10);
  });
});
