// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { Object3D, Quaternion } from 'three';
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
  // 드래그 플래그는 모듈 전역 스토어라 테스트 사이에 남는다.
  useActiveTransformStore.getState().end();
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

describe('useRigDriver — node 태그 맵핑', () => {
  const mapped = (overrides: Partial<SavedModelInfo> = {}): SavedModelInfo =>
    model({
      rigId: undefined,
      position: [10, 0, -5],
      rotation: [0, 90, 0],
      scale: [2, 2, 2],
      tagMappings: [
        {
          id: 'root-z',
          target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
          tagKey: 'C_1:z',
        },
        {
          id: 'arm-rot',
          target: {
            kind: 'node',
            node: '[0]Arm',
            channel: 'rotation',
            axis: 'z',
          },
          tagKey: 'C_1:arm',
        },
        {
          id: 'hand-scale',
          target: {
            kind: 'node',
            node: '[0]Arm/[0]Hand',
            channel: 'scale',
            axis: 'y',
          },
          tagKey: 'C_1:hand',
        },
      ],
      ...overrides,
    });

  it('루트 맵핑은 씬 배치 transform 을 rest 로 삼아 Δ 를 더한다', () => {
    const { root } = mountModel('m1');
    renderHook(() => useRigDriver({ rigs: undefined, models: [mapped()] }));
    frame();
    // 값이 없으면 배치 그대로.
    expect(root.position.toArray()).toEqual([10, 0, -5]);
    expect(root.scale.toArray()).toEqual([2, 2, 2]);
    expect(root.rotation.y).toBeCloseTo(Math.PI / 2, 9);

    rigValueStore.set('m1/root-z', 3);
    frame();
    expect(root.position.z).toBeCloseTo(-2, 9);
  });

  it('내부 노드의 rotation·scale 채널이 rest 기준으로 적용된다', () => {
    const { arm, hand } = mountModel('m1');
    renderHook(() => useRigDriver({ rigs: undefined, models: [mapped()] }));
    rigValueStore.set('m1/arm-rot', 30);
    rigValueStore.set('m1/hand-scale', 0.5);
    frame();
    expect(zDeg(arm)).toBeCloseTo(30, 6);
    expect(hand.scale.toArray()).toEqual([1, 1.5, 1]);
    expect(rigLiveReadouts.get('m1')?.mappingValues.get('arm-rot')).toBe(30);
  });

  it('노드를 못 찾는 맵핑은 unresolvedMappings 에 보고한다', () => {
    mountModel('m1');
    renderHook(() =>
      useRigDriver({
        rigs: undefined,
        models: [
          mapped({
            tagMappings: [
              {
                id: 'ghost',
                target: {
                  kind: 'node',
                  node: '[9]Nope',
                  channel: 'position',
                  axis: 'x',
                },
                tagKey: 'k',
              },
            ],
          }),
        ],
      }),
    );
    frame();
    expect(rigLiveReadouts.get('m1')?.unresolvedMappings).toEqual(['ghost']);
  });

  it('같은 노드·채널·축을 리그 관절이 함께 가리키면 관절이 이긴다', () => {
    const { arm } = mountModel('m1');
    const both = mapped({ rigId: 'rig-a' });
    renderHook(() => useRigDriver({ rigs: [rig()], models: [both] }));
    rigValueStore.set('m1/arm-rot', 30);
    rigValueStore.set('m1/arm', 60);
    frame();
    expect(zDeg(arm)).toBeCloseTo(60, 6);
  });

  it('같은 노드의 다른 축 Δ 는 서로 지우지 않는다 (맵핑 + 관절 slide)', () => {
    const { hand } = mountModel('m1');
    const both = mapped({
      rigId: 'rig-a',
      tagMappings: [
        {
          id: 'hand-x',
          target: {
            kind: 'node',
            node: '[0]Arm/[0]Hand',
            channel: 'position',
            axis: 'x',
          },
          tagKey: 'k',
        },
      ],
    });
    renderHook(() => useRigDriver({ rigs: [rig()], models: [both] }));
    rigValueStore.set('m1/hand-x', 1);
    rigValueStore.set('m1/hand', 0.5);
    frame();
    expect(hand.position.x).toBeCloseTo(1, 9);
    expect(hand.position.y).toBeCloseTo(2.5, 9);
  });

  it('맵핑을 지우면(모델 참조 변경) 노드가 rest(배치)로 돌아간다', () => {
    const { root, arm } = mountModel('m1');
    const { rerender } = renderHook(
      ({ models }) => useRigDriver({ rigs: undefined, models }),
      { initialProps: { models: [mapped()] } },
    );
    rigValueStore.set('m1/root-z', 3);
    rigValueStore.set('m1/arm-rot', 30);
    frame();
    rerender({ models: [mapped({ tagMappings: undefined })] });
    frame();
    expect(root.position.z).toBeCloseTo(-5, 9);
    expect(zDeg(arm)).toBeCloseTo(0, 6);
    expect(rigLiveReadouts.get('m1')).toBeUndefined();
  });

  it('기즈모 드래그 중에는 루트를 건드리지 않고 내부 노드만 구동한다', () => {
    const { root, arm } = mountModel('m1');
    renderHook(() => useRigDriver({ rigs: undefined, models: [mapped()] }));
    rigValueStore.set('m1/root-z', 3);
    rigValueStore.set('m1/arm-rot', 30);
    frame();
    expect(root.position.z).toBeCloseTo(-2, 9);
    useActiveTransformStore.getState().begin();
    root.position.z = 100; // 기즈모가 옮긴 값
    frame();
    expect(root.position.z).toBe(100);
    expect(zDeg(arm)).toBeCloseTo(30, 6);
  });

  describe('기즈모 handoff — 드래그 종료 프레임의 루트 rest', () => {
    it('기즈모가 옮긴 루트는 종료 직후 프레임부터 새 자세를 rest 로 쓴다 (옛 배치로 튀는 프레임 없음)', () => {
      const { root } = mountModel('m1');
      const { rerender } = renderHook(
        ({ models }) => useRigDriver({ rigs: undefined, models }),
        { initialProps: { models: [mapped()] } },
      );
      rigValueStore.set('m1/root-z', 3);
      frame();
      expect(root.position.z).toBeCloseTo(-2, 9);

      useActiveTransformStore.getState().begin();
      // 기즈모는 현재 자세(rest -5 + Δ 3 = -2)에서 출발해 100 까지 끌었다.
      root.position.z = 100;
      frame();
      // 커밋(React setState)은 아직 models 에 도착하지 않은 채 end() 만 먼저 온다.
      useActiveTransformStore.getState().end();
      frame();
      // 옛 rest(-5)+Δ = -2 로 되돌리는 프레임이 없어야 한다.
      expect(root.position.z).toBeCloseTo(103, 9);

      // 커밋된 새 배치값이 한 프레임 뒤에 도착해도 화면이 바뀌지 않는다.
      rerender({ models: [mapped({ position: [10, 0, 100] })] });
      frame();
      expect(root.position.z).toBeCloseTo(103, 9);
    });

    it('기즈모가 건드리지 않은 루트 맵핑 모델은 rest 를 유지한다 (Δ 가 rest 에 흡수되지 않음)', () => {
      const { root: r1 } = mountModel('m1');
      const { root: r2 } = mountModel('m2');
      renderHook(() =>
        useRigDriver({
          rigs: undefined,
          models: [mapped(), mapped({ id: 'm2' })],
        }),
      );
      rigValueStore.set('m1/root-z', 3);
      rigValueStore.set('m2/root-z', 3);
      frame();
      expect(r2.position.z).toBeCloseTo(-2, 9);

      useActiveTransformStore.getState().begin();
      r1.position.z = 100; // m1 만 드래그
      frame();
      useActiveTransformStore.getState().end();
      frame();
      frame();
      expect(r1.position.z).toBeCloseTo(103, 9);
      // m2 의 rest 가 -2 로 다시 잡혔다면 -2+3 = 1 이 됐을 것이다.
      expect(r2.position.z).toBeCloseTo(-2, 9);
    });

    it('움직이지 않고 놓아도(클릭) rest 와 자세가 그대로다', () => {
      const { root } = mountModel('m1');
      renderHook(() => useRigDriver({ rigs: undefined, models: [mapped()] }));
      rigValueStore.set('m1/root-z', 3);
      frame();
      useActiveTransformStore.getState().begin();
      frame();
      useActiveTransformStore.getState().end();
      frame();
      frame();
      expect(root.position.z).toBeCloseTo(-2, 9);
    });

    it('한 번도 적용하기 전(첫 프레임이 드래그)에는 현재 자세를 배치값으로 본다', () => {
      const { root } = mountModel('m1');
      renderHook(() => useRigDriver({ rigs: undefined, models: [mapped()] }));
      rigValueStore.set('m1/root-z', 3);
      useActiveTransformStore.getState().begin();
      root.position.z = 100;
      frame();
      useActiveTransformStore.getState().end();
      frame();
      expect(root.position.z).toBeCloseTo(103, 9);
    });

    it('루트 맵핑이 없는 모델은 handoff 에서 아무 것도 하지 않는다', () => {
      const { root, arm } = mountModel('m1');
      renderHook(() =>
        useRigDriver({
          rigs: undefined,
          models: [
            mapped({
              tagMappings: [
                {
                  id: 'arm-rot',
                  target: {
                    kind: 'node',
                    node: '[0]Arm',
                    channel: 'rotation',
                    axis: 'z',
                  },
                  tagKey: 'C_1:arm',
                },
              ],
            }),
          ],
        }),
      );
      rigValueStore.set('m1/arm-rot', 30);
      frame();
      useActiveTransformStore.getState().begin();
      root.position.z = 100;
      frame();
      useActiveTransformStore.getState().end();
      frame();
      expect(root.position.z).toBe(100);
      expect(zDeg(arm)).toBeCloseTo(30, 6);
    });

    // 드래그 시작 자세가 rest+Δ 라서 기즈모가 읽는 절대값에 Δ 가 섞인다.
    // 커밋 경로(use-scene-transform commitFinal)가 그 절대값을 배치값으로
    // 저장하므로 드래그마다 Δ 만큼 저장값이 밀리고, 다음 프레임에 Δ 가 한 번
    // 더 더해져 모델이 Δ 만큼 더 가 있다(위 테스트의 103 = 100 + 3). 별건.
    it.todo(
      'Δ≠0 상태에서 드래그하면 커밋된 배치값에 Δ 가 흡수된다 (handoff 에서 Δ 를 벗겨야 함)',
    );
  });
});
