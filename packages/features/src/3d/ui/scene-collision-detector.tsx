import type { SavedSceneInfo } from '@crane/domain/3d';
import { useSceneCollisionDetector } from '../model/use-scene-collision-detector';

/**
 * 씬 충돌 감지 무렌더 컴포넌트. R3F Canvas 안, **`<RigDriver />` 바로 다음**에
 * 둔다(useFrame 실행 순서 — use-scene-collision-detector 주석).
 */
export function SceneCollisionDetector({
  sceneInfo,
  enabled,
}: {
  sceneInfo: SavedSceneInfo | null;
  enabled: boolean;
}) {
  useSceneCollisionDetector({ sceneInfo, enabled });
  return null;
}
