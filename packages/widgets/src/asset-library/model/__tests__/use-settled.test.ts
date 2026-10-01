// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettled } from '../use-settled';

describe('useSettled', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('지연 전에는 false, 지연이 지나면 true', () => {
    const { result } = renderHook(() => useSettled('a', 200));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(199));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it('값이 바뀌면 즉시 false 로 돌아가고 시간을 다시 잰다', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useSettled(value, 200),
      { initialProps: { value: 'a' } },
    );
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe(true);
    rerender({ value: 'b' });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(150));
    rerender({ value: 'c' });
    act(() => vi.advanceTimersByTime(150));
    // b 의 타이머는 취소됐고 c 는 아직 지연 전이다.
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBe(true);
  });

  it('언마운트하면 타이머가 남지 않는다', () => {
    const { unmount } = renderHook(() => useSettled('a', 200));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
