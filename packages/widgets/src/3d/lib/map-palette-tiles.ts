import type { SavedMapInfo } from '@crane/domain/3d';
import type { ScenePaletteMap } from '@crane/features/asset-library';

export interface MapPaletteTile {
  /** 팔레트 항목 — 자산 라이브러리의 지도 자산. */
  entry: ScenePaletteMap;
  /** 씬에 놓인 이 자산의 지도(첫 항목). 없으면 null. */
  placed: SavedMapInfo | null;
  /** 놓인 지도가 잠겨 있는지. 지도는 "필드 없음 = 잠김"(반전 기본값). */
  locked: boolean;
}

/**
 * 씬의 지도가 이 팔레트 항목의 자산인가. 자산 참조가 있으면 자산 id 로 본다 —
 * 버전이 달라도(놓인 것은 v1, 라이브러리의 현재는 v2) 같은 자산이다. 참조가
 * 없는 지도(자산 참조를 적기 전의 저장본)는 경로로 본다.
 */
function isPlacedEntry(map: SavedMapInfo, entry: ScenePaletteMap): boolean {
  if (map.asset) return map.asset.id === entry.item.id;
  return entry.item.path !== '' && map.path === entry.item.path;
}

/**
 * 팔레트 "맵" 탭 타일 상태 — 팔레트 순서대로, 각 항목이 씬에 놓였는지와
 * 잠겼는지를 판정한다. 같은 자산이 여러 장이면 첫 항목을 대표로 삼고(팔레트는
 * 자산당 한 장만 관리), 라이브러리에 없는 지도는 타일이 없다(계층 목록에서만
 * 다룬다).
 */
export function getMapPaletteTiles(
  maps: readonly SavedMapInfo[] | null | undefined,
  entries: readonly ScenePaletteMap[],
): MapPaletteTile[] {
  const list = maps ?? [];
  return entries.map((entry) => {
    const placed = list.find((map) => isPlacedEntry(map, entry)) ?? null;
    return {
      entry,
      placed,
      locked: placed != null && placed.locked !== false,
    };
  });
}
