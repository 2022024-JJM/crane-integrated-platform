import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Euler, Quaternion, Vector3, type Object3D } from 'three';
import {
  captureGhostNodePose,
  capturePose,
  degToRad,
  findMeshByPath,
  getMeshPath,
  getRestPose,
  invalidateShadows,
  modelObjectRegistry,
  type RestPose,
  type RigConstraint,
  type RigDefinition,
  type RigJoint,
  type GhostNodePose,
  type SavedModelInfo,
  type TagMappingNodeTarget,
} from '@crane/domain/3d';
import { clampJointValue, jointChannel, jointDelta } from '../lib/apply-joint';
import {
  accumulatedParentScale,
  addChannelDelta,
  beginNodePose,
} from '../lib/apply-channel';
import {
  stripChannelDeltas,
  type ChannelDelta,
} from '../lib/strip-channel-delta';
import { rigLiveReadouts } from './rig-live-readouts';
import { makeJointAddress, rigValueStore } from './rig-value-store';
import { useActiveTransformStore } from './use-active-transform-store';

/**
 * 씬 드라이버 — R3F Canvas 안에서 매 프레임 값 저장소를 노드에 적용한다.
 * 두 종류를 한 인스턴스에서 다룬다.
 *
 * - 리그 관절: 저장소 값 수집 → 구속조건을 배열 순서대로 계산(앞의 출력이
 *   뒤의 입력이 될 수 있다) → 적용. driven 관절은 계산값을 받는다.
 * - node 태그 맵핑: 저장소 값(= offset + tag × scale, 소스가 이미 환산)을
 *   해당 노드·채널·축에 Δ 로 적용. 모델 루트(`''`)의 rest 는 씬에 저장된
 *   배치 transform 이다 — GLTF rest 캐시는 clone 직후(배치 전) 값이라 쓸 수 없다.
 *
 * 값의 출처(수동 슬라이더/태그 소스)는 모른다. rigValueStore 만 읽는다.
 *
 * 같은 노드에 여러 채널·축이 걸리므로 노드마다 rest 로 되돌린 뒤 Δ 를
 * 누적한다. 같은 노드·채널·축을 맵핑과 관절이 함께 가리키면 **관절이
 * 이긴다** — 맵핑을 먼저 넣고 관절이 같은 키를 덮는다. UI 는 이 조합을
 * 사전에 경고한다(getRigOccupiedTargetKeys).
 *
 * 모델 인스턴스마다 노드 해석 결과를 캐시하고, 모델·리그 객체가 바뀌면
 * (편집은 불변 업데이트라 참조가 바뀐다) 다시 만든다. 다시 만들기 전에
 * 이전 인스턴스가 만졌던 노드는 rest 로 되돌려, 관절을 지웠는데 노드가
 * 돌아간 채 남는 일이 없게 한다.
 *
 * 기즈모로 루트를 드래그하는 동안은 루트 맵핑을 건너뛴다 — TransformControls
 * 와 같은 노드를 두고 매 프레임 서로 덮어쓰면 점프한다.
 *
 * 드래그가 끝나는 프레임(handoff)에는 기즈모가 옮긴 루트의 rest 를 그 루트의
 * **현재 자세에서 Δ 를 벗긴 값**으로 다시 잡는다. 커밋된 새 배치값은 React
 * 렌더 + passive effect 를 거쳐야 `models` 로 들어오는데 그 사이 프레임에서
 * 옛 rest 로 되돌리면 모델이 이전 위치로 한 번 튀었다가 돌아온다. 기즈모가
 * 잡은 자세는 `rest + Δ` 이므로 Δ 를 벗겨야 한다 — 그대로 rest 로 삼으면
 * 이어서 Δ 가 한 번 더 더해져 Δ 만큼 튄다(회전·크기 커밋 뒤 잠깐 다른
 * 위치에 보였다 돌아오던 증상). 커밋 경로(use-scene-transform)도 같은 Δ
 * (readout 의 rootDeltas)를 벗겨 저장하므로, 새 배치값이 도착해 인스턴스를
 * 다시 만들어도 화면이 바뀌지 않는다. 기즈모가 건드리지 않은 루트(드라이버가
 * 마지막으로 적용한 자세 그대로인 것)는 rest 를 유지한다.
 *
 * 드래그 **도중** 태그값이 계속 바뀌면(재생 중 드래그) 손을 뗀 순간의 Δ 가
 * 드래그 시작 때와 달라 그 차이만큼 이동한다 — 정지 상태 편집이 주 경로라
 * 허용한다.
 */

