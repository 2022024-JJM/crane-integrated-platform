import { useMemo, useSyncExternalStore } from 'react';
import { useProgress } from '@react-three/drei';
import { bvhBuildQueue } from '@crane/domain/3d';
import {
  selectSceneWarmupStep,
  type SceneWarmupStep,
} from '../lib/scene-warmup-step';
import { useSceneCollisionStore } from './use-scene-collision-store';

/**
 * 씬 후처리(워밍업) 단계 구독 — 세 신호를 모아 lib/scene-warmup-step 으로
 * 하나를 고른다. 의존값이 전부 원시값이라 단계가 같으면 같은 객체를 돌려준다.
 *
 * - BVH 큐: `bvhBuildQueue` 스냅샷(참조 안정) — ModelMesh 가 넣는다.
 * - 충돌 기준선: 검사기가 갱신하는 `baselinePending`.
 * - 에셋: drei `useProgress`(three DefaultLoadingManager).
 */
export function useSceneWarmupStep(): SceneWarmupStep {
  const bvh = useSyncExternalStore(
    bvhBuildQueue.subscribe,
    bvhBuildQueue.getSnapshot,
  );
  const collisionBaselinePending = useSceneCollisionStore(
    (s) => s.baselinePending,
  );
  const assetsActive = useProgress((s) => s.active);
  const assetsLoaded = useProgress((s) => s.loaded);
  const assetsTotal = useProgress((s) => s.total);

  return useMemo(
    () =>
      selectSceneWarmupStep({
        bvh,
        collisionBaselinePending,
        assetsActive,
        assetsLoaded,
        assetsTotal,
      }),
    [bvh, collisionBaselinePending, assetsActive, assetsLoaded, assetsTotal],
  );
}
