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
} from '../use-label-preview-store';

function store() {
  return useLabelPreviewStore.getState();
}

beforeEach(() => {
  useLabelPreviewStore.setState({
    modelId: null,
    preview: EMPTY_LABEL_PREVIEW,
    state: null,
  });
});

describe('useLabelPreviewStore', () => {
  it('처음에는 미리보기가 없다', () => {
    expect(store().modelId).toBeNull();
    expect(store().state).toBeNull();
    expect(store().preview).toBe(EMPTY_LABEL_PREVIEW);
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
    store().clear();
    expect(store().modelId).toBeNull();
    expect(store().state).toBeNull();
    expect(store().preview).toBe(EMPTY_LABEL_PREVIEW);
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