interface JointBinding {
  joint: RigJoint;
  node: Object3D;
}

interface MappingBinding {
  id: string;
  target: TagMappingNodeTarget;
  node: Object3D;
  isRoot: boolean;
}

interface DrivenNode {
  node: Object3D;
  rest: RestPose;
  isRoot: boolean;
  /**
   * 루트 전용 — 드라이버가 마지막으로 적용한 자세(rest + Δ). 드래그 종료
   * 프레임에 현재 자세와 다르면 기즈모가 옮긴 것이므로 rest 를 다시 잡는다.
   */
  lastApplied?: RestPose;
  /** 루트 전용 — lastApplied 를 만들 때 더한 Δ 목록(적용 순서). handoff 가 벗긴다. */
  lastAppliedDeltas?: ChannelDelta[];
}

function isAtPose(node: Object3D, pose: RestPose): boolean {
  return (
    node.position.equals(pose.position) &&
    node.quaternion.equals(pose.quaternion) &&
    node.scale.equals(pose.scale)
  );
}

/**
 * 기즈모 handoff — 루트가 드라이버가 마지막으로 둔 자세와 다르면(기즈모가
 * 옮겼거나, 커밋된 새 배치값이 primitive prop 으로 먼저 적용됐거나) 현재
 * 자세를 새 rest 로 잡는다. 아직 한 번도 적용한 적이 없으면 루트는 배치
 * 그대로(Δ 미적용)이므로 현재 자세가 곧 배치값이다.
 */
function reanchorRootIfMoved(instance: DriverInstance): void {
  const driven = instance.drivenNodes.get(instance.root);
  if (!driven) return;
  if (driven.lastApplied && isAtPose(driven.node, driven.lastApplied)) return;
  driven.rest = capturePose(driven.node);
  // 한 번도 적용하기 전이면 자세에 Δ 가 섞여 있지 않다 — 벗길 것도 없다.
  if (driven.lastAppliedDeltas) {
    stripChannelDeltas(
      driven.rest,
      driven.lastAppliedDeltas,
      accumulatedParentScale(driven.node),
    );
  }
}

interface DriverInstance {
  model: SavedModelInfo;
  rig: RigDefinition | undefined;
  root: Object3D;
  joints: JointBinding[];
  /** 입력·출력 관절이 모두 해석된 구속조건만 */
  constraints: RigConstraint[];
  mappings: MappingBinding[];
  unresolvedJoints: string[];
  unresolvedMappings: string[];
  /** 이 인스턴스가 구동하는 노드 전부 — 해체 시 rest 로 되돌린다. */
  drivenNodes: Map<Object3D, DrivenNode>;
}

const _euler = new Euler();

/** 루트의 rest = 씬 배치 transform(model-mesh 의 primitive props 와 같은 값). */
function placementRestPose(model: SavedModelInfo): RestPose {
  const [rx, ry, rz] = model.rotation;
  return {
    position: new Vector3(...model.position),
    quaternion: new Quaternion().setFromEuler(
      _euler.set(degToRad(rx), degToRad(ry), degToRad(rz)),
    ),
    scale: new Vector3(...model.scale),
  };
}

function buildInstance(
  root: Object3D,
  model: SavedModelInfo,
  rig: RigDefinition | undefined,
): DriverInstance {
  const drivenNodes = new Map<Object3D, DrivenNode>();
  const track = (node: Object3D) => {
    if (drivenNodes.has(node)) return;
    const isRoot = node === root;
    drivenNodes.set(node, {
      node,
      rest: isRoot ? placementRestPose(model) : getRestPose(node),
      isRoot,
    });
  };

  const joints: JointBinding[] = [];
  const unresolvedJoints: string[] = [];
  const resolvedIds = new Set<string>();
  for (const joint of rig?.joints ?? []) {
    const node = findMeshByPath(root, joint.node);
    if (!node) {
      unresolvedJoints.push(joint.id);
      continue;
    }
    joints.push({ joint, node });
    track(node);
    resolvedIds.add(joint.id);
  }
  const constraints = (rig?.constraints ?? []).filter(
    (c) => resolvedIds.has(c.input) && resolvedIds.has(c.output),
  );

  const mappings: MappingBinding[] = [];
  const unresolvedMappings: string[] = [];
  for (const mapping of model.tagMappings ?? []) {
    if (mapping.target.kind !== 'node') continue;
    const node = findMeshByPath(root, mapping.target.node);
    if (!node) {
      unresolvedMappings.push(mapping.id);
      continue;
    }
    mappings.push({
      id: mapping.id,
      target: mapping.target,
      node,
      isRoot: node === root,
    });
    track(node);
  }

  return {
    model,
    rig,
    root,
    joints,
    constraints,
    mappings,
    unresolvedJoints,
    unresolvedMappings,
    drivenNodes,
  };
}

