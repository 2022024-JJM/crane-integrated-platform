// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DOCK_PINNED_DEFAULT,
  dockStorageKey,
  readDockPinned,
  writeDockPinned,
} from '../dock-storage';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dockStorageKey', () => {
  it('crane:monitoring-dock:<id>:<field> 형식이다', () => {
    expect(dockStorageKey('status', 'pinned')).toBe(
      'crane:monitoring-dock:status:pinned',
    );
    expect(dockStorageKey('tools', 'pinned')).toBe(
      'crane:monitoring-dock:tools:pinned',
    );
  });
});

describe('pinned', () => {
  it('값이 없으면 기본값(고정)', () => {
    expect(DOCK_PINNED_DEFAULT).toBe(true);
    expect(readDockPinned('status')).toBe(DOCK_PINNED_DEFAULT);
  });

  it("'1' 만 true 로 읽고 그 외 문자열은 false 다", () => {
    writeDockPinned('status', true);
    expect(
      window.localStorage.getItem('crane:monitoring-dock:status:pinned'),
    ).toBe('1');
    expect(readDockPinned('status')).toBe(true);

    writeDockPinned('status', false);
    expect(readDockPinned('status')).toBe(false);

    window.localStorage.setItem('crane:monitoring-dock:status:pinned', 'true');
    expect(readDockPinned('status')).toBe(false);
  });

  it('독 id 별로 분리 저장된다', () => {
    writeDockPinned('tools', false);
    expect(readDockPinned('tools')).toBe(false);
    expect(readDockPinned('status')).toBe(DOCK_PINNED_DEFAULT);
  });

  it('storage 접근이 던져도 기본값을 돌려주고 예외를 내지 않는다', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeDockPinned('status', false)).not.toThrow();
    expect(readDockPinned('status')).toBe(DOCK_PINNED_DEFAULT);
  });
});
