import {
  humanizeModelPath,
  type SavedMapInfo,
  type SavedModelInfo,
  type SavedTextInfo,
} from '@crane/domain/3d';

export interface PlacedObjectItem {
  id: string;
  displayName: string;
  type: 'model' | 'text' | 'map';
  /**
   * 편집 잠금 — 씬 데이터(locked)에서 파생. 잠긴 행은 목록에서 선택되지
   * 않고 삭제 버튼도 숨긴다.
   */
  locked?: boolean;
}

interface GetPlacedObjectItemsParams {
  placedModels: SavedModelInfo[];
  placedTexts?: SavedTextInfo[];
  placedMaps?: SavedMapInfo[];
  objectSearch: string;
}

export function getPlacedObjectItems({
  placedModels,
  placedTexts = [],
  placedMaps = [],
  objectSearch = '',
}: GetPlacedObjectItemsParams): PlacedObjectItem[] {
  const normalizedObjectSearch = objectSearch.trim().toLowerCase();

  // 지도를 맨 앞에 둔다 — 씬의 바닥이자 다른 객체의 기준면이라
  // 계층 목록에서도 최상위로 읽히는 편이 자연스럽다.
  const mapItems: PlacedObjectItem[] = placedMaps.map((map) => ({
    id: map.id,
    displayName: map.name?.trim() || humanizeModelPath(map.path),
    type: 'map',
    // 지도는 필드 없음 = 잠김(SavedMapInfo.locked 주석 참고).
    locked: map.locked !== false,
  }));

  const modelItems: PlacedObjectItem[] = placedModels.map((model) => ({
    id: model.id,
    displayName: model.equipName.trim() || model.id,
    type: 'model',
    locked: model.locked === true,
  }));

  const textItems: PlacedObjectItem[] = placedTexts.map((text) => ({
    id: text.id,
    displayName: text.content.trim() || 'Text',
    type: 'text',
    locked: text.locked === true,
  }));

  const items = [...mapItems, ...modelItems, ...textItems];

  if (!normalizedObjectSearch) {
    return items;
  }

  return items.filter((item) =>
    item.displayName.toLowerCase().includes(normalizedObjectSearch),
  );
}
