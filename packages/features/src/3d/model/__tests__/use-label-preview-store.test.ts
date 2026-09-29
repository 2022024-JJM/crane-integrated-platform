// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_LABEL_PREVIEW,
  getLabelState,
} from '../../lib/model-label-state';
import {
  useLabelPreview,
  useLabelPreviewState,
  useLabelPreviewStore,
  useOutlinePreviewState,
} from '../use-label-preview-store';

function store() {
  return useLabelPreviewStore.getState();
}

beforeEach(() => {
  useLabelPreviewStore.setState({
    modelId: null,
    preview: EMPTY_LABEL_PREVIEW,
    state: null,
    outline: null,
  });
});

describe('useLabelPreviewStore', () => {
  it('처음에는 미리보기가 없다', () => {
    expect(store().modelId).toBeNull();
    expect(store().state).toBeNull();
    expect(store().outline).toBeNull();
    expect(store().preview).toBe(EMPTY_LABEL_PREVIEW);
  });

  it('외곽선 값을 고르면 외곽선이 생기고 우선순위를 탄다', () => {
    store().setBit('m1', 'slowdown', true);
    expect(store().outline).toBe('slowdown');
    // 라벨 값은 고르지 않았다 — 라벨은 색 없는 미확인.
    expect(store().state).toBe(getLabelState('unknown'));

    store().setBit('m1', 'endstop', true);
    expect(store().outline).toBe('endstop');
    store().setBit('m1', 'commError', true);
    expect(store().outline).toBe('commError');

    store().setBit('m1', 'commError', false);
    expect(store().outline).toBe('endstop');
    store().setBit('m1', 'endstop', null);
    expect(store().outline).toBe('slowdown');
  });

  it('라벨 값만 고르면 외곽선은 없음(none) — 미리보기 없음(null)과 다르다', () => {
    store().setBit('m1', 'controlOn', true);
    expect(store().outline).toBe('none');
    store().setBit('m1', 'slowdown', false);
    expect(store().outline).toBe('none');
  });

  it('외곽선 값은 라벨의 색을 바꾸지 않는다', () => {
    store().setBit('m1', 'controlOn', true);
    store().setMoving('m1', true);
    const before = store().state;
    store().setBit('m1', 'endstop', true);
    expect(store().state).toBe(before);
    expect(store().outline).toBe('endstop');
  });

  it('값을 고르면 그 모델의 표시 상태가 생긴다', () => {
    store().setBit('m1', 'controlOn', true);
    expect(store().modelId).toBe('m1');
    expect(store().state).toBe(getLabelState('standby'));

    store().setMoving('m1', true);
    expect(store().state).toBe(getLabelState('running'));

    store().setBit('m1', 'bypass', true);
    expect(store().state).toBe(getLabelState('running', true));
  });

  it('다른 모델의 값을 고르면 앞선 미리보기는 버린다', () => {
    store().setBit('m1', 'fault', true);
    store().setBit('m1', 'bypass', true);
    store().setBit('m2', 'controlOn', false);
    expect(store().modelId).toBe('m2');
    expect(store().preview).toEqual({ bits: { controlOn: false } });
    expect(store().state).toBe(getLabelState('off'));
  });

  it('다른 모델의 값을 고르면 앞선 외곽선도 버린다', () => {
    store().setBit('m1', 'endstop', true);
    store().setBit('m2', 'fault', true);
    expect(store().modelId).toBe('m2');
    expect(store().outline).toBe('none');
  });

  it('마지막 값을 떼면 미리보기가 없어진다', () => {
    store().setBit('m1', 'fault', true);
    store().setMoving('m1', false);
    store().setBit('m1', 'fault', null);
    expect(store().modelId).toBe('m1');
    store().setMoving('m1', null);
    expect(store().modelId).toBeNull();
    expect(store().state).toBeNull();
    expect(store().preview).toBe(EMPTY_LABEL_PREVIEW);
  });

  it('같은 값을 다시 고르면 상태 참조가 그대로다', () => {
    store().setBit('m1', 'fault', true);
    const before = store();
    store().setBit('m1', 'fault', true);
    store().setBit('m1', 'bypass', null);
    store().setMoving('m1', null);
    expect(store()).toBe(before);
  });

  it('미리보기가 없는 모델에서 값을 떼도 다른 모델의 미리보기는 남는다', () => {
    store().setBit('m1', 'fault', true);
    const before = store();
    store().setBit('m2', 'fault', null);
    store().setMoving('m2', null);
    expect(store()).toBe(before);
  });

  it('clear 는 전부 지우고, 비어 있을 때는 아무것도 하지 않는다', () => {
    const empty = store();
    store().clear();
    expect(store()).toBe(empty);

    store().setBit('m1', 'fault', true);
    store().setBit('m1', 'endstop', true);
    store().clear();
    expect(store().modelId).toBeNull();
    expect(store().state).toBeNull();
    expect(store().outline).toBeNull();
    expect(store().preview).toBe(EMPTY_LABEL_PREVIEW);
  });

  it('마지막 외곽선 값을 떼면 외곽선 미리보기도 없어진다', () => {
    store().setBit('m1', 'slowdown', true);
    store().setBit('m1', 'slowdown', null);
    expect(store().modelId).toBeNull();
    expect(store().outline).toBeNull();
  });
});

describe('useOutlinePreviewState', () => {
  it('대상 모델만 외곽선을 받고 나머지는 undefined', () => {
    const target = renderHook(() => useOutlinePreviewState('m1'));
    const other = renderHook(() => useOutlinePreviewState('m2'));
    expect(target.result.current).toBeUndefined();

    act(() => store().setBit('m1', 'endstop', true));
    expect(target.result.current).toBe('endstop');
    expect(other.result.current).toBeUndefined();

    act(() => store().clear());
    expect(target.result.current).toBeUndefined();
  });

  it('라벨 값만 고른 모델은 none 을 받는다', () => {
    const target = renderHook(() => useOutlinePreviewState('m1'));
    act(() => store().setBit('m1', 'fault', true));
    expect(target.result.current).toBe('none');
  });
});

describe('useLabelPreviewState / useLabelPreview', () => {
  it('대상 모델만 표시 상태를 받고 나머지는 undefined', () => {
    const target = renderHook(() => useLabelPreviewState('m1'));
    const other = renderHook(() => useLabelPreviewState('m2'));
    expect(target.result.current).toBeUndefined();

    act(() => store().setBit('m1', 'fault', true));
    expect(target.result.current).toBe(getLabelState('fault'));
    expect(other.result.current).toBeUndefined();

    act(() => store().clear());
    expect(target.result.current).toBeUndefined();
  });

  it('대상이 아닌 모델은 빈 미리보기의 같은 참조를 받는다', () => {
    const other = renderHook(() => useLabelPreview('m2'));
    act(() => store().setBit('m1', 'fault', true));
    expect(other.result.current).toBe(EMPTY_LABEL_PREVIEW);
    const target = renderHook(() => useLabelPreview('m1'));
    expect(target.result.current).toEqual({ bits: { fault: true } });
  });
});
