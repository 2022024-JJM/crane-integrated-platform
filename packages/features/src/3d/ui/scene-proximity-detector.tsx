import { useSceneProximity } from '../model/use-scene-proximity';

/** 근접 쌍 갱신 무렌더 컴포넌트 — Canvas 안, 충돌 검출기 뒤. */
export function SceneProximityDetector({
  regionId,
  enabled,
}: {
  regionId: string | undefined;
  enabled: boolean;
}) {
  useSceneProximity({ regionId, enabled });
  return null;
}
