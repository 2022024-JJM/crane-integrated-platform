import type { SavedSceneInfo } from '@crane/domain/3d';
import type { SceneCollisionRunner } from '../model/scene-collision-hold';
import { useSceneCollisionDetector } from '../model/use-scene-collision-detector';

/**
 * 씬 충돌 감지 무렌더 컴포넌트. R3F Canvas 안, **`<RigDriver />` 바로 다음**에
 * 둔다(useFrame 실행 순서 — use-scene-collision-detector 주석).
 */
export function SceneCollisionDetector({
  sceneInfo,
  enabled,
  runner,
}: {
  sceneInfo: SavedSceneInfo | null;
  enabled: boolean;
  /** 스캔 게이트가 보는 러너 — 재생 중일 때만 검사한다. */
  runner: SceneCollisionRunner;
}) {
  useSceneCollisionDetector({ sceneInfo, enabled, runner });
  return null;
}
