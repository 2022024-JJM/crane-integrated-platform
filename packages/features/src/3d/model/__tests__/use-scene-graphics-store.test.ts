// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { useSceneGraphicsStore } from '../use-scene-graphics-store';

/**
 * 저장 키를 리터럴로 고정한다 — 키가 바뀌면 이미 낮춰 둔 PC 의 설정이
 * 조용히 사라진다.
 */
const GRAPHICS_SETTINGS_STORAGE_KEY = 'crane:graphics-settings';

function stored(): unknown {
  const raw = window.localStorage.getItem(GRAPHICS_SETTINGS_STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

beforeEach(() => {
  window.localStorage.clear();
  useSceneGraphicsStore.setState({ renderScale: 1 });
});

describe('useSceneGraphicsStore', () => {
  it('저장값이 없으면 배율 1 로 시작한다', () => {
    expect(useSceneGraphicsStore.getState().renderScale).toBe(1);
  });

  it('배율을 바꾸면 상태와 localStorage 에 함께 반영된다', () => {
    useSceneGraphicsStore.getState().setRenderScale(0.7);
    expect(useSceneGraphicsStore.getState().renderScale).toBe(0.7);
    expect(stored()).toEqual({ renderScale: 0.7 });
  });

  it('기본값으로 되돌려도 저장된다 (낮췄다 올린 PC 가 낮은 값으로 남지 않는다)', () => {
    useSceneGraphicsStore.getState().setRenderScale(0.5);
    useSceneGraphicsStore.getState().setRenderScale(1);
    expect(useSceneGraphicsStore.getState().renderScale).toBe(1);
    expect(stored()).toEqual({ renderScale: 1 });
  });

  it('같은 값 재설정은 no-op — 상태 참조를 유지하고 저장하지 않는다', () => {
    const before = useSceneGraphicsStore.getState();
    useSceneGraphicsStore.getState().setRenderScale(1);
    expect(useSceneGraphicsStore.getState()).toBe(before);
    expect(stored()).toBeNull();
  });

  it('목록에 없는 값은 무시한다 — 상태·저장소 모두 그대로', () => {
    useSceneGraphicsStore.getState().setRenderScale(0.85);
    const before = useSceneGraphicsStore.getState();
    for (const bad of [0.6, 2, 0, Number.NaN, '0.7', null]) {
      useSceneGraphicsStore.getState().setRenderScale(bad as never);
    }
    expect(useSceneGraphicsStore.getState()).toBe(before);
    expect(stored()).toEqual({ renderScale: 0.85 });
  });

  it('구독자는 값이 바뀔 때만 불린다', () => {
    let calls = 0;
    const unsubscribe = useSceneGraphicsStore.subscribe(() => {
      calls += 1;
    });
    useSceneGraphicsStore.getState().setRenderScale(0.7);
    useSceneGraphicsStore.getState().setRenderScale(0.7);
    unsubscribe();
    expect(calls).toBe(1);
  });
});
