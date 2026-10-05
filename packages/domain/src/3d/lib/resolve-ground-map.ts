import type { SavedMapInfo } from '../model/types';

const NO_MAPS: readonly SavedMapInfo[] = Object.freeze([]);

/**
 * 씬의 "바닥 지도들" — 드롭 raycast 바닥면의 기준. 카메라 이동 범위·탑뷰·
 * 최대 반경의 기준은 여기가 아니라 인스펙터에서 체크한 지도들
 * (resolveCameraBoundsMaps, camera-bounds-maps.ts)이다.
 *
 * 배열 인덱스(maps[0])가 아니라 지도의 `role` 로 판정한다: ground 지도
 * **전부**가 바닥이고(한 지도가 여러 장으로 나뉘어 반입되는 경우 — 필리조선소
 * Area 1/2), ground 가 하나도 없으면(역할이 없는 지도만 있거나 context 만
 * 있는 씬) 예전 규칙대로 maps[0] 한 장으로 폴백한다. 반환 항목은 입력 배열의
 * 항목 그대로(복사 없음), 입력 순서를 유지한다. 빈 입력은 공유 빈 배열이다.
 */
export function resolveGroundMaps(
  maps: readonly SavedMapInfo[] | null | undefined,
): readonly SavedMapInfo[] {
  if (!maps || maps.length === 0) return NO_MAPS;
  const grounds = maps.filter((m) => m.role === 'ground');
  return grounds.length > 0 ? grounds : [maps[0]];
}

/**
 * 주변 지형(context)인가 — 삼각형이 많아 그림자와 바다 반사에서 빼는 지도다.
 * 모니터링·에디터·바다 미러 패스가 이 판정 하나를 쓴다.
 */
export function isContextMap(map: Pick<SavedMapInfo, 'role'>): boolean {
  return map.role === 'context';
}
