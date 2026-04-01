import { Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  SavedMapInfo,
  SavedModelInfo,
  SavedTextInfo,
  SceneModelCatalogItem,
} from '@/entities/3d';
import { Card, CardContent } from '@/shared/ui/molecules/card';
import { SCENE_TEXT_DRAG_TYPE } from './use-scene-drop';
import { PaletteHeader } from './palette-header';
import { PaletteAssetGrid } from './palette-asset-grid';
import { PaletteMapSection } from './palette-map-section';
import { PalettePlacedObjects } from './palette-placed-objects';

interface SceneModelPaletteProps {
  items: SceneModelCatalogItem[];
  map: SavedMapInfo | null;
  placedModels: SavedModelInfo[];
  draggingItemId: string | null;
  selectedModelId: string | null;
  onDragStart: (item: SceneModelCatalogItem) => void;
  onDragEnd: () => void;
  onSelectPlacedModel: (id: string) => void;
  onDeletePlacedModel: (id: string) => void;
  placedTexts?: SavedTextInfo[];
  onSelectPlacedText?: (id: string) => void;
  onDeletePlacedText?: (id: string) => void;
  onTextDragStart: () => void;
  onTextDragEnd: () => void;
  onDeleteMap: () => void;
  onSave: () => void;
  onExport: () => void;
  saveDisabled?: boolean;
  exportDisabled?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
}

export function SceneModelPalette({
  items,
  map,
  placedModels,
  draggingItemId,
  selectedModelId,
  onDragStart,
  onDragEnd,
  onSelectPlacedModel,
  onDeletePlacedModel,
  placedTexts,
  onSelectPlacedText,
  onDeletePlacedText,
  onTextDragStart,
  onTextDragEnd,
  onDeleteMap,
  onSave,
  onExport,
  saveDisabled = false,
  exportDisabled = false,
  isDirty = false,
  isSaving = false,
}: SceneModelPaletteProps) {
  const { t } = useTranslation();

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden border-white/8 bg-[#171717] py-0 text-white">
      <PaletteHeader
        onSave={onSave}
        onExport={onExport}
        saveDisabled={saveDisabled}
        exportDisabled={exportDisabled}
        isDirty={isDirty}
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
          className="flex w-full cursor-grab items-center gap-2 rounded-md border border-white/8 bg-white/4 px-3 py-2 text-[12px] text-white/80 transition hover:bg-white/8 active:cursor-grabbing"
        >
          <Type className="size-3.5" />
          {t('monitoring:editor.addText')}
        </div>

        {map ? <PaletteMapSection map={map} onDeleteMap={onDeleteMap} /> : null}

        <PalettePlacedObjects
          placedModels={placedModels}
          placedTexts={placedTexts}
          selectedModelId={selectedModelId}
          onSelectPlacedModel={onSelectPlacedModel}
          onDeletePlacedModel={onDeletePlacedModel}
          onSelectPlacedText={onSelectPlacedText}
          onDeletePlacedText={onDeletePlacedText}
        />
      </CardContent>
    </Card>
  );
}
