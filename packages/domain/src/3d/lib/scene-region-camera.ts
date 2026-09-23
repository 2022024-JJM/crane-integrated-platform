import { isSceneFileShared } from '../model/scene-file-map';
import type { SavedCameraInfo, SavedSceneInfo } from '../model/types';

/**
 * 공유 씬 파일의 region 별 카메라 — 로드·저장 경계에서만 쓰는 순수 함수.
 *
 * 여러 region 이 한 씬 파일을 쓰면(scene-file-map.ts) 지도·모델은 같고
 * 카메라 구도만 다르다. 파일에는 `cameraByRegion[regionId]` 슬롯으로 두고,
 * 소비자(모니터링·에디터 initialCamera·3D 플레이)는 여전히 `camera` 만
 * 보게 하려고 로드 때 슬롯을 `camera` 로 해석해 넣는다. 저장은 반대로
 * 자기 슬롯에만 쓴다 — `camera` 를 그대로 저장하면 다른 region 의 구도가
 * 마지막 저장자의 것으로 덮인다.
 */

/** 자기 region 슬롯을 `camera` 로 해석한다. 바뀌는 게 없으면 같은 참조. */
export function resolveSceneCameraForRegion(
  scene: SavedSceneInfo,
  regionId: string,
): SavedSceneInfo {
  const slot = scene.cameraByRegion?.[regionId];
  if (!slot) return scene;
  if (scene.camera === slot) return scene;
  return { ...scene, camera: slot };
}

/**
 * 저장 직전 카메라를 씬에 써넣는다.
 *
 * - 공유 파일: `cameraByRegion[regionId]` 에 기록하고 다른 region 슬롯은
 *   보존한다. `camera` 도 같은 값으로 갱신해 슬롯이 없는 region 의 폴백이
 *   "마지막 저장 구도" 가 되게 한다. null 이면 슬롯을 지운다.
 * - 단독 파일: `camera` 만 기록하고 `cameraByRegion` 은 제거한다 — 공유가
 *   풀린 파일에 옛 슬롯이 남지 않게.
 */
export function withRegionCamera(
  scene: SavedSceneInfo,
  regionId: string,
  camera: SavedCameraInfo | null,
): SavedSceneInfo {
  if (!isSceneFileShared(regionId)) {
    const solo: SavedSceneInfo = { ...scene, camera };
    delete solo.cameraByRegion;
    return solo;
  }
  const slots = { ...scene.cameraByRegion };
  if (camera) {
    slots[regionId] = camera;
  } else {
    delete slots[regionId];
  }
  const next: SavedSceneInfo = { ...scene, camera };
  if (Object.keys(slots).length > 0) {
    next.cameraByRegion = slots;
  } else {
    delete next.cameraByRegion;
  }
  return next;
}
