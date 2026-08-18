import {
  humanizeModelPath,
  type SavedCameraInfo,
  type SceneMapCatalogItem,
  type SceneModelCatalogItem,
  type ValueMapType,
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
  selectedIds: Set<string>;
  selectedModelId: string | null;
  selectedObjectType: SelectedObjectType | null;
  selectedModelLabel: string | null;
  selectedModel: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['selectedModel'];
  selectedText: ReturnType<typeof useSelectedSceneObjectEditor>['selectedText'];
  selectedMesh: ReturnType<typeof useSelectedSceneObjectEditor>['selectedMesh'];
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
  renameObject: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['renameObject'];
  updateSelectedOpacity: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedOpacity'];
  updateSelectedTransform: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedTransform'];
  updateSelectedTransformVector: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedTransformVector'];
  commitSelectedTransform: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['commitSelectedTransform'];
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
  updateSelectedMeshTransform: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedMeshTransform'];
  updateSelectedMeshTransformVector: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedMeshTransformVector'];
  updateSelectedMeshOpacity: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedMeshOpacity'];
  updateSelectedValueMap: (type: ValueMapType, key: string, scale?: number, offset?: number) => void;
  removeSelectedModel: () => void;
  duplicateSelectedObject: () => void;
  addModel: (
    catalogItem: SceneModelCatalogItem,
    position: [number, number, number],
  ) => void;
  addText: (position: [number, number, number]) => void;
  selectPlacedModel: (id: string) => void;
  selectPlacedText: (id: string) => void;
  deletePlacedModel: (id: string) => void;
  deletePlacedText: (id: string) => void;
  setSceneMap: (catalogItem: SceneMapCatalogItem | null) => void;
  selectPlacedMap: (id: string) => void;
  setEnvironmentId: (environmentId: string | null) => void;
  selectedMap: ReturnType<typeof useSelectedSceneObjectEditor>['selectedMap'];
  updateSelectedMapTransform: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedMapTransform'];
  updateSelectedMapTransformVector: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateSelectedMapTransformVector'];
  commitSelectedMapTransform: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['commitSelectedMapTransform'];
  setObjectLocked: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['setObjectLocked'];
  toggleModel: (id: string) => void;
  toggleText: (id: string) => void;
  selectAll: (ids: string[]) => void;
  updateMultiObjectTransforms: ReturnType<
    typeof useSelectedSceneObjectEditor
  >['updateMultiObjectTransforms'];
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
  const selectedIds = useSceneObjectSelectionStore(
    (state) => state.selectedIds,
  );
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
  const selectMap = useSceneObjectSelectionStore((state) => state.selectMap);
  const toggleModel = useSceneObjectSelectionStore(
    (state) => state.toggleModel,
  );
  const toggleText = useSceneObjectSelectionStore((state) => state.toggleText);
  const selectAllStore = useSceneObjectSelectionStore(
    (state) => state.selectAll,
  );
  const transformMode = useSceneTransformModeStore((state) => state.mode);
  const setTransformMode = useSceneTransformModeStore((state) => state.setMode);
  const resetTransformMode = useSceneTransformModeStore(
    (state) => state.resetMode,
  );
  const {
    selectedModel,
    selectedText,
    selectedMesh,
    renameObject,
    updateSelectedOpacity,
    updateSelectedTransform,
    updateSelectedTransformVector,
    commitSelectedTransform,
    updateSelectedMeshTransform,
    updateSelectedMeshTransformVector,
    updateSelectedMeshOpacity,
    updateSelectedTextContent,
    updateSelectedTextColor,
    updateSelectedTextTransform,
    updateSelectedTextTransformVector,
    updateMultiObjectTransforms,
    updateSelectedValueMap,
    selectedMap,
    updateSelectedMapTransform,
    updateSelectedMapTransformVector,
    commitSelectedMapTransform,
    setObjectLocked,
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
        selectMap,
        clearSelectedModel,
        selectedIds,
        sceneInfoRef,
        selectAll: selectAllStore,
        transformHistoryBaseRef,
      }),
    [
      updateScene,
      commitHistoryFrom,
      selectModel,
      selectText,
      selectMap,
      clearSelectedModel,
      selectedIds,
      selectAllStore,
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
    selectedIds,
    selectedModelId,
    selectedObjectType,
    selectedModelLabel:
      selectedModel?.equipName.trim() ||
      selectedText?.content.trim() ||
      (selectedMap ? humanizeModelPath(selectedMap.path) : null) ||
      null,
    selectedModel,
    selectedText,
    selectedMesh,
    isSaving,
    isDirty,
    canUndo,
    canRedo,
    transformMode,
    undo,
    redo,
    setTransformMode,
    saveCurrentScene,
    renameObject,
    updateSelectedOpacity,
    updateSelectedTransform,
    updateSelectedTransformVector,
    commitSelectedTransform,
    updateSelectedTextContent,
    updateSelectedTextColor,
    updateSelectedTextTransform,
    updateSelectedTextTransformVector,
    updateSelectedMeshTransform,
    updateSelectedMeshTransformVector,
    updateSelectedMeshOpacity,
    updateSelectedValueMap,
    removeSelectedModel,
    updateMultiObjectTransforms,
    duplicateSelectedObject: manipulation.duplicateSelectedObject,
    addModel: manipulation.addModel,
    addText: manipulation.addText,
    selectPlacedModel: manipulation.selectPlacedModel,
    selectPlacedText: manipulation.selectPlacedText,
    deletePlacedModel: manipulation.deletePlacedModel,
    deletePlacedText: manipulation.deletePlacedText,
    setSceneMap: manipulation.setSceneMap,
    selectPlacedMap: manipulation.selectPlacedMap,
    setEnvironmentId: manipulation.setEnvironmentId,
    selectedMap,
    updateSelectedMapTransform,
    updateSelectedMapTransformVector,
    commitSelectedMapTransform,
    setObjectLocked,
    toggleModel,
    toggleText,
    selectAll: selectAllStore,
    startTransformInteraction: manipulation.startTransformInteraction,
    endTransformInteraction: manipulation.endTransformInteraction,
    cameraStateRef,
    initialCamera,
  };
}
