// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewerDisplay } from '../use-viewer-display';

const theme = vi.hoisted(() => ({ current: 'dark' }));
vi.mock('@crane/core/lib/theme-context', () => ({
  useTheme: () => ({ theme: theme.current }),
}));

describe('useViewerDisplay', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    theme.current = 'dark';
  });

  it('기억한 것이 없으면 기본값으로 시작한다', () => {
    const { result } = renderHook(() => useViewerDisplay());
    expect(result.current.display).toEqual({
      viewMode: 'lit',
      background: 'dark',
      showGrid: true,
      showDimensions: true,
      turntable: true,
      animationPlaying: true,
      animationSpeed: 1,
      animationClip: null,
    });
  });

  it('끈 토글은 새로 마운트한 뷰어에도 꺼진 채 이어진다', () => {
    const first = renderHook(() => useViewerDisplay());
    act(() => first.result.current.setDisplay({ showGrid: false }));
    act(() => first.result.current.setDisplay({ turntable: false }));
    expect(first.result.current.display).toMatchObject({
      showGrid: false,
      showDimensions: true,
      turntable: false,
    });
    first.unmount();

    const second = renderHook(() => useViewerDisplay());
    expect(second.result.current.display).toMatchObject({
      showGrid: false,
      showDimensions: true,
      turntable: false,
    });
  });

  it('다시 켠 토글도 이어진다', () => {
    const first = renderHook(() => useViewerDisplay());
    act(() => first.result.current.setDisplay({ showDimensions: false }));
    act(() => first.result.current.setDisplay({ showDimensions: true }));
    first.unmount();

    const second = renderHook(() => useViewerDisplay());
    expect(second.result.current.display.showDimensions).toBe(true);
  });

  it('고른 배경은 테마가 바뀌어도 새로 마운트한 뷰어에 이어진다', () => {
    const first = renderHook(() => useViewerDisplay());
    act(() => first.result.current.setDisplay({ background: 'blueprint' }));
    expect(first.result.current.display.background).toBe('blueprint');
    first.unmount();

    theme.current = 'light';
    const second = renderHook(() => useViewerDisplay());
    expect(second.result.current.display.background).toBe('blueprint');
  });

  it('배경을 고른 적이 없으면 마운트할 때의 테마를 따른다', () => {
    const first = renderHook(() => useViewerDisplay());
    act(() => first.result.current.setDisplay({ showGrid: false }));
    expect(first.result.current.display.background).toBe('dark');
    first.unmount();

    theme.current = 'light';
    const second = renderHook(() => useViewerDisplay());
    expect(second.result.current.display).toMatchObject({
      background: 'light',
      showGrid: false,
    });
  });

  it('고른 뷰 모드는 새로 마운트한 뷰어에 이어진다', () => {
    const first = renderHook(() => useViewerDisplay());
    act(() => first.result.current.setDisplay({ viewMode: 'wireframe' }));
    expect(first.result.current.display.viewMode).toBe('wireframe');
    first.unmount();

    const second = renderHook(() => useViewerDisplay());
    expect(second.result.current.display.viewMode).toBe('wireframe');

    act(() => second.result.current.setDisplay({ viewMode: 'lit' }));
    second.unmount();
    const third = renderHook(() => useViewerDisplay());
    expect(third.result.current.display.viewMode).toBe('lit');
  });

  it('기억해 둔 값은 마운트할 때 한 번만 읽는다', () => {
    // 함께 떠 있는 뷰어끼리는 맞추지 않는다 — 다음에 여는 뷰어부터 이어받는다.
    const open = renderHook(() => useViewerDisplay());
    const other = renderHook(() => useViewerDisplay());
    act(() => other.result.current.setDisplay({ showGrid: false }));
    open.rerender();
    expect(open.result.current.display.showGrid).toBe(true);
  });

  it('같은 값을 다시 고르면 상태 값이 그대로다', () => {
    const { result } = renderHook(() => useViewerDisplay());
    const before = result.current.display;
    act(() => result.current.setDisplay({ showGrid: true }));
    expect(result.current.display).toEqual(before);
  });

  it('setDisplay 는 렌더가 바뀌어도 같은 함수다', () => {
    const { result, rerender } = renderHook(() => useViewerDisplay());
    const before = result.current.setDisplay;
    act(() => result.current.setDisplay({ showGrid: false }));
    rerender();
    expect(result.current.setDisplay).toBe(before);
  });
});
