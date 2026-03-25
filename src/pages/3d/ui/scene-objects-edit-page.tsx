import {
  createSceneModel,
  loadSceneInfoByRegionId,
  saveSceneInfoByRegionId,
  sceneModelCatalog,
  type SavedSceneInfo,
  type SceneModelCatalogItem,
} from '@/entities/3d';
import {
  SceneHistoryControls,
  SceneTransformModeToggle,
  useSelectedSceneObjectEditor,
  useSceneObjectSelectionStore,
  useSceneTransformModeStore,
} from '@/features/3d';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createSceneSnapshot,
  sanitizeSceneInfo,
} from '../model/scene-snapshot';
import { useSceneHistory } from '../model/use-scene-history';
import { useSceneUnsavedChangesGuard } from '../model/use-scene-unsaved-changes-guard';
import {
  SceneModelPalette,
  SceneObjectInspector,
  SceneObjectsEditCanvas,
} from '@/widgets/3d';
import { toast } from 'sonner';

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
  const [isSaving, setIsSaving] = useState(false);
  const [savedSceneSnapshot, setSavedSceneSnapshot] = useState<string | null>(
    null,
  );
  const [draggingCatalogItem, setDraggingCatalogItem] =
    useState<SceneModelCatalogItem | null>(null);
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
  const transformHistoryBaseRef = useRef<SavedSceneInfo | null>(null);
  const {
    sceneInfo,
    replaceScene,
    updateScene,
    commitHistoryFrom,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useSceneHistory();
  const selectedModelId = useSceneObjectSelectionStore(
    (state) => state.selectedModelId,
  );
  const clearSelectedModel = useSceneObjectSelectionStore(
    (state) => state.clearSelectedModel,
  );
  const selectModel = useSceneObjectSelectionStore((state) => state.selectModel);
  const transformMode = useSceneTransformModeStore((state) => state.mode);
  const setTransformMode = useSceneTransformModeStore(
    (state) => state.setMode,
  );
  const resetTransformMode = useSceneTransformModeStore(
    (state) => state.resetMode,
  );
  const {
    selectedModel,
    updateSelectedName,
    updateSelectedOpacity,
    updateSelectedTransform,
    updateSelectedTransformVector,
    removeSelectedModel,
  } = useSelectedSceneObjectEditor({
    sceneInfo,
    updateSceneInfo: updateScene,
  });
  const currentSceneSnapshot = useMemo(
    () => createSceneSnapshot(sceneInfo),
    [sceneInfo],
  );
  const isDirty =
    sceneInfo !== null &&
    savedSceneSnapshot !== null &&
    currentSceneSnapshot !== savedSceneSnapshot;

  useEffect(() => {
    let isMounted = true;

    const loadScene = async () => {
      try {
        const data = await loadSceneInfoByRegionId(regionId);

        if (!isMounted) {
          return;
        }

        replaceScene(data);
        setSavedSceneSnapshot(createSceneSnapshot(data));
      } catch (error) {
        console.error('Failed to load scene editor data.', error);
      }
    };

    clearSelectedModel();
    resetTransformMode();
    setDraggingCatalogItem(null);
    replaceScene(null);
    setSavedSceneSnapshot(null);
    void loadScene();

    return () => {
      isMounted = false;
    };
  }, [clearSelectedModel, regionId, replaceScene, resetTransformMode]);

  useEffect(() => {
    return () => {
      clearSelectedModel();
      resetTransformMode();
    };
  }, [clearSelectedModel, resetTransformMode]);

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

  const saveCurrentScene = useCallback(async () => {
    if (!sceneInfo || isSaving) {
      return false;
    }

    setIsSaving(true);

    try {
      const sanitizedSceneInfo = sanitizeSceneInfo(sceneInfo);
      const savedSceneInfo = await saveSceneInfoByRegionId(
        regionId,
        sanitizedSceneInfo,
      );

      updateScene(savedSceneInfo, { recordHistory: false });
      setSavedSceneSnapshot(createSceneSnapshot(savedSceneInfo));
      toast.success('Scene saved.');
      return true;
    } catch (error) {
      console.error('Failed to save scene info.', error);
      toast.error('Failed to save scene.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, regionId, sceneInfo, updateScene]);

  useSceneUnsavedChangesGuard({
    isDirty,
    isSaving,
    onSave: saveCurrentScene,
  });

  const handleAddModel = (
    catalogItem: SceneModelCatalogItem,
    position: [number, number, number],
  ) => {
    const nextModel = createSceneModel({
      catalogItem,
      position,
    });

    updateScene((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        models: [...prev.models, nextModel],
      };
    });

    selectModel(nextModel.id);
    setDraggingCatalogItem(null);
  };

  const handleSelectPlacedModel = useCallback(
    (id: string) => {
      selectModel(id);
    },
    [selectModel],
  );

  const handleDeletePlacedModel = useCallback(
    (id: string) => {
      updateScene((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          models: prev.models.filter((model) => model.id !== id),
        };
      });

      if (selectedModelId === id) {
        clearSelectedModel();
      }
    },
    [clearSelectedModel, selectedModelId, updateScene],
  );

  const selectedModelLabel =
    selectedModel?.equipName.trim() || selectedModel?.id || t('monitoring:editor.noSelection');

  return (
    <div className="bg-muted/20 flex h-full min-h-0 w-full gap-3 overflow-hidden p-3">
      <aside className="flex w-[24rem] shrink-0 flex-col gap-3">
        <div className="min-h-0 flex-[1.2]">
          <SceneModelPalette
            items={sceneModelCatalog}
            placedModels={sceneInfo?.models ?? []}
            draggingItemId={draggingCatalogItem?.id ?? null}
            selectedModelId={selectedModelId}
            onDragStart={setDraggingCatalogItem}
            onDragEnd={() => {
              setDraggingCatalogItem(null);
            }}
            onSelectPlacedModel={handleSelectPlacedModel}
            onDeletePlacedModel={handleDeletePlacedModel}
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
        <div className="min-h-0 flex-[0.85]">
          <SceneObjectInspector
            selectedModel={selectedModel}
            onNameChange={updateSelectedName}
            onOpacityChange={updateSelectedOpacity}
            onTransformChange={updateSelectedTransform}
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
          onAddModel={handleAddModel}
          onTransformInteractionStart={() => {
            transformHistoryBaseRef.current = sceneInfo;
          }}
          onTransformInteractionEnd={() => {
            commitHistoryFrom(transformHistoryBaseRef.current);
            transformHistoryBaseRef.current = null;
          }}
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
                    {selectedModelLabel}
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
    </div>
  );
}
