// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Object3D } from 'three';
import { sceneCollisionRuntime } from '../scene-collision-runtime';
import {
  useSceneCollisionStore,
  type SceneCollisionReport,
} from '../use-scene-collision-store';
import { virtualTagRuntime } from '../virtual-tag-runner';

function report(id = 1): SceneCollisionReport {
  const node = new Object3D();
  const party = (modelId: string) => ({
    modelId,
    equipName: modelId.toUpperCase(),
    nodePath: '[0]Body',
    node,
    tags: [],
    jointValues: [],
  });
  return {
    id,
    pairKey: 'a|b',
    a: party('a'),
    b: party('b'),
    contactPoint: [0, 0, 0],
    detectedAt: 0,
  };
}

beforeEach(() => {
  useSceneCollisionStore.setState({
    enabled: false,
    phase: 'off',
    report: null,
  });
  vi.spyOn(sceneCollisionRuntime, 'suppress').mockImplementation(() => {});
  vi.spyOn(sceneCollisionRuntime, 'arm').mockImplementation(() => {});
  vi.spyOn(virtualTagRuntime, 'resetValues').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSceneCollisionStore — 토글', () => {
  it('toggle 은 enabled 와 phase 를 함께 바꾸고, 끄면 report 도 비운다', () => {
    const s = useSceneCollisionStore.getState();
    s.toggle();
    expect(useSceneCollisionStore.getState()).toMatchObject({
      enabled: true,
      phase: 'scanning',
    });
    useSceneCollisionStore.getState().reportCollision(report());
    expect(useSceneCollisionStore.getState().phase).toBe('collided');
    useSceneCollisionStore.getState().toggle();
    expect(useSceneCollisionStore.getState()).toMatchObject({
      enabled: false,
      phase: 'off',
      report: null,
    });
  });

  it('같은 값으로 setEnabled 하면 상태 참조가 유지된다', () => {
    const before = useSceneCollisionStore.getState();
    before.setEnabled(false);
    expect(useSceneCollisionStore.getState()).toBe(before);
  });
});

describe('useSceneCollisionStore — 충돌 보고', () => {
  it('꺼져 있으면 보고를 무시한다(참조 유지)', () => {
    const before = useSceneCollisionStore.getState();
    before.reportCollision(report());
    expect(useSceneCollisionStore.getState()).toBe(before);
  });

  it('collided 중 두 번째 보고는 no-op — 첫 report 가 남는다', () => {
    useSceneCollisionStore.getState().setEnabled(true);
    useSceneCollisionStore.getState().reportCollision(report(1));
    const after = useSceneCollisionStore.getState();
    after.reportCollision(report(2));
    expect(useSceneCollisionStore.getState()).toBe(after);
    expect(useSceneCollisionStore.getState().report?.id).toBe(1);
  });
});

describe('useSceneCollisionStore — 닫기·초기화·정리', () => {
  it('dismiss 는 쌍을 억제하고 재무장한 뒤 scanning 으로 돌아간다', () => {
    useSceneCollisionStore.getState().setEnabled(true);
    useSceneCollisionStore.getState().reportCollision(report());
    useSceneCollisionStore.getState().dismiss();
    expect(sceneCollisionRuntime.suppress).toHaveBeenCalledWith('a|b');
    expect(sceneCollisionRuntime.arm).toHaveBeenCalledTimes(1);
    expect(useSceneCollisionStore.getState()).toMatchObject({
      enabled: true,
      phase: 'scanning',
      report: null,
    });
  });

  it('collided 가 아닐 때 dismiss/resetAndRearm 은 no-op(참조 유지, 런타임 호출 없음)', () => {
    useSceneCollisionStore.getState().setEnabled(true);
    const before = useSceneCollisionStore.getState();
    before.dismiss();
    before.resetAndRearm();
    expect(useSceneCollisionStore.getState()).toBe(before);
    expect(sceneCollisionRuntime.arm).not.toHaveBeenCalled();
    expect(virtualTagRuntime.resetValues).not.toHaveBeenCalled();
  });

  it('resetAndRearm 은 가상 태그를 초기값으로 되돌린 뒤 dismiss 와 같다', () => {
    useSceneCollisionStore.getState().setEnabled(true);
    useSceneCollisionStore.getState().reportCollision(report());
    useSceneCollisionStore.getState().resetAndRearm();
    expect(virtualTagRuntime.resetValues).toHaveBeenCalledTimes(1);
    expect(sceneCollisionRuntime.suppress).toHaveBeenCalledWith('a|b');
    expect(useSceneCollisionStore.getState().phase).toBe('scanning');
  });

  it('clear 는 enabled 를 유지한 채 report 만 비우고, 비울 게 없으면 참조 유지', () => {
    useSceneCollisionStore.getState().setEnabled(true);
    const idle = useSceneCollisionStore.getState();
    idle.clear();
    expect(useSceneCollisionStore.getState()).toBe(idle);

    useSceneCollisionStore.getState().reportCollision(report());
    useSceneCollisionStore.getState().clear();
    expect(useSceneCollisionStore.getState()).toMatchObject({
      enabled: true,
      phase: 'scanning',
      report: null,
    });
    expect(sceneCollisionRuntime.arm).not.toHaveBeenCalled();
  });
});