function disposeInstance(instance: DriverInstance): void {
  for (const { node, rest } of instance.drivenNodes.values()) {
    beginNodePose(node, rest);
  }
  // 노드가 rest 로 점프했다 — 값 저장소는 그대로라(set/reset 없음) 다른
  // 깔때기가 발화하지 않는 유일한 이동 경로다. 정지 상태에서 관절·맵핑
  // 정의를 지우거나 고칠 때(undo/redo 포함) 그림자가 4초 안전망까지 낡은
  // 자세로 남지 않게 여기서 직접 무효화한다. 재생성(buildInstance 뒤 첫
  // 적용)도 같은 프레임의 (4) 적용 단계가 자세를 바꾸므로 함께 커버된다.
  invalidateShadows();
}

type ChannelEntry = ChannelDelta;

const EMPTY_DELTAS: ReadonlyArray<ChannelDelta> = [];

/** 값 저장소 주소 → 값. 라이브는 rigValueStore, 예측은 미래 값 맵을 본다. */
export type RigValueResolve = (address: string) => number;

interface ApplyPoseOptions {
  /** 기즈모 드래그 중 — 루트는 적용을 건너뛴다. */
  dragging: boolean;
  /**
   * 루트 부기(`lastApplied`·`lastAppliedDeltas`)를 갱신할지. 라이브 경로만
   * true 다. 차용(예측)은 자세를 되돌리므로 부기를 건드리면 handoff 가
   * "기즈모가 옮겼다" 고 오판한다.
   */
  track: boolean;
}

interface AppliedPoseValues {
  /** 한계 클램프·구속조건 계산까지 끝난 관절 값 */
  jointValues: Map<string, number>;
  /** node 대상 맵핑에 적용된 Δ(mapping id 기준) */
  mappingValues: Map<string, number>;
}

/**
 * 인스턴스 하나의 자세를 계산해 노드에 쓴다 — (1) 관절 값 수집 →
 * (2) 구속조건 전개 → (3) 노드별 채널 Δ 누적 → (4) rest 기준 적용.
 *
 * `resolve` 로 값의 출처를 갈아 끼울 수 있게 두었다. 라이브 경로는
 * `rigValueStore`, 충돌 예측은 "N초 뒤 태그 값" 맵을 넘겨 같은 계산으로
 * 미래 자세를 만든다(rigPoseBorrow).
 */
