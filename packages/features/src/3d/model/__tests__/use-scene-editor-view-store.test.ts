import { beforeEach, describe, expect, it } from 'vitest';
import {
  SCENE_TRANSFORM_SNAP,
  useSceneEditorViewStore,
} from '../use-scene-editor-view-store';

const store = useSceneEditorViewStore;

beforeEach(() => {
  store.setState({
    snapEnabled: false,
    transformSpace: 'local',
    showGrid: false,
  });
});

describe('useSceneEditorViewStore — 기본값', () => {
  it('스냅 off · 로컬 축 · 격자 off 로 시작한다 (기존 편집기 동작과 동일)', () => {
    const s = store.getState();
    expect(s.snapEnabled).toBe(false);
    expect(s.transformSpace).toBe('local');
    expect(s.showGrid).toBe(false);
  });

  it('회전 스냅은 15° 를 라디안으로 든다 — TransformControls 는 라디안을 받는다', () => {
    expect(SCENE_TRANSFORM_SNAP.rotation).toBeCloseTo((15 * Math.PI) / 180, 12);
    expect(SCENE_TRANSFORM_SNAP.translation).toBe(1);
    expect(SCENE_TRANSFORM_SNAP.scale).toBe(0.1);
  });
});

describe('useSceneEditorViewStore — 토글', () => {
  it('toggleSnap 두 번이면 원래 값으로 돌아온다', () => {
    store.getState().toggleSnap();
    expect(store.getState().snapEnabled).toBe(true);
    store.getState().toggleSnap();
    expect(store.getState().snapEnabled).toBe(false);
  });

  it('toggleGrid 는 격자만 뒤집는다', () => {
    store.getState().toggleGrid();
    expect(store.getState().showGrid).toBe(true);
    expect(store.getState().snapEnabled).toBe(false);
    expect(store.getState().transformSpace).toBe('local');
  });

  it('setTransformSpace 는 world ↔ local 을 오간다', () => {
    store.getState().setTransformSpace('world');
    expect(store.getState().transformSpace).toBe('world');
    store.getState().setTransformSpace('local');
    expect(store.getState().transformSpace).toBe('local');
  });

  it('같은 축을 다시 설정하면 no-op — 상태 참조 유지', () => {
    const before = store.getState();
    store.getState().setTransformSpace('local');
    expect(store.getState()).toBe(before);
  });

  it('한 토글은 다른 필드를 건드리지 않는다', () => {
    store.getState().setTransformSpace('world');
    store.getState().toggleGrid();
    store.getState().toggleSnap();
    const s = store.getState();
    expect(s.snapEnabled).toBe(true);
    expect(s.transformSpace).toBe('world');
    expect(s.showGrid).toBe(true);
  });
});
