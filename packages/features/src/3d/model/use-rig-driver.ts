import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Object3D } from 'three';
import {
  findMeshByPath,
  modelObjectRegistry,
  type RigConstraint,
  type RigDefinition,
  type RigJoint,
  type SavedModelInfo,
} from '@crane/domain/3d';
import {
  applyJoint,
  clampJointValue,
  resetJointNode,
} from '../lib/apply-joint';
import { rigLiveReadouts } from './rig-live-readouts';
import { makeJointAddress, rigValueStore } from './rig-value-store';

/**
 * 리그 드라이버 — R3F Canvas 안에서 매 프레임 관절 값을 노드에 적용한다.
 *
 * 값의 출처(수동 슬라이더/서버 태그)는 모른다. rigValueStore 만 읽는다.
 * 모델 인스턴스마다 노드 해석 결과를 캐시하고, 리그 정의 객체가 바뀌면
 * (정의 편집은 불변 업데이트라 참조가 바뀐다) 다시 만든다. 다시 만들기 전에
 * 이전 인스턴스가 만졌던 노드는 rest 로 되돌려, 관절을 지웠는데 노드가
 * 돌아간 채 남는 일이 없게 한다.
 *
 * 프레임 순서: 저장소 값 수집 → 구속조건을 배열 순서대로 계산(앞의 출력이
 * 뒤의 입력이 될 수 있다) → 전 관절 적용. driven 관절은 저장소 값이 아니라
 * 계산값을 받는다.
 *
 * 기즈모로 드래그 중인 노드는 건드리지 않는다 — TransformControls 와 같은
 * 노드를 두고 매 프레임 서로 덮어쓰면 점프한다.
 */

interface JointBinding {
  joint: RigJoint;
  node: Object3D;
}

interface RigInstance {
  rig: RigDefinition;
  root: Object3D;
  joints: JointBinding[];
  /** 입력·출력 관절이 모두 해석된 구속조건만 */
  constraints: RigConstraint[];
  unresolvedJoints: string[];
  /** 이 인스턴스가 구동하는 노드 전부 — 해체 시 rest 로 되돌린다. */
  drivenNodes: Set<Object3D>;
}

function buildInstance(root: Object3D, rig: RigDefinition): RigInstance {
  const joints: JointBinding[] = [];
  const unresolvedJoints: string[] = [];
  const drivenNodes = new Set<Object3D>();
  const resolvedIds = new Set<string>();

  for (const joint of rig.joints) {
    const node = findMeshByPath(root, joint.node);
    if (!node) {
      unresolvedJoints.push(joint.id);
      continue;
    }
    joints.push({ joint, node });
    drivenNodes.add(node);
    resolvedIds.add(joint.id);
  }

  const constraints = rig.constraints.filter(
    (c) => resolvedIds.has(c.input) && resolvedIds.has(c.output),
  );

  return { rig, root, joints, constraints, unresolvedJoints, drivenNodes };
}

function disposeInstance(instance: RigInstance): void {
  for (const node of instance.drivenNodes) {
    resetJointNode(node);
  }
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
  const instancesRef = useRef<Map<string, RigInstance>>(new Map());
  // useFrame 콜백이 렌더 사이 최신 props 를 읽기 위한 ref. 렌더 중이 아니라
  // effect 에서 갱신한다(react-hooks/refs) — 한 프레임 늦어도 무방하다.
  const paramsRef = useRef({ rigs, models, enabled });
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

    for (const model of currentModels ?? []) {
      const rig = model.rigId ? rigsById.get(model.rigId) : undefined;
      const root = modelObjectRegistry.get(model.id);
      if (!rig || !root) continue;
      liveModelIds.add(model.id);

      let instance = instances.get(model.id);
      if (instance && (instance.rig !== rig || instance.root !== root)) {
        // root 가 바뀐 경우(리마운트)는 옛 노드가 이미 사라졌으므로 reset 이
        // 무해하고, 정의가 바뀐 경우는 reset 이 꼭 필요하다.
        disposeInstance(instance);
        instance = undefined;
      }
      if (!instance) {
        instance = buildInstance(root, rig);
        instances.set(model.id, instance);
      }

      // (1) 저장소 값 수집 — 한계 클램프까지 해 두어야 구속조건의 입력이
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

      // (3) 적용. 모델 안쪽 노드 선택은 읽기 전용(기즈모 없음)이라 드래그
      // 중인 관절을 피할 필요가 없다.
      for (const { joint, node } of instance.joints) {
        applyJoint(node, joint, values.get(joint.id) ?? 0);
      }

      rigLiveReadouts.set(model.id, {
        unresolvedJoints: instance.unresolvedJoints,
        jointValues: values,
      });
    }

    // 리그가 떨어졌거나 모델이 사라진 인스턴스 정리.
    for (const [modelId, instance] of instances) {
      if (liveModelIds.has(modelId)) continue;
      disposeInstance(instance);
      instances.delete(modelId);
      rigLiveReadouts.delete(modelId);
    }
  });
}