function applyInstancePose(
  instance: DriverInstance,
  resolve: RigValueResolve,
  { dragging, track }: ApplyPoseOptions,
): AppliedPoseValues {
  const modelId = instance.model.id;

  // (1) 관절 값 수집 — 한계 클램프까지 해 두어야 구속조건의 입력이
  //     화면에 실제 적용되는 값과 같다.
  const jointValues = new Map<string, number>();
  for (const { joint } of instance.joints) {
    jointValues.set(
      joint.id,
      clampJointValue(joint, resolve(makeJointAddress(modelId, joint.id))),
    );
  }

  // (2) 구속조건 — 배열 순서대로. 출력도 그 관절의 한계로 자른다.
  for (const constraint of instance.constraints) {
    const output = instance.joints.find(
      (b) => b.joint.id === constraint.output,
    );
    if (!output) continue;
    const input = jointValues.get(constraint.input) ?? 0;
    jointValues.set(
      constraint.output,
      clampJointValue(
        output.joint,
        input * constraint.factor + (constraint.offset ?? 0),
      ),
    );
  }

  // (3) 노드별 채널 누적 — 맵핑 먼저, 관절이 같은 키를 덮는다.
  const perNode = new Map<Object3D, Map<string, ChannelEntry>>();
  const entryFor = (node: Object3D) => {
    let m = perNode.get(node);
    if (!m) {
      m = new Map();
      perNode.set(node, m);
    }
    return m;
  };
  // 드래그 중에도 루트 엔트리는 계산한다(적용만 건너뛴다) — readout 의
  // mappingValues 가 드래그 중에 비지 않게.
  const mappingValues = new Map<string, number>();
  for (const binding of instance.mappings) {
    const d = resolve(makeJointAddress(modelId, binding.id));
    mappingValues.set(binding.id, d);
    const { channel, axis } = binding.target;
    entryFor(binding.node).set(`${channel}:${axis}`, {
      channel,
      axis,
      delta: d,
    });
  }
  for (const { joint, node } of instance.joints) {
    const channel = jointChannel(joint);
    entryFor(node).set(`${channel}:${joint.axis}`, {
      channel,
      axis: joint.axis,
      delta: jointDelta(joint, jointValues.get(joint.id) ?? 0),
    });
  }

  // (4) 적용. 드래그 중인 루트는 손대지 않는다 — lastApplied·Δ 도 드래그
  //     직전 값으로 남아 handoff·커밋이 그것을 벗긴다.
  for (const [node, entries] of perNode) {
    const driven = instance.drivenNodes.get(node);
    if (!driven || (driven.isRoot && dragging)) continue;
    beginNodePose(node, driven.rest);
    for (const { channel, axis, delta: d } of entries.values()) {
      addChannelDelta(node, channel, axis, d);
    }
    if (driven.isRoot && track) {
      if (driven.lastApplied) {
        driven.lastApplied.position.copy(node.position);
        driven.lastApplied.quaternion.copy(node.quaternion);
        driven.lastApplied.scale.copy(node.scale);
      } else {
        driven.lastApplied = capturePose(node);
      }
      // 엔트리 객체는 이 프레임에 새로 만든 것이라 그대로 보관해도 된다.
      const list = (driven.lastAppliedDeltas ??= []);
      list.length = 0;
      for (const entry of entries.values()) list.push(entry);
    }
  }

  return { jointValues, mappingValues };
}

/** 라이브 경로의 값 출처. 모듈 레벨에 한 번 만들어 프레임당 할당을 없앤다. */
const liveResolve: RigValueResolve = (address) => rigValueStore.get(address);

// ---- 자세 차용(rigPoseBorrow) ----

/** 차용 중 되돌릴 로컬 transform 스냅샷. 배열을 재사용해 할당을 없앤다. */
interface BorrowedPose {
  node: Object3D;
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}

const borrowedPoses: BorrowedPose[] = [];
let borrowedCount = 0;
let borrowedRoots: Object3D[] = [];
/** 살아 있는 드라이버들의 인스턴스 맵. 훅이 마운트·언마운트에서 등록·해제한다. */
const driverInstanceMaps = new Set<Map<string, DriverInstance>>();

function savePose(node: Object3D): void {
  let slot = borrowedPoses[borrowedCount];
  if (!slot) {
    slot = {
      node,
      position: new Vector3(),
      quaternion: new Quaternion(),
      scale: new Vector3(),
    };
    borrowedPoses[borrowedCount] = slot;
  }
  slot.node = node;
  slot.position.copy(node.position);
  slot.quaternion.copy(node.quaternion);
  slot.scale.copy(node.scale);
  borrowedCount += 1;
}

/**
 * 자세 차용 — 같은 프레임 안에서 실제 노드 트리에 다른 값(미래 태그 값)을
 * 적용해 무언가를 측정하고 즉시 되돌리는 통로. 충돌 예측이 쓴다.
 *
 * 사본(clone) 대신 실제 트리를 빌리는 이유: `getRestPose` 는
 * `WeakMap<Object3D, RestPose>` 이고 clone 직후에 seed 되므로 이미 구동된
 * 트리를 다시 clone 하면 "구동된 자세" 가 rest 로 굳는다. `accumulatedParentScale`
 * 도 라이브 부모 체인을 걷고, `modelObjectRegistry` 는 같은 id 재등록을
 * 덮어쓴다. 무엇보다 **루트 rest 는 기즈모 종료 프레임에 다시 잡히므로**
 * (reanchorRootIfMoved) 인스턴스를 따로 만들면 rest 가 갈라진다.
 *
 * **`borrow`/`release` 는 같은 콜백 안에서 반드시 짝을 이뤄야 한다**
 * (호출자가 try/finally 로 감싼다). R3F 는 모든 useFrame 뒤에 렌더하고 렌더가
 * `scene.updateMatrixWorld()` 를 다시 도므로 화면에는 새어 나가지 않지만,
 * 프레임 안의 다른 소비자를 막으려면 `release` 가 행렬까지 되돌려야 한다.
 *
 * `release` 의 `updateMatrixWorld(true)` 는 선택이 아니다. three 의
 * `updateMatrixWorld(force)` 는 force 경로를 지나며 `matrixWorldNeedsUpdate`
 * 를 내리고, `matrixAutoUpdate` 가 false 인 노드는 `matrix` 재합성을
 * 건너뛴다 — 로컬만 되돌리면 그런 노드는 미래 자세로 굳는다.
 *
 * **`invalidateShadows()` 를 부르지 않는다.** 같은 프레임에 되돌리므로 화면이
 * 바뀌지 않는, "노드를 움직이면 그림자를 무효화한다" 규칙의 유일한 예외다.
 * 부르면 예측 주기마다 shadow pass 가 강제되어 온디맨드 최적화가 무력해진다.
 */
