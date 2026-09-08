import { beforeEach, describe, expect, it } from 'vitest';
import {
  useObjectFocusStore,
  type FocusCameraPose,
} from '../use-object-focus-store';

const store = useObjectFocusStore;

const poseA: FocusCameraPose = { position: [1, 2, 3], target: [0, 0, 0] };
const poseB: FocusCameraPose = { position: [9, 9, 9], target: [4, 5, 6] };

beforeEach(() => {
  store.getState().exitFocus();
});

describe('useObjectFocusStore — 진입', () => {
  it('enterFocus 는 대상 id 와 복귀 포즈를 함께 저장한다', () => {
    store.getState().enterFocus('m1', poseA);
    const s = store.getState();
    expect(s.focusedModelId).toBe('m1');
    expect(s.returnPose).toBe(poseA);
  });

  it('복귀 포즈 없이(null) 진입할 수 있다 — 해제 시 기본 카메라 폴백용', () => {
    store.getState().enterFocus('m1', null);
    expect(store.getState().focusedModelId).toBe('m1');
    expect(store.getState().returnPose).toBeNull();
  });

  it('포커스 중 다른 모델 enterFocus 는 no-op — 대상·포즈·상태 참조 모두 유지', () => {
    store.getState().enterFocus('m1', poseA);
    const before = store.getState();
    store.getState().enterFocus('m2', poseB);
    expect(store.getState()).toBe(before);
    expect(store.getState().focusedModelId).toBe('m1');
    expect(store.getState().returnPose).toBe(poseA);
  });

  it('같은 모델 재진입도 no-op — 나중 포즈로 덮어쓰지 않는다', () => {
    store.getState().enterFocus('m1', poseA);
    const before = store.getState();
    store.getState().enterFocus('m1', poseB);
    expect(store.getState()).toBe(before);
    expect(store.getState().returnPose).toBe(poseA);
  });

  it('빈 문자열 id 도 그대로 포커스된다(특성화 — 검증은 상위가 한다)', () => {
    store.getState().enterFocus('', null);
    expect(store.getState().focusedModelId).toBe('');
  });
});

describe('useObjectFocusStore — 해제', () => {
  it('exitFocus 는 대상과 포즈를 모두 비운다', () => {
    store.getState().enterFocus('m1', poseA);
    store.getState().exitFocus();
    expect(store.getState().focusedModelId).toBeNull();
    expect(store.getState().returnPose).toBeNull();
  });

  it('포커스가 없을 때 exitFocus 는 no-op — 상태 참조 유지', () => {
    const before = store.getState();
    store.getState().exitFocus();
    expect(store.getState()).toBe(before);
  });

  it('해제 뒤에는 다른 모델로 새로 진입할 수 있다(1단계: 나가야 다음 진입)', () => {
    store.getState().enterFocus('m1', poseA);
    store.getState().exitFocus();
    store.getState().enterFocus('m2', poseB);
    expect(store.getState().focusedModelId).toBe('m2');
    expect(store.getState().returnPose).toBe(poseB);
  });

  it('subscribe 리스너는 해제 전이에서 prev 로 복귀 포즈를 읽을 수 있다', () => {
    const seen: Array<FocusCameraPose | null> = [];
    const unsubscribe = store.subscribe((state, prev) => {
      if (prev.focusedModelId !== null && state.focusedModelId === null) {
        seen.push(prev.returnPose);
      }
    });
    store.getState().enterFocus('m1', poseA);
    store.getState().exitFocus();
    unsubscribe();
    expect(seen).toEqual([poseA]);
  });

  it('진입 전이에서는 해제 리스너가 호출되지 않는다', () => {
    let calls = 0;
    const unsubscribe = store.subscribe((state, prev) => {
      if (prev.focusedModelId !== null && state.focusedModelId === null) {
        calls += 1;
      }
    });
    store.getState().enterFocus('m1', poseA);
    unsubscribe();
    expect(calls).toBe(0);
  });
});
