// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DOCK_SIZE_DEFAULT,
  DOCK_SIZE_MAX,
  DOCK_SIZE_MIN,
  clampDockSize,
  dockStorageKey,
  readDockPinned,
  readDockSize,
  writeDockPinned,
  writeDockSize,
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
    expect(dockStorageKey('tools', 'size')).toBe(
      'crane:monitoring-dock:tools:size',
    );
  });
});

describe('clampDockSize', () => {
  it('경계 정확값은 통과, 밖은 경계로 잘린다', () => {
    expect(clampDockSize(DOCK_SIZE_MIN)).toBe(DOCK_SIZE_MIN);
    expect(clampDockSize(DOCK_SIZE_MAX)).toBe(DOCK_SIZE_MAX);
    expect(clampDockSize(DOCK_SIZE_MIN - 1)).toBe(DOCK_SIZE_MIN);
    expect(clampDockSize(DOCK_SIZE_MAX + 1)).toBe(DOCK_SIZE_MAX);
    expect(clampDockSize(-100)).toBe(DOCK_SIZE_MIN);
    expect(clampDockSize(1000)).toBe(DOCK_SIZE_MAX);
  });

  it('NaN·Infinity 는 기본값으로 떨어진다', () => {
    expect(clampDockSize(Number.NaN)).toBe(DOCK_SIZE_DEFAULT);
    expect(clampDockSize(Number.POSITIVE_INFINITY)).toBe(DOCK_SIZE_DEFAULT);
    expect(clampDockSize(Number.NEGATIVE_INFINITY)).toBe(DOCK_SIZE_DEFAULT);
  });
});

describe('pinned', () => {
  it('값이 없으면 false', () => {
    expect(readDockPinned('status')).toBe(false);
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
    writeDockPinned('tools', true);
    expect(readDockPinned('tools')).toBe(true);
    expect(readDockPinned('status')).toBe(false);
  });

  it('storage 접근이 던져도 기본값을 돌려주고 예외를 내지 않는다', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeDockPinned('status', true)).not.toThrow();
    expect(readDockPinned('status')).toBe(false);
    expect(readDockSize('status')).toBe(DOCK_SIZE_DEFAULT);
  });
});

describe('size', () => {
  it('값이 없거나 빈 문자열이면 기본값', () => {
    expect(readDockSize('status')).toBe(DOCK_SIZE_DEFAULT);
    window.localStorage.setItem('crane:monitoring-dock:status:size', '');
    expect(readDockSize('status')).toBe(DOCK_SIZE_DEFAULT);
    window.localStorage.setItem('crane:monitoring-dock:status:size', '   ');
    expect(readDockSize('status')).toBe(DOCK_SIZE_DEFAULT);
  });

  it('쓴 값을 그대로 읽는다 (소수 포함)', () => {
    expect(writeDockSize('status', 33.5)).toBe(33.5);
    expect(readDockSize('status')).toBe(33.5);
  });

  it('쓸 때 클램프되어 저장되고 읽을 때도 클램프된다', () => {
    expect(writeDockSize('status', DOCK_SIZE_MAX + 10)).toBe(DOCK_SIZE_MAX);
    expect(readDockSize('status')).toBe(DOCK_SIZE_MAX);

    window.localStorage.setItem('crane:monitoring-dock:status:size', '5');
    expect(readDockSize('status')).toBe(DOCK_SIZE_MIN);
  });

  it('손상값(문자·NaN·Infinity)은 기본값', () => {
    window.localStorage.setItem('crane:monitoring-dock:status:size', 'abc');
    expect(readDockSize('status')).toBe(DOCK_SIZE_DEFAULT);
    window.localStorage.setItem('crane:monitoring-dock:status:size', 'NaN');
    expect(readDockSize('status')).toBe(DOCK_SIZE_DEFAULT);
    window.localStorage.setItem(
      'crane:monitoring-dock:status:size',
      'Infinity',
    );
    expect(readDockSize('status')).toBe(DOCK_SIZE_DEFAULT);
  });
});
