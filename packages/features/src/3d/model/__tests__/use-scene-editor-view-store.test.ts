import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SCENE_SNAP_STEP_OPTIONS,
  SCENE_TRANSFORM_SNAP,
  useSceneEditorViewStore,
} from '../use-scene-editor-view-store';
import { writeSnapStep } from '../../lib/snap-storage';

// 스토어의 setSnapStep 이 영속화를 부르는지만 본다 — 저장소 자체는
// snap-storage.test 가 검증한다.
vi.mock('../../lib/snap-storage', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../lib/snap-storage')>();
  return { ...actual, writeSnapStep: vi.fn() };
});

const store = useSceneEditorViewStore;
const writeSnapStepMock = vi.mocked(writeSnapStep);

beforeEach(() => {
  writeSnapStepMock.mockClear();
  store.setState({
    snapEnabled: false,
    snapStep: SCENE_TRANSFORM_SNAP,
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

  it('스냅 단위 기본값은 SCENE_TRANSFORM_SNAP 이다 (node 환경 = 저장소 없음)', () => {
    expect(store.getState().snapStep).toEqual(SCENE_TRANSFORM_SNAP);
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
    const stepBefore = store.getState().snapStep;
    store.getState().setTransformSpace('world');
    store.getState().toggleGrid();
    store.getState().toggleSnap();
    const s = store.getState();
    expect(s.snapEnabled).toBe(true);
    expect(s.transformSpace).toBe('world');
    expect(s.showGrid).toBe(true);
    expect(s.snapStep).toBe(stepBefore);
  });
});

describe('useSceneEditorViewStore — setSnapStep', () => {
  it('채널 하나만 바꾸고 나머지 채널·필드는 그대로', () => {
    store.getState().setSnapStep('translation', 0.25);
    const s = store.getState();
    expect(s.snapStep.translation).toBe(0.25);
    expect(s.snapStep.rotation).toBe(SCENE_TRANSFORM_SNAP.rotation);
    expect(s.snapStep.scale).toBe(SCENE_TRANSFORM_SNAP.scale);
    expect(s.snapEnabled).toBe(false);
    expect(s.showGrid).toBe(false);
  });

  it('바뀔 때만 영속화한다', () => {
    store
      .getState()
      .setSnapStep('rotation', SCENE_SNAP_STEP_OPTIONS.rotation[0]);
    expect(writeSnapStepMock).toHaveBeenCalledTimes(1);
    expect(writeSnapStepMock).toHaveBeenCalledWith(store.getState().snapStep);
  });

  it('같은 값을 다시 설정하면 no-op — 상태 참조 유지, 저장 안 함', () => {
    const before = store.getState();
    store.getState().setSnapStep('scale', SCENE_TRANSFORM_SNAP.scale);
    expect(store.getState()).toBe(before);
    expect(store.getState().snapStep).toBe(before.snapStep);
    expect(writeSnapStepMock).not.toHaveBeenCalled();
  });

  it('snapEnabled 는 단위 변경에 영향받지 않는다 — 켜기는 toggleSnap 만', () => {
    store.getState().setSnapStep('translation', 0.1);
    expect(store.getState().snapEnabled).toBe(false);
  });
});
