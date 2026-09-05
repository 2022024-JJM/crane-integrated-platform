// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  resetFullscreenStoreForTests,
  useFullscreen,
  useIsFullscreenActive,
} from '../use-fullscreen';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * jsdom 은 Fullscreen API 가 없다. `fullscreenElement` 를 직접 세우고
 * `fullscreenchange` 를 dispatch 해 브라우저 동작을 흉내 낸다 — 상태는
 * 이벤트로만 바뀌어야 하므로 request/exit 는 이벤트를 자동으로 내지 않는다.
 */
let fullscreenElement: Element | null = null;
const requestFullscreen = vi.fn<() => Promise<void>>();
const exitFullscreen = vi.fn<() => Promise<void>>();

function dispatchChange(next: Element | null) {
  fullscreenElement = next;
  act(() => {
    document.dispatchEvent(new Event('fullscreenchange'));
  });
}

/** 브라우저가 문서 전체화면 진입을 완료한 상황. */
function enterDocumentFullscreen() {
  dispatchChange(document.documentElement);
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  fullscreenElement = null;
  resetFullscreenStoreForTests();
  requestFullscreen.mockReset().mockResolvedValue(undefined);
  exitFullscreen.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenElement,
  });
  Object.defineProperty(document, 'fullscreenEnabled', {
    configurable: true,
    get: () => true,
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: exitFullscreen,
  });
  document.documentElement.requestFullscreen = requestFullscreen;
});

afterEach(() => {
  cleanup();
});

describe('toggleFullscreen', () => {
  it('문서 전체(documentElement)에 requestFullscreen 을 요청한다', () => {
    const { result } = renderHook(() => useFullscreen());
    act(() => result.current.toggleFullscreen());
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it('toggle 자체는 상태를 바꾸지 않는다 — fullscreenchange 가 와야 바뀐다', () => {
    const { result } = renderHook(() => useFullscreen());
    act(() => result.current.toggleFullscreen());
    expect(result.current.isFullscreen).toBe(false);
  });

  it('진입이 완료되면 켠 인스턴스만 isFullscreen 이 된다', () => {
    const owner = renderHook(() => useFullscreen());
    const other = renderHook(() => useFullscreen());
    act(() => owner.result.current.toggleFullscreen());
    enterDocumentFullscreen();
    expect(owner.result.current.isFullscreen).toBe(true);
    expect(other.result.current.isFullscreen).toBe(false);
  });

  it('주인이 다시 누르면 exitFullscreen', () => {
    const { result } = renderHook(() => useFullscreen());
    act(() => result.current.toggleFullscreen());
    enterDocumentFullscreen();
    act(() => result.current.toggleFullscreen());
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('주인이 아닌 인스턴스가 누르면 exit 가 아니라 주인을 넘겨받아 요청한다', () => {
    const owner = renderHook(() => useFullscreen());
    const other = renderHook(() => useFullscreen());
    act(() => owner.result.current.toggleFullscreen());
    enterDocumentFullscreen();
    act(() => other.result.current.toggleFullscreen());
    expect(exitFullscreen).not.toHaveBeenCalled();
    expect(requestFullscreen).toHaveBeenCalledTimes(2);
    // 문서는 이미 전체화면이라 change 이벤트 없이도 주인만 바뀐다.
    expect(other.result.current.isFullscreen).toBe(true);
    expect(owner.result.current.isFullscreen).toBe(false);
  });

  it('요청이 거부되면 주인을 되돌리고 예외가 새지 않는다', async () => {
    requestFullscreen.mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useFullscreen());
    act(() => result.current.toggleFullscreen());
    await flushPromises();
    // 거부 뒤 브라우저가 진입시켜도(불가능하지만) 주인이 없어 전체화면으로 치지 않는다.
    enterDocumentFullscreen();
    expect(result.current.isFullscreen).toBe(false);
  });
});

describe('fullscreenchange', () => {
  it('ESC 로 나가면 false 가 되고 주인도 사라진다', () => {
    const { result } = renderHook(() => useFullscreen());
    act(() => result.current.toggleFullscreen());
    enterDocumentFullscreen();
    dispatchChange(null);
    expect(result.current.isFullscreen).toBe(false);
    // 다시 진입해도 주인이 없으니 전체화면으로 치지 않는다 — toggle 을 다시 눌러야 한다.
    enterDocumentFullscreen();
    expect(result.current.isFullscreen).toBe(false);
  });

  it('문서가 아닌 다른 요소의 전체화면은 무시한다', () => {
    const { result } = renderHook(() => useFullscreen());
    act(() => result.current.toggleFullscreen());
    dispatchChange(document.createElement('section'));
    expect(result.current.isFullscreen).toBe(false);
  });

  it('주인이 언마운트되면 전체화면을 끝낸다', () => {
    const { result, unmount } = renderHook(() => useFullscreen());
    act(() => result.current.toggleFullscreen());
    enterDocumentFullscreen();
    unmount();
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it('주인이 아닌 인스턴스의 언마운트는 전체화면을 건드리지 않는다', () => {
    const owner = renderHook(() => useFullscreen());
    const other = renderHook(() => useFullscreen());
    act(() => owner.result.current.toggleFullscreen());
    enterDocumentFullscreen();
    other.unmount();
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it('마지막 구독자가 사라지면 문서 리스너를 뗀다', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const a = renderHook(() => useFullscreen());
    const b = renderHook(() => useFullscreen());
    a.unmount();
    expect(removeSpy).not.toHaveBeenCalledWith(
      'fullscreenchange',
      expect.any(Function),
    );
    b.unmount();
    expect(removeSpy).toHaveBeenCalledWith(
      'fullscreenchange',
      expect.any(Function),
    );
    removeSpy.mockRestore();
  });
});

describe('useIsFullscreenActive', () => {
  it('주인이 켠 문서 전체화면일 때만 true', () => {
    const active = renderHook(() => useIsFullscreenActive());
    const owner = renderHook(() => useFullscreen());
    expect(active.result.current).toBe(false);

    // 우리 코드가 켠 게 아닌 문서 전체화면 — 주인 없음.
    enterDocumentFullscreen();
    expect(active.result.current).toBe(false);
    dispatchChange(null);

    act(() => owner.result.current.toggleFullscreen());
    enterDocumentFullscreen();
    expect(active.result.current).toBe(true);

    dispatchChange(null);
    expect(active.result.current).toBe(false);
  });
});

describe('supported', () => {
  it('document.fullscreenEnabled 를 그대로 반영한다', () => {
    expect(renderHook(() => useFullscreen()).result.current.supported).toBe(
      true,
    );
    cleanup();
    Object.defineProperty(document, 'fullscreenEnabled', {
      configurable: true,
      get: () => false,
    });
    expect(renderHook(() => useFullscreen()).result.current.supported).toBe(
      false,
    );
  });
});
