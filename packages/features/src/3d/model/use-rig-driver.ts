import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Euler, Quaternion, Vector3, type Object3D } from 'three';
import {
  capturePose,
  degToRad,
  findMeshByPath,
  getRestPose,
  modelObjectRegistry,
  type RestPose,
  type RigAxis,
  type RigConstraint,
  type RigDefinition,
  type RigJoint,
  type SavedModelInfo,
  type TagMappingChannel,
  type TagMappingNodeTarget,
} from '@crane/domain/3d';
import { clampJointValue, jointChannel, jointDelta } from '../lib/apply-joint';
import { addChannelDelta, beginNodePose } from '../lib/apply-channel';
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
 * **현재 자세**로 다시 잡는다. 커밋된 새 배치값은 React 렌더 + passive effect
 * 를 거쳐야 `models` 로 들어오는데 그 사이 프레임에서 옛 rest 로 되돌리면
 * 모델이 이전 위치로 한 번 튀었다가 돌아온다. 현재 자세는 커밋 경로
 * (use-scene-transform commitFinal)가 방금 읽어 저장한 값과 같으므로 새
 * 배치값이 도착해 인스턴스를 다시 만들어도 화면이 바뀌지 않는다. 기즈모가
 * 건드리지 않은 루트(드라이버가 마지막으로 적용한 자세 그대로인 것)는 rest 를
 * 유지한다 — 그것까지 다시 잡으면 Δ 가 rest 에 흡수된다.
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
}

interface ChannelEntry {
  channel: TagMappingChannel;
  axis: RigAxis;
  delta: number;
}

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
    return () => {
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

      // (1) 관절 값 수집 — 한계 클램프까지 해 두어야 구속조건의 입력이
      //     화면에 실제 적용되는 값과 같다.
      const values = new Map<string, number>();
      for (const { joint } of instance.joints) {
        values.set(
          joint.id,
          clampJointValue(
            joint,
            rigValueStore.get(makeJointAddress(model.id, joint.id)),
          ),
        );
      }

      // (2) 구속조건 — 배열 순서대로. 출력도 그 관절의 한계로 자른다.
      for (const constraint of instance.constraints) {
        const output = instance.joints.find(
          (b) => b.joint.id === constraint.output,
        );
        if (!output) continue;
        const input = values.get(constraint.input) ?? 0;
        values.set(
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
      const mappingValues = new Map<string, number>();
      for (const binding of instance.mappings) {
        if (binding.isRoot && dragging) continue;
        const d = rigValueStore.get(makeJointAddress(model.id, binding.id));
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
          delta: jointDelta(joint, values.get(joint.id) ?? 0),
        });
      }

      // (4) 적용. 드래그 중인 루트는 손대지 않는다(맵핑도 위에서 걸렀다).
      for (const [node, entries] of perNode) {
        const driven = instance.drivenNodes.get(node);
        if (!driven || (driven.isRoot && dragging)) continue;
        beginNodePose(node, driven.rest);
        for (const { channel, axis, delta: d } of entries.values()) {
          addChannelDelta(node, channel, axis, d);
        }
        if (driven.isRoot) {
          if (driven.lastApplied) {
            driven.lastApplied.position.copy(node.position);
            driven.lastApplied.quaternion.copy(node.quaternion);
            driven.lastApplied.scale.copy(node.scale);
          } else {
            driven.lastApplied = capturePose(node);
          }
        }
      }

      rigLiveReadouts.set(model.id, {
        unresolvedJoints: instance.unresolvedJoints,
        jointValues: values,
        unresolvedMappings: instance.unresolvedMappings,
        mappingValues,
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
