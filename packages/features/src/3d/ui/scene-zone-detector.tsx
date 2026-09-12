import type { SavedSceneInfo } from '@crane/domain/3d';
import { useSceneZoneDetector } from '../model/use-scene-zone-detector';

/**
 * 모델 영역 침범 검출 무렌더 컴포넌트. R3F Canvas 안, `<RigDriver />` 뒤에
 * 둔다(useFrame 실행 순서 — use-scene-zone-detector 주석). `SceneZoneRings`
 * 는 이 다음에 마운트해 같은 틱의 상태를 읽게 한다.
 */
export function SceneZoneDetector({
  sceneInfo,
  enabled,
}: {
  sceneInfo: SavedSceneInfo | null;
  enabled: boolean;
}) {
  useSceneZoneDetector({ sceneInfo, enabled });
  return null;
}
