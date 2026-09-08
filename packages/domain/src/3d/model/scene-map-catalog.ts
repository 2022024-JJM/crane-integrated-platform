/**
 * 씬 지도(GLB 지형) 카탈로그.
 *
 * 에디터 하단 Project 패널의 Map 카테고리가 이 목록에서 지도를 고른다 —
 * 배경(sceneEnvironmentCatalog)과 같은 클릭 단일 선택이다. 팔레트가 관리하는
 * 지도는 maps[0] 1장이고(드롭 raycast 바닥면·탑뷰 bounds 도 maps[0]만 본다),
 * 타일 클릭(setSceneMap)은 maps 배열 전체를 교체한다.
 *
 * 주변 컨텍스트 지도는 이 목록에 넣지 않고 씬 JSON 에 maps[1] 로 직접 적는다
 * (philly 두 씬의 /maps/philly-terrain.glb). 렌더·잠금·이동·계층 목록은 전
 * 항목을 돌므로 그대로 동작하며, 목록에 넣으면 타일 오클릭 한 번으로 maps[0]
 * 조선소 지도를 날리는 경로가 생겨서 뺐다.
 *
 * 배경과 달리 저장본에는 id가 아니라 파일 경로(SavedMapInfo.path)가 실린다 —
 * 기존 씬 파일이 이미 경로 기반이라 스키마를 유지한다. 선택 표시는 경로
 * 매칭으로 한다.
 *
 * 파일은 apps/shell/public/maps/에 둔다.
 */

export interface SceneMapCatalogItem {
  id: string;
  label: string;
  /** public 기준 절대 경로. BASE_URL은 로더가 붙인다(withBaseUrl). */
  path: string;
}

export const sceneMapCatalog: SceneMapCatalogItem[] = [
  {
    id: 'map-okpo',
    label: 'Okpo',
    path: '/maps/okpo.glb',
  },
  {
    id: 'map-phillyshipyard',
    label: 'Philly Shipyard',
    path: '/maps/phillyshipyard.glb',
  },
  {
    id: 'map-1dock',
    label: '1 Dock',
    path: '/maps/1dock.glb',
  },
  {
    id: 'map-plane',
    label: 'Plane',
    path: '/maps/plane.glb',
  },
];
