import type { SavedCameraInfo, SavedSceneInfo } from '../model/types';
import type { SavedSceneView } from '../model/view-types';

/**
 * 홈 카메라 — 화면의 초기 시점이자 "메인 뷰" 버튼이 가는 구도. 세 캔버스
 * (모니터링·3D 플레이·에디터)가 이 함수 하나를 본다.
 *
 * region 의 메인 뷰(`mainViewByRegion[regionId]` 가 가리키는 뷰)가 있으면
 * 그 구도, 없으면 `camera`(로드 경계가 region 슬롯을 해석해 넣은 저장 시점
 * 카메라). 깨진 참조(없는 뷰)는 sanitize 가 비우지만 런타임에 뷰가 먼저
 * 지워진 순간도 폴백으로 넘어간다.
 */
export function resolveMainView(
  scene: SavedSceneInfo | null | undefined,
  regionId: string,
): SavedSceneView | null {
  const id = scene?.mainViewByRegion?.[regionId];
  if (typeof id !== 'string') return null;
  return scene?.views?.find((view) => view.id === id) ?? null;
}

/**
 * 돌아오는 객체는 뷰(또는 `camera`) 그 참조다 — 새 객체를 만들지 않아 씬이
 * 바뀌지 않는 한 참조가 같고, 참조를 의존성으로 쓰는 memo·effect(모니터링
 * cameraPreset, 에디터 resetView)가 헛돌지 않는다.
 */
export function resolveSceneHomeCamera(
  scene: SavedSceneInfo | null | undefined,
  regionId: string,
): SavedCameraInfo | null {
  const main = resolveMainView(scene, regionId);
  if (main) return main;
  return scene?.camera ?? null;
}
