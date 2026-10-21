// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useNow } from '../use-now';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useNow', () => {
  it('처음엔 현재 시각, 주기마다 갱신한다', () => {
    const { result } = renderHook(() => useNow(500));
    expect(result.current).toBe(10_000);
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe(10_000);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(10_500);
  });

  it('언마운트하면 타이머를 지운다', () => {
    const { unmount } = renderHook(() => useNow(100));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('주기를 바꾸면 이전 타이머를 지우고 새로 건다', () => {
    const { result, rerender } = renderHook(
      ({ ms }: { ms: number }) => useNow(ms),
      { initialProps: { ms: 1_000 } },
    );
    rerender({ ms: 100 });
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(10_100);
  });
});
