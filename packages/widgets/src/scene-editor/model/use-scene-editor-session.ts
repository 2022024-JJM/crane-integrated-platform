import {
  type SavedCameraInfo,
  type SceneModelCatalogItem,
} from '@crane/domain/3d';
import {
  useSelectedSceneObjectEditor,
  useSceneObjectSelectionStore,
  useSceneTransformModeStore,
  type SelectedObjectType,
} from '@crane/features/3d';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSceneHistory } from './use-scene-history';
import { useScenePersistence } from './use-scene-persistence';
import { useSceneUnsavedChangesGuard } from './use-scene-unsaved-changes-guard';
import { createSceneManipulationActions } from './scene-manipulation-actions';

interface UseSceneEditorSessionParams {
  regionId: string;
}

interface UseSceneEditorSessionResult {
  sceneInfo: ReturnType<typeof useSceneHistory>['sceneInfo'];
  selectedModelId: string | null;
  selectedObjectType: SelectedObjectType | null;
  selectedModelLabel: string | null;
  selectedModel: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['selectedModel'];
  selectedText: ReturnType<typeof useSelectedSceneObjectEditor>['selectedText'];
  isSaving: boolean;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  transformMode: ReturnType<typeof useSceneTransformModeStore.getState>['mode'];
  undo: () => void;
  redo: () => void;
  setTransformMode: ReturnType<
    typeof useSceneTransformModeStore.getState
  >['setMode'];
  saveCurrentScene: () => Promise<boolean>;
  updateSelectedName: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedName'];
  updateSelectedOpacity: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedOpacity'];
  updateSelectedTransform: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedTransform'];
  updateSelectedTransformVector: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedTransformVector'];
  updateSelectedTextContent: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedTextContent'];
  updateSelectedTextColor: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedTextColor'];
  updateSelectedTextTransform: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedTextTransform'];
  updateSelectedTextTransformVector: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedTextTransformVector'];
  removeSelectedModel: () => void;
  addModel: (
    catalogItem: SceneModelCatalogItem,
    position: [number, number, number],
  ) => void;
  addText: (position: [number, number, number]) => void;
  selectPlacedModel: (id: string) => void;
  selectPlacedText: (id: string) => void;
  deletePlacedModel: (id: string) => void;
  deletePlacedText: (id: string) => void;
  deleteMap: () => void;
  startTransformInteraction: () => void;
  endTransformInteraction: () => void;
  cameraStateRef: React.RefObject<SavedCameraInfo | null>;
  initialCamera: SavedCameraInfo | null;
}

export function useSceneEditorSession({
  regionId,
}: UseSceneEditorSessionParams): UseSceneEditorSessionResult {
  const sceneInfoRef = useRef<import('@crane/domain/3d').SavedSceneInfo | null>(
    null,
  );
  const transformHistoryBaseRef = useRef(null);
  const cameraStateRef = useRef<SavedCameraInfo | null>(null);
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
  const selectedObjectType = useSceneObjectSelectionStore(
    (state) => state.selectedObjectType,
  );
  const clearSelectedModel = useSceneObjectSelectionStore(
    (state) => state.clearSelectedModel,
  );
  const selectModel = useSceneObjectSelectionStore(
    (state) => state.selectModel,
  );
  const selectText = useSceneObjectSelectionStore((state) => state.selectText);
  const transformMode = useSceneTransformModeStore((state) => state.mode);
  const setTransformMode = useSceneTransformModeStore((state) => state.setMode);
  const resetTransformMode = useSceneTransformModeStore(
    (state) => state.resetMode,
  );
  const {
    selectedModel,
    selectedText,
    updateSelectedName,
    updateSelectedOpacity,
    updateSelectedTransform,
    updateSelectedTransformVector,
    updateSelectedTextContent,
    updateSelectedTextColor,
    updateSelectedTextTransform,
    updateSelectedTextTransformVector,
    removeSelectedModel,
  } = useSelectedSceneObjectEditor({
    sceneInfo,
    updateSceneInfo: updateScene,
  });

  const onLoadReset = useCallback(() => {
    clearSelectedModel();
    resetTransformMode();
  }, [clearSelectedModel, resetTransformMode]);

  sceneInfoRef.current = sceneInfo;

  const getCameraState = useCallback(() => cameraStateRef.current, []);

  const { isDirty, isSaving, initialCamera, saveCurrentScene } =
    useScenePersistence({
      regionId,
      sceneInfo,
      replaceScene,
      updateScene,
      onLoadReset,
      getCameraState,
    });

  const manipulation = useMemo(
    () =>
      createSceneManipulationActions({
        updateScene,
        commitHistoryFrom,
        selectModel,
        selectText,
        clearSelectedModel,
        selectedModelId,
        sceneInfoRef,
        transformHistoryBaseRef,
      }),
    [
      updateScene,
      commitHistoryFrom,
      selectModel,
      selectText,
      clearSelectedModel,
      selectedModelId,
    ],
  );

  useEffect(() => {
    return () => {
      clearSelectedModel();
      resetTransformMode();
    };
  }, [clearSelectedModel, resetTransformMode]);

  useSceneUnsavedChangesGuard({
    isDirty,
    isSaving,
    onSave: saveCurrentScene,
  });

  return {
    sceneInfo,
    selectedModelId,
    selectedObjectType,
    selectedModelLabel:
      selectedModel?.equipName.trim() || selectedText?.content.trim() || null,
    selectedModel,
    selectedText,
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
    updateSelectedTextContent,
    updateSelectedTextColor,
    updateSelectedTextTransform,
    updateSelectedTextTransformVector,
    removeSelectedModel,
    addModel: manipulation.addModel,
    addText: manipulation.addText,
    selectPlacedModel: manipulation.selectPlacedModel,
    selectPlacedText: manipulation.selectPlacedText,
    deletePlacedModel: manipulation.deletePlacedModel,
    deletePlacedText: manipulation.deletePlacedText,
    deleteMap: manipulation.deleteMap,
    startTransformInteraction: manipulation.startTransformInteraction,
    endTransformInteraction: manipulation.endTransformInteraction,
    cameraStateRef,
    initialCamera,
  };
}
