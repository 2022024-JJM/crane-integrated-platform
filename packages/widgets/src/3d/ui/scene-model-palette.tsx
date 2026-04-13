import { Camera as CameraIcon, Radar, Type } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  SavedMapInfo,
  SavedModelInfo,
  SavedSensorInfo,
  SavedTextInfo,
  SceneModelCatalogItem,
} from '@crane/domain/3d';
import { Card, CardContent } from '@crane/ui/molecules/card';
import {
  SCENE_SENSOR_DRAG_TYPE,
  SCENE_TEXT_DRAG_TYPE,
} from './use-scene-drop';
import { getPlacedObjectItems } from './placed-object-items';
import { PaletteHeader } from './palette-header';
import { PaletteAssetGrid } from './palette-asset-grid';
import { PaletteMapSection } from './palette-map-section';
import { PalettePlacedObjects } from './palette-placed-objects';

interface SceneModelPaletteProps {
  items: SceneModelCatalogItem[];
  maps: SavedMapInfo[];
  placedModels: SavedModelInfo[];
  draggingItemId: string | null;
  selectedIds: Set<string>;
  onDragStart: (item: SceneModelCatalogItem) => void;
  onDragEnd: () => void;
  onSelectPlacedModel: (id: string) => void;
  onDeletePlacedModel: (id: string) => void;
  placedTexts?: SavedTextInfo[];
  placedSensors?: SavedSensorInfo[];
  onSelectPlacedText?: (id: string) => void;
  onDeletePlacedText?: (id: string) => void;
  onTogglePlacedModel?: (id: string) => void;
  onTogglePlacedText?: (id: string) => void;
  onSelectPlacedSensor?: (id: string) => void;
  onDeletePlacedSensor?: (id: string) => void;
  onTextDragStart: () => void;
  onTextDragEnd: () => void;
  onSensorDragStart: (kind: 'lidar' | 'camera') => void;
  onSensorDragEnd: () => void;
  onDeleteMap: (id: string) => void;
  onSave: () => void;
  onExport: () => void;
  saveDisabled?: boolean;
  exportDisabled?: boolean;
  isSaving?: boolean;
}

export function SceneModelPalette({
  items,
  maps,
  placedModels,
  draggingItemId,
  selectedIds,
  onDragStart,
  onDragEnd,
  onSelectPlacedModel,
  onDeletePlacedModel,
  placedTexts,
  placedSensors,
  onSelectPlacedText,
  onDeletePlacedText,
  onTogglePlacedModel,
  onTogglePlacedText,
  onSelectPlacedSensor,
  onDeletePlacedSensor,
  onTextDragStart,
  onTextDragEnd,
  onSensorDragStart,
  onSensorDragEnd,
  onDeleteMap,
  onSave,
  onExport,
  saveDisabled = false,
  exportDisabled = false,
  isSaving = false,
}: SceneModelPaletteProps) {
  const { t } = useTranslation();
  const [objectSearch, setObjectSearch] = useState('');

  const placedObjectCount = useMemo(() => {
    return getPlacedObjectItems({
      placedModels,
      placedTexts,
      placedSensors,
      objectSearch,
      textObjectLabel: t('monitoring:editor.textObject'),
    }).length;
  }, [objectSearch, placedModels, placedSensors, placedTexts, t]);

  return (
    <Card className="border-border bg-card text-card-foreground flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0">
      <PaletteHeader
        objectSearch={objectSearch}
        onObjectSearchChange={setObjectSearch}
        placedObjectCount={placedObjectCount}
        onSave={onSave}
        onExport={onExport}
        saveDisabled={saveDisabled}
        exportDisabled={exportDisabled}
        isSaving={isSaving}
      />

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 px-2 py-2">
        <PaletteAssetGrid
          items={items}
          draggingItemId={draggingItemId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />

        <div
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(SCENE_TEXT_DRAG_TYPE, 'text');
            event.dataTransfer.effectAllowed = 'copy';
            onTextDragStart();
          }}
          onDragEnd={onTextDragEnd}
          className="border-border bg-muted text-muted-foreground hover:bg-muted/80 flex w-full cursor-grab items-center gap-2 rounded-md border px-3 py-2 text-[12px] transition active:cursor-grabbing"
        >
          <Type className="size-3.5" />
          {t('monitoring:editor.addText')}
        </div>

        <div
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(SCENE_SENSOR_DRAG_TYPE, 'lidar');
            event.dataTransfer.effectAllowed = 'copy';
            onSensorDragStart('lidar');
          }}
          onDragEnd={onSensorDragEnd}
          className="border-border bg-muted text-muted-foreground hover:bg-muted/80 flex w-full cursor-grab items-center gap-2 rounded-md border px-3 py-2 text-[12px] transition active:cursor-grabbing"
        >
          <Radar className="size-3.5" />
          {t('monitoring:editor.addLidarSensor')}
        </div>

        <div
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(SCENE_SENSOR_DRAG_TYPE, 'camera');
            event.dataTransfer.effectAllowed = 'copy';
            onSensorDragStart('camera');
          }}
          onDragEnd={onSensorDragEnd}
          className="border-border bg-muted text-muted-foreground hover:bg-muted/80 flex w-full cursor-grab items-center gap-2 rounded-md border px-3 py-2 text-[12px] transition active:cursor-grabbing"
        >
          <CameraIcon className="size-3.5" />
          {t('monitoring:editor.addCameraSensor')}
        </div>

        {maps.map((m) => (
          <PaletteMapSection key={m.id} map={m} onDeleteMap={() => onDeleteMap(m.id)} />
        ))}

        <PalettePlacedObjects
          placedModels={placedModels}
          placedTexts={placedTexts}
          placedSensors={placedSensors}
          objectSearch={objectSearch}
          selectedIds={selectedIds}
          onSelectPlacedModel={onSelectPlacedModel}
          onDeletePlacedModel={onDeletePlacedModel}
          onSelectPlacedText={onSelectPlacedText}
          onDeletePlacedText={onDeletePlacedText}
          onTogglePlacedModel={onTogglePlacedModel}
          onTogglePlacedText={onTogglePlacedText}
          onSelectPlacedSensor={onSelectPlacedSensor}
          onDeletePlacedSensor={onDeletePlacedSensor}
        />
      </CardContent>
    </Card>
  );
}
