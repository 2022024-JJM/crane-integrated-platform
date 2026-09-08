import {
  sceneMapCatalog,
  type SavedMapInfo,
  type SceneMapCatalogItem,
} from '@crane/domain/3d';

export interface MapPaletteTile {
  item: SceneMapCatalogItem;
  /** 씬에 놓인 같은 경로의 지도(첫 항목). 없으면 null. */
  placed: SavedMapInfo | null;
  /** 놓인 지도가 잠겨 있는지. 지도는 "필드 없음 = 잠김"(반전 기본값). */
  locked: boolean;
}

/**
 * 팔레트 "맵" 탭 타일 상태 — 카탈로그 순서대로, 각 항목이 씬에 놓였는지와
 * 잠겼는지를 경로 매칭으로 판정한다. 같은 경로가 여러 장이면 첫 항목을
 * 대표로 삼고(팔레트는 경로당 한 장만 관리), 카탈로그에 없는 경로의 지도는
 * 타일이 없다(계층 목록에서만 다룬다).
 */
export function getMapPaletteTiles(
  maps: readonly SavedMapInfo[] | null | undefined,
  catalog: readonly SceneMapCatalogItem[] = sceneMapCatalog,
): MapPaletteTile[] {
  const list = maps ?? [];
  return catalog.map((item) => {
    const placed = list.find((m) => m.path === item.path) ?? null;
    return {
      item,
      placed,
      locked: placed != null && placed.locked !== false,
    };
  });
}
