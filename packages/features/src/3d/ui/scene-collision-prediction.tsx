import type { SavedSceneInfo } from '@crane/domain/3d';
import { useSceneCollisionPrediction } from '../model/use-scene-collision-prediction';

/**
 * 충돌 예측 무렌더 컴포넌트. R3F Canvas 안, **`<SceneCollisionDetector />`
 * 직후**에 둔다(useFrame 실행 순서 — use-scene-collision-prediction 주석).
 *
 * 페이지 모드로 거르지 않는다 — 예측이 도는 조건은 "가상 태그 러너가 값을
 * 만드는 중" 이고 그 판정은 훅 안에 있다. 실시간 모니터링 화면도 독 ▶ 를
 * 누르면 예측이 살아난다.
 */
export function SceneCollisionPrediction({
  sceneInfo,
  enabled,
}: {
  sceneInfo: SavedSceneInfo | null;
  enabled: boolean;
}) {
  useSceneCollisionPrediction({ sceneInfo, enabled });
  return null;
}
