import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import {
  invalidateShadows,
  makeMeshId,
  modelObjectRegistry,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import { cableLength } from '../lib/scene-carry';
import {
  SceneCarryRuntime,
  type CarryResolvers,
} from '../model/scene-carry-runtime';
import { readTagLiveValue } from '../model/tag-value-bus';

/**
 * 운반 레이어 — Canvas 안, **`RigDriver` 바로 다음**에 둔다(같은 priority 의
 * useFrame 은 마운트 순서라 훅 노드가 이 프레임 값으로 움직인 뒤 블록이 따라
 * 간다). 런타임(scene-carry-runtime)을 프레임마다 돌리고, 훅 노드마다 트롤리
 * 에서 훅 블록까지 케이블 한 가닥을 그린다 — GLB 의 로프 노드는 훅 블록이라
 * 권상으로 내려가면 트롤리와 사이가 빈다.
 *
 * 블록이 움직인 프레임은 `invalidateShadows()` — shadow map 이 온디맨드라
 * 빼먹으면 그림자가 안전망 주기까지 멈춘 자리에 남는다. 프레임 자체는
 * 요청하지 않는다: 블록은 훅(태그 값 → 드라이버 스무딩)이 움직이는 프레임에만
 * 움직이고 그 프레임은 드라이버·거버너가 이미 만든다.
 */

/** 케이블 반지름(씬 unit) — 멀리서도 한 가닥으로 읽히는 굵기. */
const CABLE_RADIUS = 0.12;

const resolvers: CarryResolvers = {
  root: (id) => modelObjectRegistry.get(id),
  node: (id, path) => modelObjectRegistry.get(makeMeshId(id, path)),
  value: readTagLiveValue,
};

export function SceneCarryLayer({
  sceneInfo,
}: {
  sceneInfo: SavedSceneInfo | null;
}) {
  const models = sceneInfo?.models;
  // useFrame 콜백이 읽는 값 — 렌더 중이 아니라 effect 에서 갱신(react-hooks/refs).
  const modelsRef = useRef(models);
  useEffect(() => {
    modelsRef.current = models;
  }, [models]);

  const runtimeRef = useRef<SceneCarryRuntime | null>(null);
  useEffect(() => {
    const runtime = new SceneCarryRuntime();
    runtimeRef.current = runtime;
    return () => {
      runtime.dispose();
      runtimeRef.current = null;
      invalidateShadows();
    };
  }, []);

  // 케이블 메쉬는 훅 노드 수만큼 미리 둔다 — 프레임마다 생성하지 않는다.
  const cableSlots = useMemo(() => {
    const slots: string[] = [];
    for (const model of models ?? []) {
      for (const hook of model.hooks ?? []) {
        for (const path of hook.nodes)
          slots.push(`${model.id}/${hook.id}/${path}`);
      }
    }
    return slots;
  }, [models]);
  const cableRefs = useRef<Array<Mesh | null>>([]);

  useFrame(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const { moved, cables } = runtime.step(modelsRef.current, resolvers);
    if (moved) invalidateShadows();
    const meshes = cableRefs.current;
    for (let i = 0; i < meshes.length; i += 1) {
      const mesh = meshes[i];
      if (!mesh) continue;
      const cable = cables[i];
      const length = cable ? cableLength(cable) : 0;
      if (!cable || length <= 0) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.position.set(
        cable.from.x,
        (cable.from.y + cable.to.y) / 2,
        cable.from.z,
      );
      mesh.scale.set(1, length, 1);
    }
  });

  if (cableSlots.length === 0) return null;
  return (
    <group name="scene-carry-cables">
      {cableSlots.map((key, i) => (
        <mesh
          key={key}
          ref={(mesh) => {
            cableRefs.current[i] = mesh;
          }}
          visible={false}
          frustumCulled={false}
        >
          <cylinderGeometry args={[CABLE_RADIUS, CABLE_RADIUS, 1, 6]} />
          <meshStandardMaterial color="#1f2937" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
