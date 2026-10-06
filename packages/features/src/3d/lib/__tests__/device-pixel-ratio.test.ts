// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDevicePixelRatio,
  subscribeDevicePixelRatio,
} from '../device-pixel-ratio';

interface FakeMedia {
  query: string;
  listeners: Set<() => void>;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

/** matchMedia 를 흉내 낸다 — 만든 쿼리를 순서대로 모아 둔다. */
function installMatchMedia() {
  const created: FakeMedia[] = [];
  const matchMedia = vi.fn((query: string) => {
    const media: FakeMedia = {
      query,
      listeners: new Set(),
      addEventListener: (_type, listener) => {
        media.listeners.add(listener);
      },
      removeEventListener: (_type, listener) => {
        media.listeners.delete(listener);
      },
    };
    created.push(media);
    return media;
  });
  vi.stubGlobal('matchMedia', matchMedia);
  return { created, matchMedia };
}

function setDevicePixelRatio(value: number) {
  vi.stubGlobal('devicePixelRatio', value);
}

/** 그 쿼리가 어긋났다고 알린다(브라우저의 change 이벤트). */
function fireChange(media: FakeMedia) {
  for (const listener of [...media.listeners]) listener();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('subscribeDevicePixelRatio', () => {
  it('지금 값과 같은 해상도 쿼리에 리스너를 건다', () => {
    const { created } = installMatchMedia();
    setDevicePixelRatio(1.25);
    subscribeDevicePixelRatio(() => {});
    expect(created).toHaveLength(1);
    expect(created[0].query).toBe('(resolution: 1.25dppx)');
    expect(created[0].listeners.size).toBe(1);
  });

  it('값이 바뀌면 콜백을 부르고 새 값의 쿼리로 다시 건다', () => {
    const { created } = installMatchMedia();
    setDevicePixelRatio(1);
    const onChange = vi.fn();
    subscribeDevicePixelRatio(onChange);

    setDevicePixelRatio(1.5);
    fireChange(created[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(2);
    expect(created[1].query).toBe('(resolution: 1.5dppx)');
    // 옛 쿼리의 리스너는 걷어낸다 — 두 번 불리지 않는다.
    expect(created[0].listeners.size).toBe(0);
    expect(created[1].listeners.size).toBe(1);

    setDevicePixelRatio(2);
    fireChange(created[1]);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(created[2].query).toBe('(resolution: 2dppx)');
  });

  it('콜백이 불릴 때는 이미 새 쿼리가 걸려 있다 (콜백 안에서 값을 읽어도 놓치지 않는다)', () => {
    const { created } = installMatchMedia();
    setDevicePixelRatio(1);
    const armedAtCallback: number[] = [];
    subscribeDevicePixelRatio(() => {
      armedAtCallback.push(created[created.length - 1].listeners.size);
    });
    setDevicePixelRatio(2);
    fireChange(created[0]);
    expect(armedAtCallback).toEqual([1]);
  });

  it('구독을 풀면 리스너가 남지 않고 이후 변화에 콜백이 불리지 않는다', () => {
    const { created } = installMatchMedia();
    setDevicePixelRatio(1);
    const onChange = vi.fn();
    const unsubscribe = subscribeDevicePixelRatio(onChange);
    unsubscribe();
    expect(created[0].listeners.size).toBe(0);
    setDevicePixelRatio(2);
    fireChange(created[0]);
    expect(onChange).not.toHaveBeenCalled();
    // 다시 걸지도 않는다.
    expect(created).toHaveLength(1);
  });

  it('변화 뒤에 풀어도 마지막으로 건 쿼리의 리스너가 걷힌다', () => {
    const { created } = installMatchMedia();
    setDevicePixelRatio(1);
    const unsubscribe = subscribeDevicePixelRatio(() => {});
    setDevicePixelRatio(1.5);
    fireChange(created[0]);
    unsubscribe();
    expect(created.map((media) => media.listeners.size)).toEqual([0, 0]);
  });

  it('구독을 두 번 풀어도 던지지 않는다', () => {
    installMatchMedia();
    setDevicePixelRatio(1);
    const unsubscribe = subscribeDevicePixelRatio(() => {});
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('matchMedia 가 없는 환경에서는 아무것도 걸지 않고 해제도 안전하다', () => {
    vi.stubGlobal('matchMedia', undefined);
    const onChange = vi.fn();
    const unsubscribe = subscribeDevicePixelRatio(onChange);
    expect(() => unsubscribe()).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('getDevicePixelRatio', () => {
  it('window.devicePixelRatio 를 그대로 읽는다', () => {
    setDevicePixelRatio(1.75);
    expect(getDevicePixelRatio()).toBe(1.75);
  });
});
