// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useFullscreen } from '../use-fullscreen';

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

function setup() {
  const hook = renderHook(() => useFullscreen<HTMLDivElement>());
  const root = document.createElement('div');
  root.requestFullscreen = requestFullscreen;
  hook.result.current.rootRef.current = root;
  return { ...hook, root };
}

beforeEach(() => {
  fullscreenElement = null;
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
});

afterEach(() => {
  cleanup();
});

describe('toggleFullscreen', () => {
  it('전체화면이 아니면 루트에 requestFullscreen 을 요청한다', () => {
    const { result } = setup();
    act(() => result.current.toggleFullscreen());
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it('루트가 전체화면이면 exitFullscreen 을 부른다', () => {
    const { result, root } = setup();
    fullscreenElement = root;
    act(() => result.current.toggleFullscreen());
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('다른 요소가 전체화면이면 exit 가 아니라 루트를 요청한다', () => {
    const { result } = setup();
    fullscreenElement = document.createElement('section');
    act(() => result.current.toggleFullscreen());
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it('루트 ref 가 비어 있으면 아무것도 하지 않는다', () => {
    const { result } = renderHook(() => useFullscreen<HTMLDivElement>());
    act(() => result.current.toggleFullscreen());
    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(exitFullscreen).not.toHaveBeenCalled();
    expect(result.current.isFullscreen).toBe(false);
  });

  it('요청이 거부돼도 상태는 false 그대로고 예외가 새지 않는다', async () => {
    requestFullscreen.mockRejectedValue(new Error('denied'));
    const { result } = setup();
    act(() => result.current.toggleFullscreen());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isFullscreen).toBe(false);
  });

  it('toggle 자체는 상태를 바꾸지 않는다 — fullscreenchange 가 와야 바뀐다', () => {
    const { result } = setup();
    act(() => result.current.toggleFullscreen());
    expect(result.current.isFullscreen).toBe(false);
  });
});

describe('fullscreenchange', () => {
  it('루트가 전체화면 요소가 되면 true, 빠지면 false', () => {
    const { result, root } = setup();
    dispatchChange(root);
    expect(result.current.isFullscreen).toBe(true);
    dispatchChange(null);
    expect(result.current.isFullscreen).toBe(false);
  });

  it('다른 요소의 전체화면은 무시한다', () => {
    const { result } = setup();
    dispatchChange(document.createElement('section'));
    expect(result.current.isFullscreen).toBe(false);
  });

  it('언마운트 뒤에는 이벤트를 듣지 않는다', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = setup();
    unmount();
    expect(removeSpy).toHaveBeenCalledWith(
      'fullscreenchange',
      expect.any(Function),
    );
    removeSpy.mockRestore();
  });
});

describe('supported', () => {
  it('document.fullscreenEnabled 를 그대로 반영한다', () => {
    expect(setup().result.current.supported).toBe(true);
    cleanup();
    Object.defineProperty(document, 'fullscreenEnabled', {
      configurable: true,
      get: () => false,
    });
    expect(setup().result.current.supported).toBe(false);
  });
});
