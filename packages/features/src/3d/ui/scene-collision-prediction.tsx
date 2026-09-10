import type { SavedSceneInfo } from '@crane/domain/3d';
import type { SceneCollisionRunner } from '../model/scene-collision-hold';
import { useSceneCollisionPrediction } from '../model/use-scene-collision-prediction';

/**
 * 충돌 예측 무렌더 컴포넌트. R3F Canvas 안, **`<SceneCollisionDetector />`
 * 직후**에 둔다(useFrame 실행 순서 — use-scene-collision-prediction 주석).
 */
export function SceneCollisionPrediction({
  sceneInfo,
  enabled,
  runner,
}: {
  sceneInfo: SavedSceneInfo | null;
  enabled: boolean;
  runner: SceneCollisionRunner;
}) {
  useSceneCollisionPrediction({ sceneInfo, enabled, runner });
  return null;
}
