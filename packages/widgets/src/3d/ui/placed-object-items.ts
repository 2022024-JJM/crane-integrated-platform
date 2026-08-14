import {
  humanizeModelPath,
  type SavedMapInfo,
  type SavedModelInfo,
  type SavedSensorInfo,
  type SavedTextInfo,
} from '@crane/domain/3d';

export interface PlacedObjectItem {
  id: string;
  displayName: string;
  subtitle: string;
  type: 'model' | 'text' | 'sensor' | 'map';
}

interface GetPlacedObjectItemsParams {
  placedModels: SavedModelInfo[];
  placedTexts?: SavedTextInfo[];
  placedSensors?: SavedSensorInfo[];
  placedMaps?: SavedMapInfo[];
  objectSearch: string;
  textObjectLabel: string;
  mapObjectLabel?: string;
}

export function getPlacedObjectItems({
  placedModels,
  placedTexts = [],
  placedSensors = [],
  placedMaps = [],
  objectSearch = '',
  textObjectLabel,
  mapObjectLabel = 'Map',
}: GetPlacedObjectItemsParams): PlacedObjectItem[] {
  const normalizedObjectSearch = objectSearch.trim().toLowerCase();

  // 지도를 맨 앞에 둔다 — 씬의 바닥이자 다른 객체의 기준면이라
  // 계층 목록에서도 최상위로 읽히는 편이 자연스럽다.
  const mapItems: PlacedObjectItem[] = placedMaps.map((map) => ({
    id: map.id,
    displayName: humanizeModelPath(map.path),
    subtitle: mapObjectLabel,
    type: 'map',
  }));

  const modelItems: PlacedObjectItem[] = placedModels.map((model) => ({
    id: model.id,
    displayName: model.equipName.trim() || model.id,
    subtitle: humanizeModelPath(model.path),
    type: 'model',
  }));

  const textItems: PlacedObjectItem[] = placedTexts.map((text) => ({
    id: text.id,
    displayName: text.content.trim() || 'Text',
    subtitle: textObjectLabel,
    type: 'text',
  }));

  const sensorItems: PlacedObjectItem[] = placedSensors.map((sensor) => ({
    id: sensor.id,
    displayName: sensor.name || sensor.id,
    subtitle: sensor.type === 'lidar' ? 'LiDAR' : 'Camera',
    type: 'sensor',
  }));

  const items = [...mapItems, ...modelItems, ...textItems, ...sensorItems];

  if (!normalizedObjectSearch) {
    return items;
  }

  return items.filter(
    (item) =>
      item.displayName.toLowerCase().includes(normalizedObjectSearch) ||
      item.subtitle.toLowerCase().includes(normalizedObjectSearch),
  );
}
