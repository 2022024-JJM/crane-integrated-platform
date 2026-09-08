import type { SavedSceneInfo } from '@crane/domain/3d';
import { useRigDriver } from '../model/use-rig-driver';

/**
 * 씬의 리그를 구동하는 무렌더 컴포넌트. R3F Canvas 안에 한 번 두면 된다.
 * 에디터 캔버스가 쓰고, 서버 연동 단계에서 모니터링 뷰에도 같은 것을 둔다.
 */
export function RigDriver({
  sceneInfo,
  enabled = true,
}: {
  sceneInfo: SavedSceneInfo | null;
  enabled?: boolean;
}) {
  useRigDriver({
    rigs: sceneInfo?.rigs,
    models: sceneInfo?.models,
    enabled,
  });
  return null;
}
