import { Box3, type Object3D } from 'three';
import type { SavedMapInfo } from '../model/types';

/**
 * 카메라 이동 범위(XZ)·탑뷰 fit·최대 궤도 반경의 기준이 되는 지도들.
 *
 * 인스펙터 카메라 탭의 "카메라 영역 제한" 체크(`SavedMapInfo.cameraBounds`)가
 * 켜진 지도들이고, 하나도 없으면 씬의 모든 지도다 — 체크가 없는 씬에서 탑뷰가
 * 아무것도 못 잡는 것보다 전부 보이는 편이 낫다. 드롭 raycast 바닥면은 여기가
 * 아니라 resolveGroundMap(카탈로그 kind) 이 정한다.
 *
 * 반환은 입력 배열 항목 참조 그대로(복사 없음)이고, 체크가 없으면 입력 배열
 * 자체를 돌려준다 — 매 프레임 참조 비교로 무효화하는 캐시(SceneCameraLimits)가
 * 이 계약에 기댄다.
 */
const NO_MAPS: readonly SavedMapInfo[] = Object.freeze([]);

export function resolveCameraBoundsMaps(
  maps: readonly SavedMapInfo[] | null | undefined,
): readonly SavedMapInfo[] {
  if (!maps || maps.length === 0) return NO_MAPS;
  const checked = maps.filter((m) => m.cameraBounds === true);
  return checked.length > 0 ? checked : maps;
}

/**
 * 객체들의 월드 AABB 합집합. 비어 있지 않은 박스만 union 하고, 미등록
 * (undefined)·지오메트리 없는 객체는 건너뛰며, 결과가 비면 null.
 *
 * widgets 의 collectWorldBounds 와 달리 빈 객체를 월드 위치 한 점으로 기여
 * 시키지 않는다 — 카메라 clamp 에 한 점짜리 퇴화 박스가 들어가면 카메라가
 * 그 점에 고정된다. 지도 GLB 가 아직 로드 전이면 그 장은 빠진 채 나머지로
 * 합집합을 만들고, 등록되는 프레임에 호출자가 다시 계산한다.
 *
 * setFromObject 는 대상 자신의 matrixWorld 만 갱신한다(조상은 렌더러가 매
 * 프레임 갱신). 지오메트리 boundingBox 캐시를 쓰므로 비용은 노드 수 비례다.
 */
export function unionObjectBounds(
  objects: readonly (Object3D | undefined)[],
): Box3 | null {
  const box = new Box3();
  const objectBox = new Box3();
  for (const object of objects) {
    if (!object) continue;
    objectBox.setFromObject(object);
    if (!objectBox.isEmpty()) box.union(objectBox);
  }
  return box.isEmpty() ? null : box;
}

/**
 * 기준 지도들의 월드 AABB 합집합. `getObject` 는 뷰어에선
 * modelObjectRegistry.get, 에디터 캔버스에선 로컬 레지스트리 조회다.
 * 체크된 지도가 전부 미등록이면 null — 전체 지도로 넘어가지 않는다.
 */
export function collectCameraBoundsBox(
  maps: readonly SavedMapInfo[] | null | undefined,
  getObject: (id: string) => Object3D | undefined,
): Box3 | null {
  return unionObjectBounds(
    resolveCameraBoundsMaps(maps).map((m) => getObject(m.id)),
  );
}
