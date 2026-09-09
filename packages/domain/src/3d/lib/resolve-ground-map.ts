import { getSceneMapCatalogItemByPath } from '../model/scene-map-catalog';
import type { SavedMapInfo } from '../model/types';

/**
 * 씬의 "바닥 지도" — 드롭 raycast 바닥면의 기준이 되는 한 장. 카메라 이동
 * 범위·탑뷰·최대 반경의 기준은 여기가 아니라 인스펙터에서 체크한 지도들
 * (resolveCameraBoundsMaps, camera-bounds-maps.ts)이다.
 *
 * 배열 인덱스(maps[0])가 아니라 카탈로그의 `kind` 로 판정한다: 첫 ground 지도가
 * 바닥이고, ground 가 하나도 없으면(카탈로그에 없는 경로만 있거나 context 만
 * 있는 씬) 예전 규칙대로 maps[0] 으로 폴백한다. 반환값은 입력 배열의 항목
 * 그대로라(복사 없음) id 를 memo 의존성에 쓰는 호출부가 참조 비교에 기대도 된다.
 */
export function resolveGroundMap(
  maps: readonly SavedMapInfo[] | null | undefined,
): SavedMapInfo | null {
  if (!maps || maps.length === 0) return null;
  const ground = maps.find(
    (m) => getSceneMapCatalogItemByPath(m.path)?.kind === 'ground',
  );
  return ground ?? maps[0] ?? null;
}
