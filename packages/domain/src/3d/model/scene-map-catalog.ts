/**
 * 씬 지도(GLB 지형) 카탈로그.
 *
 * 에디터 하단 Project 패널의 Map 카테고리가 이 목록에서 지도를 고른다. 배경
 * (sceneEnvironmentCatalog)과 달리 단일 선택이 아니라 **추가/제거 토글**이다 —
 * 씬에는 지도가 여러 장 놓일 수 있고(조선소 + 주변 지형처럼), 타일 클릭은
 * 그 지도 한 장만 append(addSceneMap) 하거나 제거(deletePlacedMap) 한다.
 * 같은 경로는 팔레트에서 한 장만 놓인다.
 *
 * `kind` 가 지도의 역할을 정한다. 드롭 raycast 바닥면·탑뷰 bounds 는 씬의
 * **첫 ground 지도**를 기준으로 하고(resolveGroundMap — 배열 순서가 아니라
 * 이 표의 kind 로 판정, ground 가 없으면 maps[0] 폴백), context 지도(philly-
 * terrain 같은 주변 지형)는 렌더·잠금·이동·계층 목록에만 참여한다. 폭 수 km
 * 짜리 지형이 탑뷰 프레이밍을 잡아먹지 않게 하려는 구분이다.
 *
 * `defaultPosition` 은 팔레트로 추가할 때의 초기 배치다. philly-terrain 의 값은
 * goliath.json 기준(조선소 지도 원점·무회전)이며 디자이너 Blender 씬의 조선소
 * V4 오프셋을 보정한 값이다(assets-src/README.md). philly-2dock.json 은 조선소
 * 지도가 yaw 354.5° 라 추가 후 인스펙터에서 (855.96, 3.482, -767.71)·rotation
 * y 354.5 로 맞춘다.
 *
 * 배경과 달리 저장본에는 id가 아니라 파일 경로(SavedMapInfo.path)가 실린다 —
 * 기존 씬 파일이 이미 경로 기반이라 스키마를 유지한다. 배치 표시는 경로
 * 매칭으로 한다.
 *
 * 파일은 apps/shell/public/maps/에 둔다.
 */
import type { Vector3Tuple } from '@crane/core/types/math';

/** ground = 드롭 raycast·탑뷰 bounds 기준 지형. context = 주변 지형(여러 장 가능). */
export type SceneMapKind = 'ground' | 'context';

export interface SceneMapCatalogItem {
  id: string;
  label: string;
  /** public 기준 절대 경로. BASE_URL은 로더가 붙인다(withBaseUrl). */
  path: string;
  kind: SceneMapKind;
  /** 팔레트로 추가할 때의 초기 position. 없으면 원점. */
  defaultPosition?: Vector3Tuple;
}

export const sceneMapCatalog: SceneMapCatalogItem[] = [
  {
    id: 'map-okpo',
    label: 'Okpo',
    path: '/maps/okpo.glb',
    kind: 'ground',
  },
  {
    id: 'map-phillyshipyard',
    label: 'Philly Shipyard',
    path: '/maps/phillyshipyard.glb',
    kind: 'ground',
  },
  {
    id: 'map-philly-terrain',
    label: 'Philly Terrain',
    path: '/maps/philly-terrain.glb',
    kind: 'context',
    defaultPosition: [778.43, 3.482, -846.212],
  },
  {
    id: 'map-1dock',
    label: '1 Dock',
    path: '/maps/1dock.glb',
    kind: 'ground',
  },
  {
    id: 'map-plane',
    label: 'Plane',
    path: '/maps/plane.glb',
    kind: 'ground',
  },
];

export function getSceneMapCatalogItemByPath(
  path: string | null | undefined,
): SceneMapCatalogItem | null {
  if (!path) return null;
  return sceneMapCatalog.find((m) => m.path === path) ?? null;
}
