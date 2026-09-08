// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { SavedSceneInfo } from '@crane/domain/3d';
import { useTagBindingSource } from '../use-tag-binding-source';
import { rigValueStore } from '../rig-value-store';
import { hasTagIngest, publishTagValue, setTagIngest } from '../tag-value-bus';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function scene(tagKey: string): SavedSceneInfo {
  return {
    maps: [],
    models: [
      {
        id: 'm1',
        equipName: 'A',
        path: '/models/a.glb',
        opacity: 1,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        tagMappings: [
          {
            id: 'map-1',
            target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
            tagKey,
            scale: 2,
            offset: 1,
          },
        ],
      },
    ],
  };
}

afterEach(() => {
  cleanup();
  setTagIngest(null);
  rigValueStore.reset();
});

describe('useTagBindingSource', () => {
  it('enabled 면 버스 값이 맵핑 주소에 offset + v·scale 로 실린다', () => {
    renderHook(() => useTagBindingSource(scene('C_1:z'), true));
    expect(hasTagIngest()).toBe(true);
    publishTagValue('C_1:z', 10);
    expect(rigValueStore.getTarget('m1/map-1')).toBe(21);
  });

  it('씬이 바뀌면 재시작 없이 인덱스만 갈아 끼운다', () => {
    const { rerender } = renderHook(
      ({ info }) => useTagBindingSource(info, true),
      { initialProps: { info: scene('old') } },
    );
    rerender({ info: scene('new') });
    publishTagValue('old', 1);
    expect(rigValueStore.has('m1/map-1')).toBe(false);
    publishTagValue('new', 1);
    expect(rigValueStore.getTarget('m1/map-1')).toBe(3);
  });

  it('enabled=false 로 바뀌면 버스에서 떨어지고 값 저장소를 비운다', () => {
    const { rerender } = renderHook(
      ({ on }) => useTagBindingSource(scene('k'), on),
      { initialProps: { on: true } },
    );
    publishTagValue('k', 5);
    expect(rigValueStore.size).toBe(1);
    rerender({ on: false });
    expect(hasTagIngest()).toBe(false);
    expect(rigValueStore.size).toBe(0);
    publishTagValue('k', 5);
    expect(rigValueStore.size).toBe(0);
  });

  it('언마운트 시 정리한다', () => {
    const { unmount } = renderHook(() => useTagBindingSource(scene('k'), true));
    publishTagValue('k', 5);
    unmount();
    expect(hasTagIngest()).toBe(false);
    expect(rigValueStore.size).toBe(0);
  });

  it('처음부터 꺼져 있으면 아무것도 걸지 않는다', () => {
    renderHook(() => useTagBindingSource(scene('k'), false));
    expect(hasTagIngest()).toBe(false);
  });
});