export const rigPoseBorrow = {
  /** 드라이버가 실제로 구동하는(리그 또는 node 맵핑이 있는) 모델 id. */
  drivenModelIds(): string[] {
    const ids = new Set<string>();
    for (const map of driverInstanceMaps) {
      for (const id of map.keys()) ids.add(id);
    }
    return [...ids];
  },

  /** 차용 중인지 — 중첩 차용을 막는다. */
  get active(): boolean {
    return borrowedCount > 0;
  },

  /**
   * `resolve` 가 주는 값으로 모든 구동 모델의 자세를 다시 쓰고 월드 행렬을
   * 갱신한다. 이미 차용 중이면 아무것도 하지 않고 false 를 돌려준다.
   */
  borrow(resolve: RigValueResolve): boolean {
    if (borrowedCount > 0) return false;
    borrowedRoots.length = 0;
    for (const map of driverInstanceMaps) {
      for (const instance of map.values()) {
        for (const driven of instance.drivenNodes.values()) {
          savePose(driven.node);
        }
        applyInstancePose(instance, resolve, { dragging: false, track: false });
        borrowedRoots.push(instance.root);
      }
    }
    if (borrowedCount === 0) return false;
    for (const root of borrowedRoots) root.updateMatrixWorld(true);
    return true;
  },

  /** 저장한 로컬 transform 과 월드 행렬을 되돌린다. */
  release(): void {
    if (borrowedCount === 0) return;
    for (let i = 0; i < borrowedCount; i += 1) {
      const slot = borrowedPoses[i];
      slot.node.position.copy(slot.position);
      slot.node.quaternion.copy(slot.quaternion);
      slot.node.scale.copy(slot.scale);
    }
    borrowedCount = 0;
    for (const root of borrowedRoots) root.updateMatrixWorld(true);
    borrowedRoots.length = 0;
  },

  /**
   * 차용 중인 자세를 스냅샷으로 뜬다 — 충돌 예측의 고스트가 이 값으로
   * 별도 clone 을 세운다. **`borrow` 와 `release` 사이에서만** 의미가 있다.
   *
   * 구동 노드만 담는다. 나머지 노드는 GLTF rest 그대로이고 고스트 clone 도
   * 같은 rest 에서 시작하므로 덮어쓸 필요가 없다. 노드 경로는 여기서
   * 계산한다 — 예측 쌍이 바뀔 때만 부르는 경로라 매 프레임 비용이 아니다.
   *
   * 구동 모델이 아니면(리그도 node 맵핑도 없는 정적 장비) null 이다. 그런
   * 장비는 미래 자세가 현재와 같아 고스트를 그리면 실물과 겹친 이중상만 된다.
   */
  captureModelPose(modelId: string): {
    path: string;
    nodes: GhostNodePose[];
  } | null {
    for (const map of driverInstanceMaps) {
      const instance = map.get(modelId);
      if (!instance) continue;
      const nodes: GhostNodePose[] = [];
      for (const driven of instance.drivenNodes.values()) {
        const path = driven.isRoot
          ? ''
          : getMeshPath(instance.root, driven.node);
        if (path === null) continue;
        nodes.push(captureGhostNodePose(path, driven.node));
      }
      return { path: instance.model.path, nodes };
    }
    return null;
  },

  /** 테스트 전용 — 전역 상태를 비운다. */
  resetForTest(): void {
    borrowedCount = 0;
    borrowedRoots = [];
    driverInstanceMaps.clear();
  },
};

interface UseRigDriverParams {
  rigs: RigDefinition[] | undefined;
  models: SavedModelInfo[] | undefined;
  /** false 면 모든 노드를 rest 로 되돌리고 멈춘다. */
  enabled?: boolean;
}

