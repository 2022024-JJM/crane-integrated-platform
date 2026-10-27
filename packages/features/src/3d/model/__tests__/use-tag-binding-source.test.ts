// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { SavedSceneInfo } from '@crane/domain/3d';
import { useTagBindingSource } from '../use-tag-binding-source';
import { rigValueStore } from '../rig-value-store';
import { hasTagIngest, publishTagValue, setTagIngest } from '../tag-value-bus';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/** 모델 하나·맵핑 하나 — 키는 `${craneId}.${code}` 로 조립된다. */
function scene(craneId: string | undefined, code: string): SavedSceneInfo {
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
        ...(craneId ? { craneId } : {}),
        tagMappings: [
          {
            id: 'map-1',
            target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
            code,
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
    renderHook(() => useTagBindingSource(scene('C_1', 'z'), true));
    expect(hasTagIngest()).toBe(true);
    publishTagValue('C_1.z', 10);
    expect(rigValueStore.getTarget('m1/map-1')).toBe(21);
  });

  it('publish 옵션 — smoothTime 0 은 즉시 대입, 양수는 그 초로 스무딩, 생략은 기본', () => {
    renderHook(() => useTagBindingSource(scene('C', 'k'), true));
    publishTagValue('C.k', 10, { smoothTime: 0 });
    expect(rigValueStore.get('m1/map-1')).toBe(21);
    expect(rigValueStore.hasPendingSmoothing()).toBe(false);
    publishTagValue('C.k', 20, { smoothTime: 0.05 });
    expect(rigValueStore.get('m1/map-1')).toBe(21);
    expect(rigValueStore.getTarget('m1/map-1')).toBe(41);
    rigValueStore.step(0.1);
    // 0.05s 스무딩은 0.1s 에 거의 도달한다(기본 0.35s 면 절반도 못 간다).
    expect(rigValueStore.get('m1/map-1')).toBeGreaterThan(35);
    publishTagValue('C.k', 0);
    rigValueStore.step(0.1);
    expect(rigValueStore.get('m1/map-1')).toBeGreaterThan(10);
  });

  it('씬이 바뀌면 재시작 없이 인덱스만 갈아 끼운다 — 코드가 바뀐 맵핑은 새 키만 받는다', () => {
    const { rerender } = renderHook(
      ({ info }) => useTagBindingSource(info, true),
      { initialProps: { info: scene('C', 'old') } },
    );
    rerender({ info: scene('C', 'new') });
    expect(hasTagIngest()).toBe(true);
    publishTagValue('C.old', 1);
    expect(rigValueStore.has('m1/map-1')).toBe(false);
    publishTagValue('C.new', 1);
    expect(rigValueStore.getTarget('m1/map-1')).toBe(3);
  });

  it('모델의 크레인이 바뀌면 새 크레인 키만 받는다 — 에디터에서 crane 을 바꿔도 리마운트 없음', () => {
    const { rerender } = renderHook(
      ({ info }) => useTagBindingSource(info, true),
      { initialProps: { info: scene('C_1', 'z') } },
    );
    publishTagValue('C_1.z', 1);
    expect(rigValueStore.getTarget('m1/map-1')).toBe(3);

    rerender({ info: scene('C_2', 'z') });
    expect(hasTagIngest()).toBe(true);
    publishTagValue('C_1.z', 10);
    expect(rigValueStore.getTarget('m1/map-1')).toBe(3);
    publishTagValue('C_2.z', 10);
    expect(rigValueStore.getTarget('m1/map-1')).toBe(21);
  });

  it('craneId 없는 모델의 맵핑은 아무 값도 받지 않는다', () => {
    renderHook(() => useTagBindingSource(scene(undefined, 'z'), true));
    publishTagValue('z', 10);
    publishTagValue('C_1.z', 10);
    expect(rigValueStore.size).toBe(0);
  });

  it('enabled=false 로 바뀌면 버스에서 떨어지고 값 저장소를 비운다', () => {
    const { rerender } = renderHook(
      ({ on }) => useTagBindingSource(scene('C', 'k'), on),
      { initialProps: { on: true } },
    );
    publishTagValue('C.k', 5);
    expect(rigValueStore.size).toBe(1);
    rerender({ on: false });
    expect(hasTagIngest()).toBe(false);
    expect(rigValueStore.size).toBe(0);
    publishTagValue('C.k', 5);
    expect(rigValueStore.size).toBe(0);
  });

  it('언마운트 시 정리한다', () => {
    const { unmount } = renderHook(() =>
      useTagBindingSource(scene('C', 'k'), true),
    );
    publishTagValue('C.k', 5);
    unmount();
    expect(hasTagIngest()).toBe(false);
    expect(rigValueStore.size).toBe(0);
  });

  it('처음부터 꺼져 있으면 아무것도 걸지 않는다', () => {
    renderHook(() => useTagBindingSource(scene('C', 'k'), false));
    expect(hasTagIngest()).toBe(false);
  });
});
