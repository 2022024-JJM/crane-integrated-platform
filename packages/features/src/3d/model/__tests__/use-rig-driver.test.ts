// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { Object3D, Quaternion, Vector3 } from 'three';
import {
  modelObjectRegistry,
  seedRestPose,
  type RigDefinition,
  type SavedModelInfo,
} from '@crane/domain/3d';
import { useRigDriver } from '../use-rig-driver';
import { rigLiveReadouts } from '../rig-live-readouts';
import { rigValueStore } from '../rig-value-store';
import { useActiveTransformStore } from '../use-active-transform-store';
import { useSceneObjectSelectionStore } from '../use-scene-object-selection-store';

/** R3F 프레임 루프를 가로채 delta 를 수동 주입한다(use-replay-player-runner.test 와 같은 방식). */
const captured = vi.hoisted(() => ({
  frameCallback: null as null | ((state: unknown, delta: number) => void),
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    captured.frameCallback = callback;
  },
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function frame(delta = 1 / 60) {
  act(() => {
    captured.frameCallback?.(undefined, delta);
  });
}

/** root > [0]Arm(empty) > [0]Hand(empty) > [0]Tip(empty) */
function mountModel(id: string) {
  const root = new Object3D();
  root.name = 'root';
  const arm = new Object3D();
  arm.name = 'Arm';
  arm.position.set(0, 1, 0);
  const hand = new Object3D();
  hand.name = 'Hand';
  hand.position.set(0, 2, 0);
  const tip = new Object3D();
  tip.name = 'Tip';
  root.add(arm);
  arm.add(hand);
  hand.add(tip);
  for (const o of [root, arm, hand, tip]) seedRestPose(o);
  modelObjectRegistry.register(id, root);
  return { root, arm, hand, tip };
}

function rig(overrides: Partial<RigDefinition> = {}): RigDefinition {
  return {
    id: 'rig-a',
    name: 'A',
    modelPath: '/models/a.glb',
    joints: [
      { id: 'arm', node: '[0]Arm', type: 'hinge', axis: 'z', max: 90 },
      { id: 'hand', node: '[0]Arm/[0]Hand', type: 'slide', axis: 'y' },
      { id: 'tip', node: '[0]Arm/[0]Hand/[0]Tip', type: 'hinge', axis: 'z' },
    ],
    constraints: [],
    ...overrides,
  };
}

function model(overrides: Partial<SavedModelInfo> = {}): SavedModelInfo {
  return {
    id: 'm1',
    equipName: 'A',
    path: '/models/a.glb',
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    valueMapList: [],
    rigId: 'rig-a',
    ...overrides,
  };
}

const zDeg = (o: Object3D) =>
  (2 * Math.atan2(o.quaternion.z, o.quaternion.w) * 180) / Math.PI;

beforeEach(() => {
  captured.frameCallback = null;
  rigValueStore.reset();
  rigLiveReadouts.clear();
  modelObjectRegistry.clear();
  useActiveTransformStore.getState().end();
  useSceneObjectSelectionStore.getState().clearSelectedModel();
});

afterEach(() => {
  cleanup();
});

describe('useRigDriver — 관절', () => {
  it('관절 값이 없으면 rest, 값을 넣으면 rest 기준으로 노드가 움직인다', () => {
    const { arm, hand } = mountModel('m1');
    renderHook(() => useRigDriver({ rigs: [rig()], models: [model()] }));
    frame();
    expect(zDeg(arm)).toBeCloseTo(0, 6);
    expect(hand.position.y).toBe(2);

    rigValueStore.set('m1/arm', 30);
    rigValueStore.set('m1/hand', 0.5);
    frame();
    expect(zDeg(arm)).toBeCloseTo(30, 6);
    expect(hand.position.y).toBeCloseTo(2.5, 9);
  });

  it('한계를 넘는 값은 클램프된다(경계 정확값 통과, +1 거부)', () => {
    const { arm } = mountModel('m1');
    renderHook(() => useRigDriver({ rigs: [rig()], models: [model()] }));
    rigValueStore.set('m1/arm', 90);
    frame();
    expect(zDeg(arm)).toBeCloseTo(90, 6);
    rigValueStore.set('m1/arm', 91);
    frame();
    expect(zDeg(arm)).toBeCloseTo(90, 6);
  });

  it('리그 정의가 바뀌면(관절 제거) 이전에 구동하던 노드를 rest 로 되돌린다', () => {
    const { arm, hand } = mountModel('m1');
    const { rerender } = renderHook(
      ({ rigs }) => useRigDriver({ rigs, models: [model()] }),
      { initialProps: { rigs: [rig()] } },
    );
    rigValueStore.set('m1/arm', 45);
    rigValueStore.set('m1/hand', 1);
    frame();
    expect(zDeg(arm)).toBeCloseTo(45, 6);

    const armOnly = rig({ joints: [rig().joints[0]] });
    rerender({ rigs: [armOnly] });
    frame();
    expect(zDeg(arm)).toBeCloseTo(45, 6);
    expect(hand.position.y).toBe(2);
  });

  it('모델에서 rigId 가 빠지면 구동 노드를 전부 rest 로 되돌리고 readout 을 지운다', () => {
    const { arm } = mountModel('m1');
    const { rerender } = renderHook(
      ({ models }) => useRigDriver({ rigs: [rig()], models }),
      { initialProps: { models: [model()] } },
    );
    rigValueStore.set('m1/arm', 45);
    frame();
    expect(rigLiveReadouts.get('m1')).toBeDefined();
    rerender({ models: [model({ rigId: undefined })] });
    frame();
    expect(zDeg(arm)).toBeCloseTo(0, 6);
    expect(rigLiveReadouts.get('m1')).toBeUndefined();
  });

  it('enabled=false 면 rest 로 되돌리고 값을 무시한다', () => {
    const { arm } = mountModel('m1');
    const { rerender } = renderHook(
      ({ enabled }) =>
        useRigDriver({ rigs: [rig()], models: [model()], enabled }),
      { initialProps: { enabled: true } },
    );
    rigValueStore.set('m1/arm', 45);
    frame();
    rerender({ enabled: false });
    frame();
    expect(zDeg(arm)).toBeCloseTo(0, 6);
  });

  it('경로를 못 찾는 관절은 unresolvedJoints 에 보고하고 나머지는 구동한다', () => {
    const { arm } = mountModel('m1');
    const broken = rig({
      joints: [
        rig().joints[0],
        { id: 'ghost', node: '[3]Nope', type: 'hinge', axis: 'x' },
      ],
    });
    renderHook(() => useRigDriver({ rigs: [broken], models: [model()] }));
    rigValueStore.set('m1/arm', 10);
    frame();
    expect(zDeg(arm)).toBeCloseTo(10, 6);
    expect(rigLiveReadouts.get('m1')?.unresolvedJoints).toEqual(['ghost']);
  });

  it('registry 에 없는 모델(아직 마운트 전)은 건너뛰고 오류 없이 지나간다', () => {
    renderHook(() => useRigDriver({ rigs: [rig()], models: [model()] }));
    rigValueStore.set('m1/arm', 10);
    expect(() => frame()).not.toThrow();
    expect(rigLiveReadouts.get('m1')).toBeUndefined();
  });

  it('기즈모로 드래그 중인 노드는 건드리지 않는다', () => {
    const { arm, hand } = mountModel('m1');
    renderHook(() => useRigDriver({ rigs: [rig()], models: [model()] }));
    rigValueStore.set('m1/arm', 20);
    rigValueStore.set('m1/hand', 1);
    frame();

    // 사용자가 Arm 을 기즈모로 잡고 돌리는 중
    useSceneObjectSelectionStore.getState().selectMesh('m1::[0]Arm');
    useActiveTransformStore.getState().begin();
    arm.quaternion.setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
    frame();
    expect(zDeg(arm)).toBeCloseTo(90, 6);
    // 다른 관절은 계속 구동
    expect(hand.position.y).toBeCloseTo(3, 9);

    useActiveTransformStore.getState().end();
    frame();
    expect(zDeg(arm)).toBeCloseTo(20, 6);
  });

  it('스무딩 채널은 프레임이 지나며 목표로 수렴한다', () => {
    const { arm } = mountModel('m1');
    renderHook(() => useRigDriver({ rigs: [rig()], models: [model()] }));
    rigValueStore.set('m1/arm', 60, { smooth: true, smoothTime: 0.1 });
    frame();
    const first = zDeg(arm);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(60);
    for (let i = 0; i < 60; i++) frame();
    expect(zDeg(arm)).toBeCloseTo(60, 1);
  });

  it('언마운트하면 구동 흔적을 지운다', () => {
    const { arm } = mountModel('m1');
    const { unmount } = renderHook(() =>
      useRigDriver({ rigs: [rig()], models: [model()] }),
    );
    rigValueStore.set('m1/arm', 40);
    frame();
    unmount();
    expect(arm.quaternion.angleTo(new Quaternion())).toBeLessThan(1e-9);
    expect(rigLiveReadouts.get('m1')).toBeUndefined();
  });

  it('readout.jointValues 에 적용된(클램프 후) 값을 기록한다', () => {
    mountModel('m1');
    renderHook(() => useRigDriver({ rigs: [rig()], models: [model()] }));
    rigValueStore.set('m1/arm', 120);
    frame();
    expect(rigLiveReadouts.get('m1')?.jointValues.get('arm')).toBe(90);
    expect(rigLiveReadouts.get('m1')?.jointValues.get('hand')).toBe(0);
  });
});

describe('useRigDriver — 선형 연동', () => {
  const linked = () =>
    rig({
      constraints: [
        { type: 'linear', id: 'l1', input: 'arm', output: 'tip', factor: -1.5 },
      ],
    });

  it('출력 관절이 입력 × factor + offset 으로 따라온다', () => {
    const { arm, tip } = mountModel('m1');
    renderHook(() => useRigDriver({ rigs: [linked()], models: [model()] }));
    rigValueStore.set('m1/arm', 20);
    frame();
    expect(zDeg(arm)).toBeCloseTo(20, 6);
    expect(zDeg(tip)).toBeCloseTo(-30, 6);

    const withOffset = rig({
      constraints: [
        {
          type: 'linear',
          id: 'l1',
          input: 'arm',
          output: 'tip',
          factor: 2,
          offset: 5,
        },
      ],
    });
    const { tip: tip2 } = mountModel('m2');
    renderHook(() =>
      useRigDriver({
        rigs: [withOffset],
        models: [model({ id: 'm2' })],
      }),
    );
    rigValueStore.set('m2/arm', 10);
    frame();
    expect(zDeg(tip2)).toBeCloseTo(25, 6);
  });

  it('driven 관절에 저장소 값이 있어도 무시하고 계산값을 쓴다', () => {
    const { tip } = mountModel('m1');
    renderHook(() => useRigDriver({ rigs: [linked()], models: [model()] }));
    rigValueStore.set('m1/arm', 10);
    rigValueStore.set('m1/tip', 77);
    frame();
    expect(zDeg(tip)).toBeCloseTo(-15, 6);
    expect(rigLiveReadouts.get('m1')?.jointValues.get('tip')).toBeCloseTo(
      -15,
      9,
    );
  });

  it('입력은 자기 한계로 잘린 값이고, 출력도 자기 한계로 잘린다', () => {
    const { tip } = mountModel('m1');
    const clamped = rig({
      joints: [
        rig().joints[0],
        rig().joints[1],
        {
          id: 'tip',
          node: '[0]Arm/[0]Hand/[0]Tip',
          type: 'hinge',
          axis: 'z',
          min: -100,
        },
      ],
      constraints: [
        { type: 'linear', id: 'l1', input: 'arm', output: 'tip', factor: -1.5 },
      ],
    });
    renderHook(() => useRigDriver({ rigs: [clamped], models: [model()] }));
    // arm max 90 → 입력 90 → 출력 -135 → tip min -100
    rigValueStore.set('m1/arm', 500);
    frame();
    expect(zDeg(tip)).toBeCloseTo(-100, 6);
    expect(rigLiveReadouts.get('m1')?.jointValues.get('tip')).toBe(-100);
  });

  it('체인: 앞 연동의 출력이 뒤 연동의 입력이 된다(배열 순서)', () => {
    const { hand, tip } = mountModel('m1');
    const chain = rig({
      constraints: [
        { type: 'linear', id: 'a', input: 'arm', output: 'hand', factor: 0.1 },
        { type: 'linear', id: 'b', input: 'hand', output: 'tip', factor: 10 },
      ],
    });
    renderHook(() => useRigDriver({ rigs: [chain], models: [model()] }));
    rigValueStore.set('m1/arm', 30);
    frame();
    expect(hand.position.y).toBeCloseTo(2 + 3, 9);
    expect(zDeg(tip)).toBeCloseTo(30, 6);
  });

  it('출력 관절의 sign 은 계산값에 적용된다', () => {
    const { tip } = mountModel('m1');
    const inverted = rig({
      joints: [
        rig().joints[0],
        rig().joints[1],
        { ...rig().joints[2], sign: -1 },
      ],
      constraints: [
        { type: 'linear', id: 'l1', input: 'arm', output: 'tip', factor: 2 },
      ],
    });
    renderHook(() => useRigDriver({ rigs: [inverted], models: [model()] }));
    rigValueStore.set('m1/arm', 10);
    frame();
    expect(zDeg(tip)).toBeCloseTo(-20, 6);
  });

  it('입력·출력 관절 중 하나라도 노드 해석에 실패하면 그 연동은 건너뛴다', () => {
    const { tip } = mountModel('m1');
    const broken = rig({
      joints: [
        { id: 'arm', node: '[9]Nope', type: 'hinge', axis: 'z' },
        rig().joints[2],
      ],
      constraints: [
        { type: 'linear', id: 'l1', input: 'arm', output: 'tip', factor: 2 },
      ],
    });
    renderHook(() => useRigDriver({ rigs: [broken], models: [model()] }));
    rigValueStore.set('m1/arm', 10);
    frame();
    expect(zDeg(tip)).toBeCloseTo(0, 6);
    expect(rigLiveReadouts.get('m1')?.unresolvedJoints).toEqual(['arm']);
  });

  it('연동을 지우면 출력 노드가 rest 로 돌아가고 다시 저장소 값을 받는다', () => {
    const { tip } = mountModel('m1');
    const { rerender } = renderHook(
      ({ rigs }) => useRigDriver({ rigs, models: [model()] }),
      { initialProps: { rigs: [linked()] } },
    );
    rigValueStore.set('m1/arm', 20);
    frame();
    expect(zDeg(tip)).toBeCloseTo(-30, 6);

    rerender({ rigs: [rig()] });
    frame();
    expect(zDeg(tip)).toBeCloseTo(0, 6);
    rigValueStore.set('m1/tip', 12);
    frame();
    expect(zDeg(tip)).toBeCloseTo(12, 6);
  });
});
