import {
  createSceneModel,
  getSceneFileUrlByRegionId,
  saveSceneInfoByRegionId,
  sceneModelCatalog,
  type SavedSceneInfo,
  type SceneModelCatalogItem,
} from '@/entities/3d';
import {
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
import { useSceneUnsavedChangesGuard } from '../model/use-scene-unsaved-changes-guard';
import {
  SceneModelPalette,
  SceneEditorSidebarTabs,
  type SceneEditorSidebarTab,
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
  const [sceneInfo, setSceneInfo] = useState<SavedSceneInfo | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSceneSnapshot, setSavedSceneSnapshot] = useState<string | null>(
    null,
  );
  const [activeSidebarTab, setActiveSidebarTab] =
    useState<SceneEditorSidebarTab>('palette');
  const [draggingCatalogItem, setDraggingCatalogItem] =
    useState<SceneModelCatalogItem | null>(null);
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
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
    updateSelectedTransform,
    updateSelectedTransformVector,
    removeSelectedModel,
  } = useSelectedSceneObjectEditor({
    sceneInfo,
    setSceneInfo,
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
    const sceneFileUrl = getSceneFileUrlByRegionId(regionId);

    const loadScene = async () => {
      try {
        const res = await fetch(sceneFileUrl, { cache: 'no-store' });
        const data: SavedSceneInfo = await res.json();

        if (!isMounted) {
          return;
        }

        setSceneInfo(data);
        setSavedSceneSnapshot(createSceneSnapshot(data));
      } catch (error) {
        console.error('Failed to load scene editor data.', error);
      }
    };

    clearSelectedModel();
    resetTransformMode();
    setDraggingCatalogItem(null);
    setSceneInfo(null);
    setSavedSceneSnapshot(null);
    void loadScene();

    return () => {
      isMounted = false;
    };
  }, [clearSelectedModel, regionId, resetTransformMode]);

  useEffect(() => {
    return () => {
      clearSelectedModel();
      resetTransformMode();
    };
  }, [clearSelectedModel, resetTransformMode]);

  useEffect(() => {
    if (!selectedModelId) {
      return;
    }

    setActiveSidebarTab('inspector');
  }, [selectedModelId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' || !selectedModelId) {
        return;
      }

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

      event.preventDefault();
      removeSelectedModel();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [removeSelectedModel, selectedModelId]);

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

      setSceneInfo(savedSceneInfo);
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
  }, [isSaving, regionId, sceneInfo]);

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

    setSceneInfo((prev) => {
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

  return (
    <div className="bg-muted/20 flex h-full min-h-0 w-full gap-3 overflow-hidden p-3">
      <aside className="flex w-[22rem] shrink-0 flex-col gap-3">
        <SceneEditorSidebarTabs
          activeTab={activeSidebarTab}
          onTabChange={setActiveSidebarTab}
        />
        <div className="min-h-0 flex-1">
          {activeSidebarTab === 'palette' ? (
            <SceneModelPalette
              items={sceneModelCatalog}
              draggingItemId={draggingCatalogItem?.id ?? null}
              onDragStart={setDraggingCatalogItem}
              onDragEnd={() => {
                setDraggingCatalogItem(null);
              }}
              onSave={() => {
                void saveCurrentScene();
              }}
              onExport={() => {
                downloadSceneInfo(regionId, sceneInfo);
              }}
              saveDisabled={!sceneInfo}
              exportDisabled={!sceneInfo}
              isSaving={isSaving}
            />
          ) : (
            <SceneObjectInspector
              selectedModel={selectedModel}
              onTransformChange={updateSelectedTransform}
            />
          )}
        </div>
      </aside>

      <div className="relative min-w-0 flex-1">
        <SceneObjectsEditCanvas
          rootRef={canvasRootRef}
          sceneInfo={sceneInfo}
          transformMode={transformMode}
          draggingModelCatalogItem={draggingCatalogItem}
          onTransformVectorChange={updateSelectedTransformVector}
          onAddModel={handleAddModel}
        />
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2">
          <div className="pointer-events-auto">
            <SceneTransformModeToggle
              mode={transformMode}
              onModeChange={setTransformMode}
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
