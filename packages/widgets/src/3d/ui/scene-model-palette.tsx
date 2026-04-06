import { Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  SavedMapInfo,
  SavedModelInfo,
  SavedTextInfo,
  SceneModelCatalogItem,
} from '@crane/domain/3d';
import { Card, CardContent } from '@crane/ui/molecules/card';
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
  selectedIds: Set<string>;
  onDragStart: (item: SceneModelCatalogItem) => void;
  onDragEnd: () => void;
  onSelectPlacedModel: (id: string) => void;
  onDeletePlacedModel: (id: string) => void;
  placedTexts?: SavedTextInfo[];
  onSelectPlacedText?: (id: string) => void;
  onDeletePlacedText?: (id: string) => void;
  onTogglePlacedModel?: (id: string) => void;
  onTogglePlacedText?: (id: string) => void;
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
  selectedIds,
  onDragStart,
  onDragEnd,
  onSelectPlacedModel,
  onDeletePlacedModel,
  placedTexts,
  onSelectPlacedText,
  onDeletePlacedText,
  onTogglePlacedModel,
  onTogglePlacedText,
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
    <Card className="border-border bg-card text-card-foreground flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0">
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
          className="border-border bg-muted text-muted-foreground hover:bg-muted/80 flex w-full cursor-grab items-center gap-2 rounded-md border px-3 py-2 text-[12px] transition active:cursor-grabbing"
        >
          <Type className="size-3.5" />
          {t('monitoring:editor.addText')}
        </div>

        {map ? <PaletteMapSection map={map} onDeleteMap={onDeleteMap} /> : null}

        <PalettePlacedObjects
          placedModels={placedModels}
          placedTexts={placedTexts}
          selectedIds={selectedIds}
          onSelectPlacedModel={onSelectPlacedModel}
          onDeletePlacedModel={onDeletePlacedModel}
          onSelectPlacedText={onSelectPlacedText}
          onDeletePlacedText={onDeletePlacedText}
          onTogglePlacedModel={onTogglePlacedModel}
          onTogglePlacedText={onTogglePlacedText}
        />
      </CardContent>
    </Card>
  );
}
