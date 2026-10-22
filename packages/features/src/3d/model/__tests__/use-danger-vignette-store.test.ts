// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DANGER_VIGNETTE_STORAGE_KEY,
  readDangerVignetteEnabled,
  useDangerVignetteStore,
  writeDangerVignetteEnabled,
} from '../use-danger-vignette-store';

beforeEach(() => {
  window.localStorage.clear();
  useDangerVignetteStore.setState({ enabled: true });
});

describe('readDangerVignetteEnabled', () => {
  it('저장값이 없으면 기본 켜짐, "0" 만 꺼짐, 그 밖의 값은 꺼짐으로 읽지 않는다', () => {
    expect(readDangerVignetteEnabled()).toBe(true);
    window.localStorage.setItem(DANGER_VIGNETTE_STORAGE_KEY, '0');
    expect(readDangerVignetteEnabled()).toBe(false);
    window.localStorage.setItem(DANGER_VIGNETTE_STORAGE_KEY, '1');
    expect(readDangerVignetteEnabled()).toBe(true);
    // 손상된 값은 켜짐도 꺼짐도 아닌 "1 이 아님" — 꺼짐으로 읽힌다(현재 동작 고정).
    window.localStorage.setItem(DANGER_VIGNETTE_STORAGE_KEY, 'yes');
    expect(readDangerVignetteEnabled()).toBe(false);
  });

  it('writeDangerVignetteEnabled 는 "1"/"0" 으로 쓴다', () => {
    writeDangerVignetteEnabled(false);
    expect(window.localStorage.getItem(DANGER_VIGNETTE_STORAGE_KEY)).toBe('0');
    writeDangerVignetteEnabled(true);
    expect(window.localStorage.getItem(DANGER_VIGNETTE_STORAGE_KEY)).toBe('1');
  });
});

describe('useDangerVignetteStore', () => {
  it('toggle 은 값을 뒤집고 영속한다', () => {
    useDangerVignetteStore.getState().toggle();
    expect(useDangerVignetteStore.getState().enabled).toBe(false);
    expect(window.localStorage.getItem(DANGER_VIGNETTE_STORAGE_KEY)).toBe('0');
    useDangerVignetteStore.getState().toggle();
    expect(useDangerVignetteStore.getState().enabled).toBe(true);
    expect(window.localStorage.getItem(DANGER_VIGNETTE_STORAGE_KEY)).toBe('1');
  });

  it('같은 값으로 setEnabled 하면 상태 참조와 저장소가 그대로다', () => {
    const before = useDangerVignetteStore.getState();
    before.setEnabled(true);
    expect(useDangerVignetteStore.getState()).toBe(before);
    expect(window.localStorage.getItem(DANGER_VIGNETTE_STORAGE_KEY)).toBeNull();
  });
});
