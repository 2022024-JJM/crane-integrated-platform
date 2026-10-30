import type { CraneScope } from '../model/types';

/**
 * region → 크레인 스냅샷 서버 범위. 외업(옥포 도크·필리 도크)은 outdoor, 내업
 * (dock-in)은 indoor 다. 태그 페이지·3D 실시간·리플레이·에디터의 크레인 목록이
 * 전부 이 표로 REST·STOMP 경로를 고른다.
 */
const CRANE_SCOPE_BY_REGION_ID: Record<string, CraneScope> = {
  'dock-1': 'outdoor',
  'dock-2': 'outdoor',
  'philly-dock-2': 'outdoor',
  'dock-in': 'indoor',
};

/**
 * region 의 범위. 미등록이면 **null** — 그 화면은 크레인 피드를 켜지 않는다.
 * 기본 범위로 대체하지 않는다(다른 범위의 크레인이 섞여 보인다).
 */
export function getCraneScopeByRegion(regionId: string): CraneScope | null {
  return Object.hasOwn(CRANE_SCOPE_BY_REGION_ID, regionId)
    ? CRANE_SCOPE_BY_REGION_ID[regionId]
    : null;
}
