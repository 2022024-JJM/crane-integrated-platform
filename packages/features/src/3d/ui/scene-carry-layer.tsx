import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import {
  invalidateShadows,
  makeMeshId,
  modelObjectRegistry,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import {
  SceneCarryRuntime,
  type CarryResolvers,
} from '../model/scene-carry-runtime';
import { SceneRopeExtensions } from '../model/scene-rope-extensions';
import { subscribeSceneSeek } from '../model/scene-seek-signal';
import { readTagLiveNumber } from '../model/tag-value-bus';

/**
 * 운반 레이어 — Canvas 안, **`RigDriver` 바로 다음**에 둔다(같은 priority 의
 * useFrame 은 마운트 순서라 훅 노드가 이 프레임 값으로 움직인 뒤 블록이 따라
 * 간다). 런타임(scene-carry-runtime)을 프레임마다 돌리고, 훅 노드마다 로프를
 * 트롤리까지 잇는다(scene-rope-extensions) — 권상이 훅 노드(로프 가닥 + 훅
 * 블록)를 통째로 내리므로 GLB 로프가 트롤리와 떨어진다.
 *
 * 블록이 움직인 프레임은 `invalidateShadows()` — shadow map 이 온디맨드라
 * 빼먹으면 그림자가 안전망 주기까지 멈춘 자리에 남는다. 프레임 자체는
 * 요청하지 않는다: 블록·로프 연장은 훅(태그 값 → 드라이버 스무딩)이 움직이는
 * 프레임에만 바뀌고 그 프레임은 드라이버·거버너가 이미 만든다(그림자 무효화도
 * 드라이버가 한다).
 *
 * seek·리셋(`subscribeSceneSeek`)은 다음 프레임에 런타임 `reset()` 으로 옮긴
 * 블록을 배치 위치로 되돌린다 — 이것만은 훅이 안 움직여도 보여야 해서 프레임을
 * 요청한다. 신호는 프레임 밖(러너 seek)에서 오므로 Object3D 는 useFrame 에서만
 * 만진다.
 */

const resolvers: CarryResolvers = {
  root: (id) => modelObjectRegistry.get(id),
  node: (id, path) => modelObjectRegistry.get(makeMeshId(id, path)),
  value: readTagLiveNumber,
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

  const invalidate = useThree((s) => s.invalidate);
  const resetPendingRef = useRef(false);
  useEffect(
    () =>
      subscribeSceneSeek(() => {
        resetPendingRef.current = true;
        invalidate();
      }),
    [invalidate],
  );

  const groupRef = useRef<Group>(null);
  const runtimeRef = useRef<SceneCarryRuntime | null>(null);
  const ropesRef = useRef<SceneRopeExtensions | null>(null);
  useEffect(() => {
    const runtime = new SceneCarryRuntime();
    runtimeRef.current = runtime;
    const ropes = groupRef.current
      ? new SceneRopeExtensions(groupRef.current)
      : null;
    ropesRef.current = ropes;
    return () => {
      runtime.dispose();
      runtimeRef.current = null;
      ropes?.dispose();
      ropesRef.current = null;
      invalidateShadows();
    };
  }, []);

  useFrame(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    let restored = false;
    if (resetPendingRef.current) {
      resetPendingRef.current = false;
      restored = runtime.reset();
    }
    const { moved, cables } = runtime.step(modelsRef.current, resolvers);
    const built = ropesRef.current?.update(cables) ?? false;
    if (moved || restored || built) invalidateShadows();
  });

  return <group ref={groupRef} name="scene-carry-ropes" />;
}
