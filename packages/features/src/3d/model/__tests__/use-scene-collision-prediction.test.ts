// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import {
  modelObjectRegistry,
  seedRestPose,
  type SavedModelInfo,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import type { VirtualTagDefinition } from '@crane/domain/virtual-tag';
import {
  PREDICTION_INTERVAL_MS,
  PREDICTION_STEP_MS,
  quantizeLeadTimeSec,
} from '../../lib/scene-collision-pairs';
import { rigValueStore } from '../rig-value-store';
import { sceneCollisionRuntime } from '../scene-collision-runtime';
import { useSceneCollisionStore } from '../use-scene-collision-store';
import { useVirtualTagStore } from '../use-virtual-tag-store';
import { virtualTagRuntime } from '../virtual-tag-runner';
import { rigPoseBorrow, useRigDriver } from '../use-rig-driver';
import { useSceneCollisionPrediction } from '../use-scene-collision-prediction';
import { useActiveTransformStore } from '../use-active-transform-store';

// use-rig-driver.test 와 같은 방식 — useFrame 콜백을 잡아 수동으로 돌린다.
// 드라이버와 예측기 두 훅이 각각 구독하므로 **배열**로 받는다.
const captured = vi.hoisted(() => ({
  frameCallbacks: [] as Array<(state: unknown, delta: number) => void>,
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    captured.frameCallbacks.push(callback);
  },
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

type BvhGeometry = BufferGeometry & { boundsTree?: MeshBVH };

let nowMs = 0;

function frame(delta = 1 / 60) {
  act(() => {
    for (const cb of captured.frameCallbacks) cb(undefined, delta);
  });
}

/** 스로틀을 넘겨 스윕이 한 번 돌게 한다. */
function sweep() {
  nowMs += PREDICTION_INTERVAL_MS;
  frame();
}

/**
 * 모델 = root Group > [0]Body(1×1×1 Mesh, BVH). 루트 position.z 에 태그를
 * 걸어 시뮬레이션이 z 축으로 미끄러지게 만든다.
 */
function mountModel(id: string, z: number, { bvh = true } = {}) {
  const root = new Group();
  root.name = id;
  const body = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  body.name = 'Body';
  root.add(body);
  root.position.set(0, 0, z);
  root.updateMatrixWorld(true);
  seedRestPose(root);
  seedRestPose(body);
  if (bvh) {
    (body.geometry as BvhGeometry).boundsTree = new MeshBVH(body.geometry);
  }
  modelObjectRegistry.register(id, root);
  return { root, body };
}

function model(id: string, z: number, tagKey?: string): SavedModelInfo {
  return {
    id,
    equipName: id.toUpperCase(),
    path: `/models/${id}.glb`,
    opacity: 1,
    position: [0, 0, z],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    ...(tagKey
      ? {
          tagMappings: [
            {
              id: `map-${id}`,
              tagKey,
              target: {
                kind: 'node' as const,
                node: '',
                channel: 'position' as const,
                axis: 'z' as const,
              },
            },
          ],
        }
      : {}),
  };
}

function tag(patch: Partial<VirtualTagDefinition> = {}): VirtualTagDefinition {
  return {
    id: patch.id ?? 'tag-1',
    key: patch.key ?? 'A:pos',
    name: '',
    min: patch.min ?? 0,
    max: patch.max ?? 10,
    initial: patch.initial ?? 0,
    // sawtooth 는 0 → max 로 단조 증가라 "몇 초 뒤에 닿는가" 를 계산하기 쉽다.
    pattern: patch.pattern ?? { kind: 'sawtooth', periodMs: 10_000 },
    enabled: patch.enabled ?? true,
  };
}

function scene(models: SavedModelInfo[]): SavedSceneInfo {
  return { models, maps: [], texts: [] } as unknown as SavedSceneInfo;
}

/** 드라이버와 예측기를 함께 마운트한다 — 예측은 드라이버 인스턴스를 빌린다. */
function mountBoth(sceneInfo: SavedSceneInfo, enabled = true) {
  return renderHook(() => {
    useRigDriver({
      rigs: sceneInfo.rigs,
      models: sceneInfo.models,
      enabled: true,
    });
    useSceneCollisionPrediction({
      sceneInfo,
      enabled,
      runner: 'simulation',
    });
  });
}

beforeEach(() => {
  nowMs = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  captured.frameCallbacks = [];
  modelObjectRegistry.clear();
  rigPoseBorrow.resetForTest();
  rigValueStore.reset();
  virtualTagRuntime.syncDefinitions([]);
  virtualTagRuntime.resetValues();
  useVirtualTagStore.setState({ tags: [], isRunning: true });
  useActiveTransformStore.setState({ active: false });
  useSceneCollisionStore.setState({
    enabled: true,
    predictionEnabled: true,
    predictionHorizonSec: 10,
    predicted: null,
    history: [],
    activeRecordId: null,
    activeMode: null,
  });
  sceneCollisionRuntime.disarm();
});

afterEach(() => {
  cleanup();
  modelObjectRegistry.clear();
  rigPoseBorrow.resetForTest();
  rigValueStore.reset();
  virtualTagRuntime.syncDefinitions([]);
  virtualTagRuntime.resetValues();
  vi.restoreAllMocks();
});

/** 태그 하나로 z 축을 미는 모델 a + 정적 모델 b. */
function setupApproach({ tagPatch = {}, bBvh = true } = {}) {
  const def = tag(tagPatch);
  useVirtualTagStore.setState({ tags: [def], isRunning: true });
  virtualTagRuntime.syncDefinitions([def]);
  mountModel('a', 0);
  mountModel('b', 5, { bvh: bBvh });
  return scene([model('a', 0, def.key), model('b', 5)]);
}

/** manual 태그로 구동되지만 이미 겹쳐 있는 두 모델 — 매 스윕 같은 예측. */
function setupOverlapping() {
  const def = tag({ pattern: { kind: 'manual' } });
  useVirtualTagStore.setState({ tags: [def], isRunning: true });
  virtualTagRuntime.syncDefinitions([def]);
  mountModel('a', 0);
  mountModel('b', 0.5);
  return scene([model('a', 0, def.key), model('b', 0.5)]);
}

describe('게이트', () => {
  it('전부 열려 있으면 예측이 나온다', () => {
    const info = setupApproach();
    mountBoth(info);
    frame();
    sweep();
    const predicted = useSceneCollisionStore.getState().predicted;
    expect(predicted).not.toBeNull();
    expect([predicted?.a.modelId, predicted?.b.modelId].sort()).toEqual([
      'a',
      'b',
    ]);
  });

  it('감지(enabled)가 꺼지면 예측하지 않고 기존 예측을 내린다', () => {
    const info = setupApproach();
    mountBoth(info);
    frame();
    sweep();
    expect(useSceneCollisionStore.getState().predicted).not.toBeNull();

    act(() => useSceneCollisionStore.setState({ enabled: false }));
    sweep();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('predictionEnabled 가 꺼지면 예측하지 않는다', () => {
    const info = setupApproach();
    useSceneCollisionStore.setState({ predictionEnabled: false });
    mountBoth(info);
    frame();
    sweep();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('호출부 게이트(enabled prop)가 false 면 예측하지 않는다', () => {
    const info = setupApproach();
    mountBoth(info, false);
    frame();
    sweep();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('러너가 정지 중이면 예측하지 않는다', () => {
    const info = setupApproach();
    useVirtualTagStore.setState({ isRunning: false });
    mountBoth(info);
    frame();
    sweep();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('기즈모 드래그 중이면 예측하지 않는다', () => {
    const info = setupApproach();
    useActiveTransformStore.setState({ active: true });
    mountBoth(info);
    frame();
    sweep();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('실시간 러너는 예측 대상이 아니다', () => {
    const info = setupApproach();
    mountModel('a', 0);
    renderHook(() => {
      useRigDriver({ rigs: undefined, models: info.models, enabled: true });
      useSceneCollisionPrediction({
        sceneInfo: info,
        enabled: true,
        runner: 'realtime',
      });
    });
    frame();
    sweep();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });
});

describe('자세 복원', () => {
  it('검사 뒤 로컬 transform 과 matrixWorld 가 정확히 원복된다', () => {
    const info = setupApproach();
    const a = modelObjectRegistry.get('a') as Group;
    mountBoth(info);
    frame();

    const beforeZ = a.position.z;
    const beforeMatrix = a.matrixWorld.elements.slice();
    sweep();

    expect(a.position.z).toBe(beforeZ);
    expect([...a.matrixWorld.elements]).toEqual([...beforeMatrix]);
  });

  it('예측이 나온 스윕에서도 자세가 남지 않는다', () => {
    const info = setupApproach();
    const a = modelObjectRegistry.get('a') as Group;
    mountBoth(info);
    frame();
    const beforeZ = a.position.z;
    sweep();
    expect(useSceneCollisionStore.getState().predicted).not.toBeNull();
    expect(a.position.z).toBe(beforeZ);
  });

  it('차용은 스윕이 끝나면 반드시 풀린다', () => {
    const info = setupApproach();
    mountBoth(info);
    frame();
    sweep();
    expect(rigPoseBorrow.active).toBe(false);
  });
});

describe('리드타임', () => {
  it('단조 증가 파형에서 접근이 이를수록 리드타임이 짧다', () => {
    // sawtooth 0→10 / 10초. b 는 z=5 이고 두 큐브가 1 unit 폭이라
    // z 이동이 4 를 넘으면 닿는다 → 약 4초.
    const info = setupApproach();
    mountBoth(info);
    frame();
    sweep();
    const first = useSceneCollisionStore.getState().predicted?.leadTimeSec ?? 0;
    expect(first).toBeGreaterThan(3);
    expect(first).toBeLessThan(5);
  });

  it('리드타임은 원점 기준 칸 시각 − 현재 경과 시간이다', () => {
    const info = setupApproach();
    mountBoth(info);
    frame();
    expect(virtualTagRuntime.elapsed).toBe(0);
    sweep();
    const lead = useSceneCollisionStore.getState().predicted?.leadTimeSec ?? -1;
    expect(lead).toBeGreaterThan(0);
    // 표시 단위로 양자화돼 부동소수 잡음이 새지 않는다(% 비교는 0.1 배수에서
    // 0.0999... 를 만들어 그 자체가 잡음이다).
    expect(lead).toBe(quantizeLeadTimeSec(lead));
    // 물리적으로도 맞는 값인지 — z 이동이 4 를 넘어야 닿으므로 4초 근방.
    expect(lead).toBeCloseTo(4, 0);
  });

  it('지평선이 짧으면 먼 충돌은 보이지 않는다', () => {
    const info = setupApproach();
    // 약 4초 뒤 충돌인데 2초까지만 본다.
    useSceneCollisionStore.setState({ predictionHorizonSec: 2 });
    mountBoth(info);
    frame();
    sweep();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });
});

describe('발행 정책', () => {
  it('같은 쌍·같은 리드타임이면 상태 참조가 유지된다', () => {
    // manual 패턴이라 미래값 = 현재값 — 겹쳐 둔 두 모델은 매 스윕 같은
    // 결과를 낸다. 참조가 바뀌면 패널·독·오버레이가 헛되이 리렌더된다.
    const info = setupOverlapping();
    mountBoth(info);
    frame();
    sweep();
    const first = useSceneCollisionStore.getState().predicted;
    expect(first).not.toBeNull();
    sweep();
    expect(useSceneCollisionStore.getState().predicted).toBe(first);
  });

  it('구동 모델이 없으면 예측하지 않는다', () => {
    mountModel('a', 0);
    mountModel('b', 0.5);
    const info = scene([model('a', 0), model('b', 0.5)]);
    mountBoth(info);
    frame();
    sweep();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('감지가 억제한 쌍은 예측하지 않는다', () => {
    // 기준선이 일부러 억제한 겹침(에디터에서 겹쳐 놓은 모델·로딩 배치)이
    // 예측으로 새면 영구 경보가 된다.
    const info = setupOverlapping();
    sceneCollisionRuntime.suppress('a|b');
    mountBoth(info);
    frame();
    sweep();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('활성 충돌 기록의 쌍은 예측하지 않는다', () => {
    // 충돌 시 정지를 끈 모드에서는 러너가 계속 돌아 같은 쌍에 빨강·주황이
    // 함께 뜬다.
    const info = setupOverlapping();
    useSceneCollisionStore.setState({
      history: [
        {
          id: 1,
          pairKey: 'a|b',
          at: 0,
          a: { modelId: 'a', equipName: 'A', nodePath: '' },
          b: { modelId: 'b', equipName: 'B', nodePath: '' },
          contactPoint: [0, 0, 0],
          values: [],
        },
      ],
      activeRecordId: 1,
      activeMode: 'flash',
    });
    mountBoth(info);
    frame();
    sweep();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('BVH 가 없으면 예측하지 않는다', () => {
    const info = setupApproach({ bBvh: false });
    mountBoth(info);
    frame();
    sweep();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });
});

describe('스로틀·수명', () => {
  it('PREDICTION_INTERVAL_MS 안에는 스윕하지 않는다', () => {
    const info = setupApproach();
    mountBoth(info);
    frame();
    // 간격 미달 — 프레임만 돌아도 예측이 생기지 않는다.
    nowMs += PREDICTION_INTERVAL_MS - 1;
    frame();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
    nowMs += 1;
    frame();
    expect(useSceneCollisionStore.getState().predicted).not.toBeNull();
  });

  it('언마운트하면 예측을 비운다', () => {
    const info = setupApproach();
    const { unmount } = mountBoth(info);
    frame();
    sweep();
    expect(useSceneCollisionStore.getState().predicted).not.toBeNull();
    act(() => unmount());
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('칸 간격 상수가 지평선보다 크면 최소 한 칸은 본다', () => {
    const info = setupApproach();
    // 지평선을 클램프 최소로 낮춰도 칸 수가 0 이 되지 않는다.
    useSceneCollisionStore.setState({
      predictionHorizonSec: PREDICTION_STEP_MS / 1000 / 2,
    });
    mountBoth(info);
    frame();
    // 예외 없이 돌기만 하면 된다(칸 0 이면 while 이 무한이거나 throw).
    expect(() => sweep()).not.toThrow();
  });
});

describe('표시 캡처', () => {
  it('구동 모델의 미래 자세를 고스트로 잡고, 정적 모델은 잡지 않는다', () => {
    const info = setupApproach();
    mountBoth(info);
    frame();
    sweep();
    const predicted = useSceneCollisionStore.getState().predicted;
    // a 만 태그로 구동된다 — b 는 미래가 현재와 같아 이중상만 된다.
    expect(predicted?.ghosts.map((g) => g.modelId)).toEqual(['a']);
    expect(predicted?.ghosts[0].path).toBe('/models/a.glb');
  });

  it('고스트 자세는 현재 자세가 아니라 미래 자세다', () => {
    const info = setupApproach();
    const a = modelObjectRegistry.get('a') as Group;
    mountBoth(info);
    frame();
    sweep();
    const root = useSceneCollisionStore
      .getState()
      .predicted?.ghosts[0].nodes.find((n) => n.nodePath === '');
    expect(root).toBeDefined();
    // sawtooth 가 z 를 밀어 충돌 시점에는 현재보다 훨씬 앞이다.
    expect(root?.position[2]).toBeGreaterThan(a.position.z + 1);
  });

  it('같은 쌍이 이어지는 동안은 다시 캡처하지 않는다', () => {
    // 캡처는 자세 차용을 십수 번 더 하는 비싼 경로다 — 리드타임만 갱신되는
    // 스윕에서 다시 돌면 매 100ms 마다 그 비용이 든다.
    const info = setupOverlapping();
    mountBoth(info);
    frame();
    sweep();
    expect(useSceneCollisionStore.getState().predicted).not.toBeNull();

    const spy = vi.spyOn(rigPoseBorrow, 'captureModelPose');
    sweep();
    sweep();
    expect(spy).not.toHaveBeenCalled();
  });

  it('쌍이 바뀌면 다시 캡처한다', () => {
    const info = setupOverlapping();
    mountBoth(info);
    frame();
    sweep();
    const spy = vi.spyOn(rigPoseBorrow, 'captureModelPose');
    // 다른 쌍이 잡히도록 현재 예측을 지운다 — 다음 스윕이 새 쌍으로 본다.
    act(() => useSceneCollisionStore.getState().setPredicted(null));
    sweep();
    expect(spy).toHaveBeenCalled();
  });

  it('처음 리드타임을 카운트다운 분모로 보관한다', () => {
    const info = setupApproach();
    mountBoth(info);
    frame();
    sweep();
    const predicted = useSceneCollisionStore.getState().predicted;
    expect(predicted?.initialLeadTimeSec).toBe(predicted?.leadTimeSec);
  });
});
