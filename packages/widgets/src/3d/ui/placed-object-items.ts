import {
  humanizeModelPath,
  type SavedModelInfo,
  type SavedSensorInfo,
  type SavedTextInfo,
} from '@crane/domain/3d';

export interface PlacedObjectItem {
  id: string;
  displayName: string;
  subtitle: string;
  type: 'model' | 'text' | 'sensor';
}

interface GetPlacedObjectItemsParams {
  placedModels: SavedModelInfo[];
  placedTexts?: SavedTextInfo[];
  placedSensors?: SavedSensorInfo[];
  objectSearch: string;
  textObjectLabel: string;
}

export function getPlacedObjectItems({
  placedModels,
  placedTexts = [],
  placedSensors = [],
  objectSearch = '',
  textObjectLabel,
}: GetPlacedObjectItemsParams): PlacedObjectItem[] {
  const normalizedObjectSearch = objectSearch.trim().toLowerCase();

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

  const items = [...modelItems, ...textItems, ...sensorItems];

  if (!normalizedObjectSearch) {
    return items;
  }

  return items.filter(
    (item) =>
      item.displayName.toLowerCase().includes(normalizedObjectSearch) ||
      item.subtitle.toLowerCase().includes(normalizedObjectSearch),
  );
}
