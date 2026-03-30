import {
  sceneModelCatalog,
  type SavedSceneInfo,
  type SceneModelCatalogItem,
} from '@/entities/3d';
import {
  SceneHistoryControls,
  SceneTransformModeToggle,
} from '@/features/3d';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSceneEditorSession } from '../model/use-scene-editor-session';
import {
  SceneModelPalette,
  SceneObjectInspector,
  SceneObjectsEditCanvas,
} from '@/widgets/3d';

interface SceneObjectsEditPageProps {
  regionId: string;
}

function downloadSceneInfo(regionId: string, sceneInfo: SavedSceneInfo | null) {
  if (!sceneInfo) {
    return;
  }

  const blob = new Blob([JSON.stringify(sceneInfo, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${regionId}-scene.json`;
  link.click();

  URL.revokeObjectURL(url);
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    tagName === 'button' ||
    target.isContentEditable
  );
}

export function SceneObjectsEditPage({
  regionId,
}: SceneObjectsEditPageProps) {
  const { t } = useTranslation();
  const [draggingCatalogItem, setDraggingCatalogItem] =
    useState<SceneModelCatalogItem | null>(null);
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
  const {
    sceneInfo,
    selectedModelId,
    selectedModelLabel,
    selectedModel,
    isSaving,
    isDirty,
    canUndo,
    canRedo,
    transformMode,
    undo,
    redo,
    setTransformMode,
    saveCurrentScene,
    updateSelectedName,
    updateSelectedOpacity,
    updateSelectedTransform,
    updateSelectedTransformVector,
    removeSelectedModel,
    addModel,
    selectPlacedModel,
    deletePlacedModel,
    deleteMap,
    startTransformInteraction,
    endTransformInteraction,
  } = useSceneEditorSession({
    regionId,
  });

  useEffect(() => {
    setDraggingCatalogItem(null);
  }, [regionId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const canvasRoot = canvasRootRef.current;
      if (!canvasRoot) {
        return;
      }

      const activeElement = document.activeElement;
      const isCanvasFocused =
        activeElement instanceof Node && canvasRoot.contains(activeElement);

      if (!isCanvasFocused) {
        return;
      }

      const isUndoShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'z';
      const isRedoShortcut =
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') ||
        ((event.ctrlKey || event.metaKey) &&
          event.shiftKey &&
          event.key.toLowerCase() === 'z');

      if (isUndoShortcut) {
        event.preventDefault();
        undo();
        return;
      }

      if (isRedoShortcut) {
        event.preventDefault();
        redo();
        return;
      }

      if (event.key !== 'Delete' || !selectedModelId) {
        return;
      }

      event.preventDefault();
      removeSelectedModel();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [redo, removeSelectedModel, selectedModelId, undo]);

  return (
    <div className="bg-muted/20 flex h-full min-h-0 w-full gap-3 overflow-hidden p-3">
      <aside className="flex w-[25rem] shrink-0 flex-col overflow-hidden">
        <div className="min-h-0 flex-1">
          <SceneModelPalette
            items={sceneModelCatalog}
            map={sceneInfo?.map ?? null}
            placedModels={sceneInfo?.models ?? []}
            draggingItemId={draggingCatalogItem?.id ?? null}
            selectedModelId={selectedModelId}
            onDragStart={setDraggingCatalogItem}
            onDragEnd={() => {
              setDraggingCatalogItem(null);
            }}
            onSelectPlacedModel={selectPlacedModel}
            onDeletePlacedModel={deletePlacedModel}
            onDeleteMap={deleteMap}
            onSave={() => {
              void saveCurrentScene();
            }}
            onExport={() => {
              downloadSceneInfo(regionId, sceneInfo);
            }}
            saveDisabled={!sceneInfo}
            exportDisabled={!sceneInfo}
            isDirty={isDirty}
            isSaving={isSaving}
          />
        </div>
      </aside>

      <div className="relative min-w-0 flex-1">
        <SceneObjectsEditCanvas
          rootRef={canvasRootRef}
          sceneInfo={sceneInfo}
          catalogItems={sceneModelCatalog}
          transformMode={transformMode}
          draggingModelCatalogItem={draggingCatalogItem}
          onTransformVectorChange={(field, value) => {
            updateSelectedTransformVector(field, value, {
              recordHistory: false,
            });
          }}
          onAddModel={(catalogItem, position) => {
            addModel(catalogItem, position);
            setDraggingCatalogItem(null);
          }}
          onTransformInteractionStart={startTransformInteraction}
          onTransformInteractionEnd={endTransformInteraction}
        />
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2">
          <div className="pointer-events-auto">
            <SceneTransformModeToggle
              mode={transformMode}
              onModeChange={setTransformMode}
              leadingContent={
                <SceneHistoryControls
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={undo}
                  onRedo={redo}
                />
              }
              trailingContent={
                <div className="bg-background/95 border-border/80 flex items-center gap-2 rounded-lg border px-3 py-2 shadow-sm backdrop-blur-sm">
                  <span className="max-w-36 truncate text-xs font-medium">
                    {selectedModelLabel || t('monitoring:editor.noSelection')}
                  </span>
                  {transformMode === 'translate' ? (
                    <>
                      <span className="bg-border h-4 w-px" />
                      <span className="text-muted-foreground text-[11px] font-medium">
                        {t('monitoring:editor.snapActive')}
                      </span>
                    </>
                  ) : null}
                </div>
              }
            />
          </div>
        </div>
        {!sceneInfo ? (
          <div className="bg-background/75 absolute inset-0 flex items-center justify-center rounded-2xl backdrop-blur-sm">
            <p className="text-muted-foreground text-sm font-medium">
              {t('monitoring:editor.loading')}
            </p>
          </div>
        ) : null}
      </div>

      <aside className="flex w-[21rem] shrink-0 flex-col overflow-hidden">
        <div className="min-h-0 flex-1">
          <SceneObjectInspector
            selectedModel={selectedModel}
            onNameChange={updateSelectedName}
            onOpacityChange={updateSelectedOpacity}
            onTransformChange={updateSelectedTransform}
          />
        </div>
      </aside>
    </div>
  );
}