export function useRigDriver({
  rigs,
  models,
  enabled = true,
}: UseRigDriverParams): void {
  const instancesRef = useRef<Map<string, DriverInstance>>(new Map());
  // useFrame 콜백이 렌더 사이 최신 props 를 읽기 위한 ref. 렌더 중이 아니라
  // effect 에서 갱신한다(react-hooks/refs). 한 프레임 늦게 도착하는데, 기즈모
  // 커밋 직후의 루트 rest 는 이 지연에 기대지 않고 handoff 프레임에 따로
  // 다시 잡는다(reanchorRootIfMoved) — 그 외에는 한 프레임 지연이 무방하다.
  const paramsRef = useRef({ rigs, models, enabled });
  // 기즈모 드래그 종료(true→false) 감지용. useFrame 콜백 안에서만 읽고 쓴다.
  const prevDraggingRef = useRef(false);
  useEffect(() => {
    paramsRef.current = { rigs, models, enabled };
  }, [rigs, models, enabled]);

  // 언마운트 시 구동 흔적을 지운다 — 같은 GLB clone 이 다른 화면에서 rest 가
  // 아닌 자세로 보이면 안 된다.
  useEffect(() => {
    const instances = instancesRef.current;
    // 자세 차용(충돌 예측)이 이 맵을 읽는다 — 인스턴스를 따로 만들지 않는
    // 이유는 rigPoseBorrow 주석에 있다.
    driverInstanceMaps.add(instances);
    return () => {
      driverInstanceMaps.delete(instances);
      for (const instance of instances.values()) disposeInstance(instance);
      instances.clear();
      rigLiveReadouts.clear();
    };
  }, []);

  useFrame((_state, delta) => {
    const {
      rigs: currentRigs,
      models: currentModels,
      enabled: on,
    } = paramsRef.current;
    const instances = instancesRef.current;

    if (!on) {
      if (instances.size > 0) {
        for (const instance of instances.values()) disposeInstance(instance);
        instances.clear();
        rigLiveReadouts.clear();
      }
      return;
    }

    // 탭 전환 등으로 delta 가 튀면 스무딩이 한 번에 목표로 점프한다 — 상한.
    rigValueStore.step(Math.min(delta, 0.1));

    const rigsById = new Map((currentRigs ?? []).map((r) => [r.id, r]));
    const liveModelIds = new Set<string>();
    const dragging = useActiveTransformStore.getState().active;
    const dragEnded = prevDraggingRef.current && !dragging;
    prevDraggingRef.current = dragging;

    for (const model of currentModels ?? []) {
      const rig = model.rigId ? rigsById.get(model.rigId) : undefined;
      const hasNodeMappings =
        model.tagMappings?.some((m) => m.target.kind === 'node') ?? false;
      if (!rig && !hasNodeMappings) continue;
      const root = modelObjectRegistry.get(model.id);
      if (!root) continue;
      liveModelIds.add(model.id);

      let instance = instances.get(model.id);
      if (
        instance &&
        (instance.model !== model ||
          instance.rig !== rig ||
          instance.root !== root)
      ) {
        // root 가 바뀐 경우(리마운트)는 옛 노드가 이미 사라졌으므로 reset 이
        // 무해하고, 정의가 바뀐 경우는 reset 이 꼭 필요하다.
        disposeInstance(instance);
        instance = undefined;
      }
      if (!instance) {
        instance = buildInstance(root, model, rig);
        instances.set(model.id, instance);
      } else if (dragEnded) {
        // 새 배치값이 이미 도착해 위에서 다시 만든 인스턴스는 rest 가 최신이다.
        reanchorRootIfMoved(instance);
      }

      const { jointValues, mappingValues } = applyInstancePose(
        instance,
        liveResolve,
        { dragging, track: true },
      );

      rigLiveReadouts.set(model.id, {
        unresolvedJoints: instance.unresolvedJoints,
        jointValues,
        unresolvedMappings: instance.unresolvedMappings,
        mappingValues,
        rootDeltas:
          instance.drivenNodes.get(instance.root)?.lastAppliedDeltas ??
          EMPTY_DELTAS,
      });
    }

    // 리그·맵핑이 떨어졌거나 모델이 사라진 인스턴스 정리.
    for (const [modelId, instance] of instances) {
      if (liveModelIds.has(modelId)) continue;
      disposeInstance(instance);
      instances.delete(modelId);
      rigLiveReadouts.delete(modelId);
    }
  });
}
