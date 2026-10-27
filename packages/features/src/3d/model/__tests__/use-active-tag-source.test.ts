// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActiveTagSource } from '../use-active-tag-source';
import { rigValueStore } from '../rig-value-store';
import {
  getActiveTagSource,
  publishTagValue,
  setActiveTagSource,
  tagLiveValues,
  type TagSourceId,
} from '../tag-value-bus';

afterEach(() => {
  setActiveTagSource(null);
  rigValueStore.reset();
  tagLiveValues.clear();
});

describe('useActiveTagSource', () => {
  it('마운트에 게이트를 걸고 언마운트에 푼다', () => {
    const { unmount } = renderHook(() => useActiveTagSource('replay'));
    expect(getActiveTagSource()).toBe('replay');
    unmount();
    expect(getActiveTagSource()).toBeNull();
  });

  it('소스가 바뀌면 값 저장소·live 캐시를 비우고 새 소스만 통과시킨다', () => {
    const { rerender } = renderHook(
      ({ source }) => useActiveTagSource(source),
      { initialProps: { source: 'replay' as TagSourceId } },
    );
    publishTagValue('C_1.z', 5, { source: 'replay' });
    rigValueStore.set('m/j', 1, { smooth: false });
    expect(tagLiveValues.get('C_1.z')?.value).toBe(5);

    rerender({ source: 'simulation' });
    expect(getActiveTagSource()).toBe('simulation');
    expect(tagLiveValues.size).toBe(0);
    expect(rigValueStore.get('m/j')).toBe(0);

    // 리플레이 이탈 정리가 뒤늦게 publish 해도(effect 순서 무관) 게이트가 버린다.
    publishTagValue('C_1.z', 7, { source: 'replay' });
    expect(tagLiveValues.has('C_1.z')).toBe(false);
    publishTagValue('C_1.z', 9, { source: 'simulation' });
    expect(tagLiveValues.get('C_1.z')?.value).toBe(9);
  });
});
