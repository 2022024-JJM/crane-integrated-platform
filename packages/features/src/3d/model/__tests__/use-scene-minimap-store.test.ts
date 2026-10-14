// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MINIMAP_POSITION_STORAGE_KEY,
  MINIMAP_STORAGE_KEY,
  MINIMAP_VISIBLE_DEFAULT,
  readMinimapPosition,
  readMinimapVisible,
  useSceneMinimapStore,
  type MinimapSnapshot,
} from '../use-scene-minimap-store';

function snapshot(): MinimapSnapshot {
  return {
    image: document.createElement('canvas'),
    frame: {
      minX: 0,
      minZ: 0,
      worldWidth: 10,
      worldDepth: 10,
      pxWidth: 100,
      pxHeight: 100,
    },
    capturedAt: 1,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  useSceneMinimapStore.setState({
    snapshot: null,
    visible: MINIMAP_VISIBLE_DEFAULT,
    position: null,
  });
});

describe('position', () => {
  it('저장값 없음·손상·비유한수·예전 px 모양은 null', () => {
    expect(readMinimapPosition()).toBeNull();
    window.localStorage.setItem(MINIMAP_POSITION_STORAGE_KEY, '{garbage');
    expect(readMinimapPosition()).toBeNull();
    window.localStorage.setItem(
      MINIMAP_POSITION_STORAGE_KEY,
      JSON.stringify({ fx: 'a', fy: 1 }),
    );
    expect(readMinimapPosition()).toBeNull();
    // px 로 저장하던 예전 모양은 비율로 바꿀 수 없어 기본 자리.
    window.localStorage.setItem(
      MINIMAP_POSITION_STORAGE_KEY,
      JSON.stringify({ x: 12, y: 34 }),
    );
    expect(readMinimapPosition()).toBeNull();
    window.localStorage.setItem(
      MINIMAP_POSITION_STORAGE_KEY,
      JSON.stringify({ fx: 0.25, fy: 1, extra: true }),
    );
    expect(readMinimapPosition()).toEqual({ fx: 0.25, fy: 1 });
  });

  it('범위 밖 비율은 [0,1] 로 클램프', () => {
    window.localStorage.setItem(
      MINIMAP_POSITION_STORAGE_KEY,
      JSON.stringify({ fx: 1.5, fy: -0.2 }),
    );
    expect(readMinimapPosition()).toEqual({ fx: 1, fy: 0 });
  });

  it('setPosition 은 영속하고 같은 비율·null 재설정은 참조 유지, null 은 저장 삭제', () => {
    const store = useSceneMinimapStore;
    store.getState().setPosition({ fx: 0.5, fy: 0.6 });
    expect(
      JSON.parse(window.localStorage.getItem(MINIMAP_POSITION_STORAGE_KEY)!),
    ).toEqual({ fx: 0.5, fy: 0.6 });
    const before = store.getState();
    store.getState().setPosition({ fx: 0.5, fy: 0.6 });
    expect(store.getState()).toBe(before);
    store.getState().setPosition(null);
    expect(store.getState().position).toBeNull();
    expect(
      window.localStorage.getItem(MINIMAP_POSITION_STORAGE_KEY),
    ).toBeNull();
    const afterNull = store.getState();
    store.getState().setPosition(null);
    expect(store.getState()).toBe(afterNull);
  });
});

describe('readMinimapVisible', () => {
  it('저장값 없음 → 기본(표시), "1"/"0" 만 해석', () => {
    expect(readMinimapVisible()).toBe(MINIMAP_VISIBLE_DEFAULT);
    window.localStorage.setItem(MINIMAP_STORAGE_KEY, '0');
    expect(readMinimapVisible()).toBe(false);
    window.localStorage.setItem(MINIMAP_STORAGE_KEY, '1');
    expect(readMinimapVisible()).toBe(true);
    window.localStorage.setItem(MINIMAP_STORAGE_KEY, 'garbage');
    expect(readMinimapVisible()).toBe(false);
  });
});

describe('visible', () => {
  it('setVisible 은 영속하고 같은 값 재설정은 상태 참조 유지', () => {
    const store = useSceneMinimapStore;
    store.getState().setVisible(false);
    expect(store.getState().visible).toBe(false);
    expect(window.localStorage.getItem(MINIMAP_STORAGE_KEY)).toBe('0');
    const before = store.getState();
    store.getState().setVisible(false);
    expect(store.getState()).toBe(before);
  });

  it('toggleVisible 은 반전한다', () => {
    useSceneMinimapStore.getState().toggleVisible();
    expect(useSceneMinimapStore.getState().visible).toBe(
      !MINIMAP_VISIBLE_DEFAULT,
    );
    useSceneMinimapStore.getState().toggleVisible();
    expect(useSceneMinimapStore.getState().visible).toBe(
      MINIMAP_VISIBLE_DEFAULT,
    );
  });
});

describe('snapshot', () => {
  it('설정·해제, 같은 참조 재설정은 no-op', () => {
    const s = snapshot();
    useSceneMinimapStore.getState().setSnapshot(s);
    expect(useSceneMinimapStore.getState().snapshot).toBe(s);
    const before = useSceneMinimapStore.getState();
    useSceneMinimapStore.getState().setSnapshot(s);
    expect(useSceneMinimapStore.getState()).toBe(before);
    useSceneMinimapStore.getState().setSnapshot(null);
    expect(useSceneMinimapStore.getState().snapshot).toBeNull();
  });
});
