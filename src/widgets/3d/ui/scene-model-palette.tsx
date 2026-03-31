import type {
  SavedMapInfo,
  SavedModelInfo,
  SceneModelCatalogItem,
} from '@/entities/3d';
import { Card, CardContent } from '@/shared/ui/molecules/card';
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
  onDeleteMap,
  onSave,
  onExport,
  saveDisabled = false,
  exportDisabled = false,
  isDirty = false,
  isSaving = false,
}: SceneModelPaletteProps) {
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

        {map ? <PaletteMapSection map={map} onDeleteMap={onDeleteMap} /> : null}

        <PalettePlacedObjects
          placedModels={placedModels}
          selectedModelId={selectedModelId}
          onSelectPlacedModel={onSelectPlacedModel}
          onDeletePlacedModel={onDeletePlacedModel}
        />
      </CardContent>
    </Card>
  );
}
