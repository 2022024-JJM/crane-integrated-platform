import { getAssetContentHash, withBaseUrl } from '@crane/core/lib/asset-url';
import {
  SCENE_DIR,
  getKnownRegionIds,
  getSceneFileNameByRegionId,
  isKnownRegionId,
} from './scene-file-map';

/**
 * region → 씬 파일 URL. 표 자체는 scene-file-map(의존성 0)에 있고, 여기서는
 * BASE_URL(sub-path 배포 `/crane_rnd/`)만 씌운다.
 *
 * 미등록 region은 null을 반환한다 — 예전에는 기본 파일(`1dock.json`)로
 * 떨어졌는데, 그 fallback 탓에 "다른 지역을 편집했는데 1dock이 로드되고,
 * 저장하니 1dock이 덮어써지는" 사고가 났다. 모르는 region은 모른다고 답한다.
 */

/**
 * 미등록 region은 null. 호출부가 명시적으로 처리해야 한다.
 *
 * withBaseUrl을 거치므로 BASE_URL과 함께 콘텐츠 해시(`?v=`)도 붙는다. 씬
 * JSON은 GLB보다 캐시 사고가 더 나쁘다 — 모델 파일이 최신이어도 배치가
 * 옛것이면 씬이 조용히 어긋난다.
 */
export function getSceneFileUrlByRegionId(regionId: string): string | null {
  const fileName = getSceneFileNameByRegionId(regionId);
  return fileName ? withBaseUrl(`/${SCENE_DIR}/${fileName}`) : null;
}

/**
 * 이 region의 **배포된** 씬 JSON 콘텐츠 해시. 씬을 재배포하면 값이 바뀐다.
 *
 * scene-dev-storage 가 localStorage 저장본에 "어느 배포 기준으로 편집했는지"
 * 도장을 찍고, 로드 때 현재 배포 해시와 비교해 배포가 더 새로우면 로컬
 * 저장본을 버리는 데 쓴다. 매니페스트 미주입 환경(dev 등)에서는 null.
 */
export function getSceneFileVersionByRegionId(regionId: string): string | null {
  const fileName = getSceneFileNameByRegionId(regionId);
  return fileName ? getAssetContentHash(`/${SCENE_DIR}/${fileName}`) : null;
}

export { getKnownRegionIds, isKnownRegionId };
