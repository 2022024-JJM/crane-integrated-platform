// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  DOCK_CLOSE_DELAY_MS,
  DOCK_OPEN_DELAY_MS,
} from '../../lib/dock-hover-state';
import { DOCK_SIZE_DEFAULT, DOCK_SIZE_MAX } from '../../lib/dock-storage';
import { useSceneDock } from '../use-scene-dock';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const PINNED_KEY = 'crane:monitoring-dock:status:pinned';
const SIZE_KEY = 'crane:monitoring-dock:status:size';

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function keyEvent(key: string) {
  return { key } as ReactKeyboardEvent<HTMLElement>;
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  // hover 테스트는 미고정 상태를 전제한다 — 기본값은 고정이므로 명시적으로 푼다.
  window.localStorage.setItem(PINNED_KEY, '0');
  window.localStorage.setItem('crane:monitoring-dock:tools:pinned', '0');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useSceneDock — hover 타이머', () => {
  it('enter 후 openDelay 직전엔 접혀 있고 정확히 지나면 펼쳐진다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    act(() => result.current.handlers.onPointerEnter());
    advance(DOCK_OPEN_DELAY_MS - 1);
    expect(result.current.expanded).toBe(false);
    advance(1);
    expect(result.current.expanded).toBe(true);
  });

  it('openDelay 전에 leave 하면 지연이 다 지나도 펼쳐지지 않는다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    act(() => result.current.handlers.onPointerEnter());
    advance(DOCK_OPEN_DELAY_MS - 1);
    act(() => result.current.handlers.onPointerLeave());
    advance(DOCK_OPEN_DELAY_MS * 5);
    expect(result.current.expanded).toBe(false);
  });

  it('leave 후 closeDelay 직전엔 펼쳐져 있고 정확히 지나면 접힌다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    act(() => result.current.handlers.onPointerEnter());
    advance(DOCK_OPEN_DELAY_MS);
    act(() => result.current.handlers.onPointerLeave());
    advance(DOCK_CLOSE_DELAY_MS - 1);
    expect(result.current.expanded).toBe(true);
    advance(1);
    expect(result.current.expanded).toBe(false);
  });

  it('closeDelay 전에 재진입하면 타이머가 취소되어 계속 펼쳐져 있다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    act(() => result.current.handlers.onPointerEnter());
    advance(DOCK_OPEN_DELAY_MS);
    act(() => result.current.handlers.onPointerLeave());
    advance(DOCK_CLOSE_DELAY_MS - 1);
    act(() => result.current.handlers.onPointerEnter());
    advance(DOCK_CLOSE_DELAY_MS * 5);
    expect(result.current.expanded).toBe(true);
  });

  it('leave→enter→leave 처럼 같은 타이머가 연달아 예약돼도 마지막 leave 기준으로 접힌다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    act(() => result.current.handlers.onPointerEnter());
    advance(DOCK_OPEN_DELAY_MS);
    act(() => result.current.handlers.onPointerLeave());
    advance(DOCK_CLOSE_DELAY_MS - 50);
    act(() => result.current.handlers.onPointerEnter());
    act(() => result.current.handlers.onPointerLeave());
    // 첫 예약 기준이면 50ms 뒤 접혀야 하지만, 재예약이므로 아직 펼쳐져 있어야 한다
    advance(50);
    expect(result.current.expanded).toBe(true);
    advance(DOCK_CLOSE_DELAY_MS - 50);
    expect(result.current.expanded).toBe(false);
  });

  it('hold 중엔 leave 해도 접히지 않고, hold 가 풀린 뒤 closeDelay 후 접힌다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    act(() => result.current.handlers.onPointerEnter());
    advance(DOCK_OPEN_DELAY_MS);
    act(() => result.current.handlers.holdStart());
    act(() => result.current.handlers.onPointerLeave());
    advance(DOCK_CLOSE_DELAY_MS * 5);
    expect(result.current.expanded).toBe(true);
    act(() => result.current.handlers.holdEnd());
    advance(DOCK_CLOSE_DELAY_MS - 1);
    expect(result.current.expanded).toBe(true);
    advance(1);
    expect(result.current.expanded).toBe(false);
  });

  it('Escape 는 즉시 접고 다른 키는 무시한다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    act(() => result.current.handlers.onPointerEnter());
    advance(DOCK_OPEN_DELAY_MS);
    act(() => result.current.handlers.onKeyDown(keyEvent('Enter')));
    expect(result.current.expanded).toBe(true);
    act(() => result.current.handlers.onKeyDown(keyEvent('Escape')));
    expect(result.current.expanded).toBe(false);
  });

  it('onToggle 은 지연 없이 즉시 펼치고, 다시 누르면 접는다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    act(() => result.current.handlers.onToggle());
    expect(result.current.expanded).toBe(true);
    act(() => result.current.handlers.onToggle());
    expect(result.current.expanded).toBe(false);
  });

  it('언마운트되면 대기 중인 타이머가 정리되어 발화하지 않는다', () => {
    const { result, unmount } = renderHook(() => useSceneDock('status'));
    act(() => result.current.handlers.onPointerEnter());
    unmount();
    expect(() => advance(DOCK_OPEN_DELAY_MS * 2)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handlers 객체는 리렌더를 거쳐도 같은 참조다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    const before = result.current.handlers;
    act(() => result.current.handlers.onPointerEnter());
    advance(DOCK_OPEN_DELAY_MS);
    expect(result.current.handlers).toBe(before);
  });
});

describe('useSceneDock — pin 영속화', () => {
  it("저장된 pin 이 없으면 기본값(고정·펼침)으로, '0' 이면 접힌 채 시작한다", () => {
    window.localStorage.removeItem(PINNED_KEY);
    const cold = renderHook(() => useSceneDock('status'));
    expect(cold.result.current.pinned).toBe(true);
    expect(cold.result.current.expanded).toBe(true);
    cold.unmount();

    window.localStorage.setItem(PINNED_KEY, '0');
    const unpinned = renderHook(() => useSceneDock('status'));
    expect(unpinned.result.current.pinned).toBe(false);
    expect(unpinned.result.current.expanded).toBe(false);
  });

  it('setPinned 는 storage 에 쓰고 즉시 펼친다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    act(() => result.current.setPinned(true));
    expect(result.current.pinned).toBe(true);
    expect(result.current.expanded).toBe(true);
    expect(window.localStorage.getItem(PINNED_KEY)).toBe('1');
  });

  it('togglePinned 는 현재 값을 뒤집는다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    act(() => result.current.togglePinned());
    expect(result.current.pinned).toBe(true);
    act(() => result.current.togglePinned());
    expect(result.current.pinned).toBe(false);
    expect(window.localStorage.getItem(PINNED_KEY)).toBe('0');
  });

  it('고정 중엔 leave 해도 접히지 않고, unpin 하면(마우스 밖) closeDelay 후 접힌다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    act(() => result.current.setPinned(true));
    act(() => result.current.handlers.onPointerLeave());
    advance(DOCK_CLOSE_DELAY_MS * 5);
    expect(result.current.expanded).toBe(true);

    act(() => result.current.setPinned(false));
    expect(result.current.expanded).toBe(true);
    advance(DOCK_CLOSE_DELAY_MS);
    expect(result.current.expanded).toBe(false);
  });

  it('독 id 가 다르면 pin 이 섞이지 않는다', () => {
    const status = renderHook(() => useSceneDock('status'));
    const tools = renderHook(() => useSceneDock('tools'));
    act(() => status.result.current.setPinned(true));
    expect(tools.result.current.pinned).toBe(false);
    expect(
      window.localStorage.getItem('crane:monitoring-dock:tools:pinned'),
    ).toBe('0');
  });
});

describe('useSceneDock — size 영속화', () => {
  it('저장값이 없으면 기본 크기, 있으면 그 값으로 시작한다', () => {
    const cold = renderHook(() => useSceneDock('status'));
    expect(cold.result.current.size).toBe(DOCK_SIZE_DEFAULT);
    cold.unmount();

    window.localStorage.setItem(SIZE_KEY, '55');
    const warm = renderHook(() => useSceneDock('status'));
    expect(warm.result.current.size).toBe(55);
  });

  it('setSize 는 클램프해서 저장한다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    act(() => result.current.setSize(DOCK_SIZE_MAX + 30));
    expect(result.current.size).toBe(DOCK_SIZE_MAX);
    expect(window.localStorage.getItem(SIZE_KEY)).toBe(String(DOCK_SIZE_MAX));
  });

  it('같은 크기를 다시 넣으면 storage 에 다시 쓰지 않는다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    act(() => result.current.setSize(50));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    act(() => result.current.setSize(50));
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('NaN 은 기본값으로 떨어진다', () => {
    const { result } = renderHook(() => useSceneDock('status'));
    act(() => result.current.setSize(Number.NaN));
    expect(result.current.size).toBe(DOCK_SIZE_DEFAULT);
  });
});
