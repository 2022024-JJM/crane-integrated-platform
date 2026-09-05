import {
  SCENE_MODEL_CATEGORIES,
  sceneModelCatalog,
  type SavedLightingInfo,
  type SavedMapInfo,
  type SavedSceneInfo,
  type SceneMapCatalogItem,
  type SceneModelCategory,
  type SceneModelCatalogItem,
} from '@crane/domain/3d';
import {
  useSceneEditorViewStore,
  useTagBindingSource,
  useVirtualTagStore,
  type SceneTransformMode,
} from '@crane/features/3d';
import { Images, Search } from 'lucide-react';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useFullscreen } from '@crane/core/lib/use-fullscreen';
import { cn } from '@crane/core/lib/utils';
import { Input } from '@crane/ui/atoms/input';
import { AppToaster } from '@crane/ui/organisms/app-toaster';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@crane/ui/molecules/resizable';
import { PortalContainerProvider } from '@crane/ui/molecules/portal-container';
import { SCENE_EDITOR_TOASTER_ID } from '../lib/editor-toast';
import { useSceneEditorSession } from '../model/use-scene-editor-session';
import { EditorHeaderBar } from './editor-header-bar';
import { EditorSelectionBar } from './editor-selection-bar';
import { SceneShortcutsHelp } from './scene-shortcuts-help';
import { SceneUnsavedChangesDialog } from './scene-unsaved-changes-dialog';
import {
  PaletteAssetGrid,
  PaletteEnvironmentSection,
  PaletteHeader,
  PaletteMapSection,
  PalettePlacedObjects,
  PaletteVirtualTagSection,
  PreviewThumbnailGeneratorPanel,
  SceneObjectInspector,
  SceneObjectsEditCanvas,
  type SceneEditorCameraActions,
} from '@crane/widgets/3d';

interface SceneObjectsEditPageProps {
  regionId: string;
}

/**
 * 도구 모음의 모달 도구 단축키(Unity·Unreal 계열). 헤더 바 툴팁과 단축키
 * 도움말에 같은 키가 병기된다 — 바꾸면 세 곳을 함께 맞춘다.
 */
const TRANSFORM_MODE_BY_KEY_CODE: Record<string, SceneTransformMode> = {
  KeyW: 'translate',
  KeyE: 'rotate',
  KeyR: 'scale',
};

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

export function SceneObjectsEditPage({ regionId }: SceneObjectsEditPageProps) {
  const { t } = useTranslation();
  const [draggingCatalogItem, setDraggingCatalogItem] =
    useState<SceneModelCatalogItem | null>(null);
  // 패널 접힘은 세션 상태다 — 새로고침하면 다시 펼쳐진다. 접힌 쪽은 컬럼
  // 자체를 렌더하지 않아 캔버스 패널이 그만큼 넓어진다. 접기/펼치기는 헤더
  // 바 양끝의 고정 토글이 맡는다. 드래그로 조절한 패널 너비도 마찬가지로 세션
  // 상태다 — 접었다 펴면 기본 너비로 돌아온다.
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
  // 전체화면 루트는 페이지 루트 — 패널·헤더 바까지 함께 올린다. 그 안의
  // 포털(툴팁·팝오버·셀렉트·다이얼로그)은 PortalContainerProvider 로
  // 루트 안에 렌더해야 전체화면 top layer 에 가려지지 않는다. sonner 는
  // 포털이 아니라 이 Provider 가 못 잡는다 — 루트 안에 두 번째 Toaster 를
  // 두고 전체화면 중 토스트만 그쪽으로 보낸다(lib/editor-toast.ts).
  const {
    rootRef: pageRootRef,
    isFullscreen,
    supported: fullscreenSupported,
    toggleFullscreen,
  } = useFullscreen<HTMLDivElement>();
  const focusSelectedRef = useRef<(() => void) | null>(null);
  const cameraActionsRef = useRef<SceneEditorCameraActions | null>(null);
  const snapEnabled = useSceneEditorViewStore((state) => state.snapEnabled);
  const snapStep = useSceneEditorViewStore((state) => state.snapStep);
  const setSnapStep = useSceneEditorViewStore((state) => state.setSnapStep);
  const transformSpace = useSceneEditorViewStore(
    (state) => state.transformSpace,
  );
  const showGrid = useSceneEditorViewStore((state) => state.showGrid);
  const toggleSnap = useSceneEditorViewStore((state) => state.toggleSnap);
  const setTransformSpace = useSceneEditorViewStore(
    (state) => state.setTransformSpace,
  );
  const toggleGrid = useSceneEditorViewStore((state) => state.toggleGrid);
  // 계층 패널(추가된 객체 리스트) 루트 — 행이 div[role=button]이라 클릭하면
  // 포커스가 여기로 오는데, 이때도 F/Delete가 먹어야 한다.
  const hierarchyRootRef = useRef<HTMLDivElement | null>(null);
  const {
    sceneInfo,
    selectedIds,
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
    renameObject,
    updateSelectedOpacity,
    updateSelectedLabelHidden,
    updateSelectedTransform,
    updateSelectedTransformVector,
    commitSelectedTransform,
    updateSelectedTextContent,
    updateSelectedTextColor,
    selectedText,
    selectedMesh,
    updateSelectedTagMappings,
    createRigForSelectedModel,
    assignRigToSelectedModel,
    updateRig,
    removeRig,
    selectPlacedNode,
    removeSelectedModel,
    duplicateSelectedObject,
    addModel,
    addText,
    selectPlacedModel,
    deletePlacedModel,
    selectPlacedText,
    deletePlacedText,
    deletePlacedMap,
    setSceneMap,
    selectPlacedMap,
    setEnvironmentId,
    setLighting,
    selectedMap,
    setObjectLocked,
    toggleModel,
    toggleText,
    toggleMap,
    selectAll,
    updateMultiObjectTransforms,
    startTransformInteraction,
    endTransformInteraction,
    cameraStateRef,
    initialCamera,
    unsavedChangesPrompt,
  } = useSceneEditorSession({
    regionId,
  });

  // 인스펙터 리깅 탭 콜백 묶음 — 세션 액션은 렌더마다 새 함수라 useMemo 로
  // 묶어도 참조가 유지되지 않으므로 그냥 객체를 만든다(탭 존재 여부만 게이트).
  const riggingHandlers = {
    rigs: sceneInfo?.rigs ?? [],
    onCreateRig: createRigForSelectedModel,
    onAssignRig: assignRigToSelectedModel,
    onUpdateRig: updateRig,
    onRemoveRig: removeRig,
  };
  const tagMappingHandlers = {
    rigs: sceneInfo?.rigs ?? [],
    onUpdate: updateSelectedTagMappings,
  };

  // 가상 태그 시뮬레이션 — 팔레트 "태그" 탭의 재생 토글이 켠다. 바인딩(버스 →
  // 씬 맵핑 → 값 저장소)은 모니터링 뷰처럼 화면이 떠 있는 동안 항상 켜 둔다.
  // 일시정지는 러너 틱만 멈춰 노드가 마지막 값에서 그대로 서고, 초기값 복귀는
  // 탭의 리셋 버튼(virtualTagRuntime.resetValues)이 맡는다. 예전엔 토글에
  // 바인딩 on/off 를 물려 정지할 때마다 rest 로 튀었다. 화면을 떠날 때는
  // 재생을 멈추고 바인딩 cleanup 이 값 저장소를 비운다.
  const pauseSimulation = useVirtualTagStore((s) => s.pause);
  useTagBindingSource(sceneInfo, true);
  useEffect(() => () => pauseSimulation(), [pauseSimulation]);
  // 관리 페이지는 편집 화면의 형제 서브라우트(…/virtual-tags).
  const { pathname } = useLocation();
  const virtualTagsPath = pathname.replace(
    /\/3d-viewer-edit(?:\/.*)?$/,
    '/virtual-tags',
  );

  // 계층 목록의 관절 배지용 — 모델별 관절 노드 경로 집합.
  const jointNodePathsByModel = useMemo(() => {
    const out = new Map<string, Set<string>>();
    const rigsById = new Map((sceneInfo?.rigs ?? []).map((r) => [r.id, r]));
    for (const model of sceneInfo?.models ?? []) {
      const rig = model.rigId ? rigsById.get(model.rigId) : undefined;
      if (!rig) continue;
      // 선형 연동의 출력도 관절이라 joints 만 훑으면 구동 노드 전부가 나온다.
      const paths = new Set<string>();
      for (const joint of rig.joints) paths.add(joint.node);
      out.set(model.id, paths);
    }
    return out;
  }, [sceneInfo?.models, sceneInfo?.rigs]);

  // 키보드 핸들러에서 최신 값을 클로저 없이 읽기 위한 ref.
  // sceneInfo, selectedIds는 자주 변경되므로 의존성 배열에 넣으면 리스너가
  // 매 수정마다 재등록된다. ref로 추적해 리스너를 1회만 등록한다.
  const sceneInfoRef = useRef(sceneInfo);
  const selectedIdsRef = useRef(selectedIds);

  useEffect(() => {
    sceneInfoRef.current = sceneInfo;
    selectedIdsRef.current = selectedIds;
  }, [sceneInfo, selectedIds]);

  useEffect(() => {
    startTransition(() => {
      setDraggingCatalogItem(null);
    });
  }, [regionId]);

  const saveDisabled = !sceneInfo;
  // 텍스트는 드래그 앤 드롭이 아니라 툴바 버튼으로 추가한다. 버튼에는 드롭
  // 좌표가 없으므로 카메라 orbit target(화면 중앙이 바라보는 지점)에 놓는다.
  const handleAddTextAtView = () => {
    if (!sceneInfo) {
      return;
    }
    const target = cameraStateRef.current?.target;
    addText(target ? [target[0], target[1], target[2]] : [0, 0, 0]);
  };
  // 크기 모드는 three TransformControls 가 축 기준을 local 로 강제한다 —
  // 토글을 잠그고 표시도 local 로 맞춘다.
  const isScaleMode = transformMode === 'scale';
  const hasSelection = selectedIds.size > 0;

  useEffect(() => {
    // 키 판정은 전부 event.code(물리 키)로 한다 — event.key는 한글 입력
    // 모드에서 'ㄹ'/'Process'가 와서 한/영 상태에 따라 단축키가 죽는다.
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd+S는 캔버스 포커스 검사보다 먼저 처리한다. 아래 게이트에
      // 걸리면 브라우저의 "페이지 저장" 대화상자가 그대로 뜨는데, 인스펙터에
      // 값을 입력한 직후(=포커스가 패널에 있을 때)가 사용자가 저장을 누르는
      // 바로 그 순간이라 가장 잘 터진다. 입력 중에도 저장은 유효한 동작이므로
      // isEditableTarget도 통과시킨다.
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS') {
        event.preventDefault();
        if (!saveDisabled && !isSaving) {
          void saveCurrentScene();
        }
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      /**
       * 단축키를 두 부류로 나눈다.
       *
       * - **수식키 조합**(Ctrl/Cmd+Z 등): 에디터 어디서든 동작한다. 예전에는
       *   캔버스에 포커스가 있을 때만 먹어서, 인스펙터를 한 번 클릭하면
       *   undo/redo까지 죽었다 — 값을 고친 직후가 되돌리고 싶은 순간인데
       *   바로 그때 안 되는 셈이었다.
       * - **맨 키**(Delete, F): 캔버스 또는 계층 패널(객체 리스트)에
       *   포커스가 있을 때만. 인스펙터의 버튼을 조작하다 Delete를 누르면
       *   객체가 지워지는 사고가 난다. 이쪽은 제약을 유지하는 게 맞다.
       *
       * 텍스트 입력 중(isEditableTarget)은 위에서 이미 걸렀다.
       */
      const hasModifier = event.ctrlKey || event.metaKey;

      const isUndoShortcut = hasModifier && event.code === 'KeyZ';
      const isRedoShortcut = hasModifier && event.code === 'KeyY';

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

      const isDuplicateShortcut = hasModifier && event.code === 'KeyD';

      if (isDuplicateShortcut) {
        event.preventDefault();
        duplicateSelectedObject();
        return;
      }

      const isSelectAllShortcut = hasModifier && event.code === 'KeyA';

      const currentSceneInfo = sceneInfoRef.current;
      if (isSelectAllShortcut && currentSceneInfo) {
        event.preventDefault();
        // 잠긴 객체는 전체 선택에서도 제외한다 — 잠금은 "편집 대상에서
        // 제외"라는 하나의 규칙이다(마퀴·클릭 선택과 동일). 지도는 반전
        // 기본값(필드 없음 = 잠김)이라 locked === false 명시 비교.
        const allEntries = [
          ...currentSceneInfo.models
            .filter((m) => !m.locked)
            .map((m) => ({ id: m.id, type: 'model' as const })),
          ...(currentSceneInfo.texts ?? [])
            .filter((t) => !t.locked)
            .map((t) => ({ id: t.id, type: 'text' as const })),
          ...(currentSceneInfo.maps ?? [])
            .filter((m) => m.locked === false)
            .map((m) => ({ id: m.id, type: 'map' as const })),
        ];
        selectAll(allEntries);
        return;
      }

      // 여기서부터는 맨 키 단축키다 — 캔버스 또는 계층 패널에 포커스가
      // 있을 때만 처리한다. 인스펙터 버튼을 조작하다 Delete를 눌러 객체가
      // 사라지면 안 된다. 계층 패널의 검색·이름 변경 입력은 위의
      // isEditableTarget이 이미 걸렀다.
      const activeElement = document.activeElement;
      const isInside = (root: HTMLElement | null) =>
        root !== null &&
        activeElement instanceof Node &&
        root.contains(activeElement);
      if (
        !isInside(canvasRootRef.current) &&
        !isInside(hierarchyRootRef.current)
      ) {
        return;
      }

      // W/E/R = 이동/회전/크기(Unity·Unreal 계열). 선택이 없어도 모드는
      // 바뀐다 — 다음 선택에 바로 적용되는 게 자연스럽다.
      const nextMode = TRANSFORM_MODE_BY_KEY_CODE[event.code];
      if (nextMode) {
        event.preventDefault();
        setTransformMode(nextMode);
        return;
      }

      const currentSelectedIds = selectedIdsRef.current;
      // F = 선택 객체로 카메라 이동(Unity·Unreal·three.js editor 공통 관례).
      if (event.code === 'KeyF' && currentSelectedIds.size > 0) {
        event.preventDefault();
        focusSelectedRef.current?.();
        return;
      }

      if (event.code !== 'Delete' || currentSelectedIds.size === 0) {
        return;
      }

      event.preventDefault();
      removeSelectedModel();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    duplicateSelectedObject,
    isSaving,
    redo,
    removeSelectedModel,
    saveCurrentScene,
    saveDisabled,
    selectAll,
    setTransformMode,
    undo,
  ]);

  return (
    <PortalContainerProvider container={pageRootRef}>
      <div
        ref={pageRootRef}
        className="bg-muted/20 h-full min-h-0 w-full overflow-hidden"
      >
        <AppToaster id={SCENE_EDITOR_TOASTER_ID} />
        <SceneUnsavedChangesDialog
          open={unsavedChangesPrompt.open}
          isSaving={isSaving}
          onSaveAndLeave={() => unsavedChangesPrompt.choose('save')}
          onLeaveWithoutSaving={() => unsavedChangesPrompt.choose('discard')}
          onStay={() => unsavedChangesPrompt.choose('stay')}
        />
        <ResizablePanelGroup orientation="horizontal">
          {/* 좌측 도킹 패널 — Project: 에셋 팔레트(모델/맵/배경).
            preserve-pixel-size: 창 크기가 바뀌어도 사이드 패널은 픽셀 너비를
            유지하고 캔버스만 늘어난다. 컬럼 경계선은 aside border 대신
            ResizableHandle(1px)이 겸한다. */}
          {!leftCollapsed ? (
            <>
              <ResizablePanel
                id="project-palette"
                defaultSize="13rem"
                minSize="10rem"
                maxSize="22rem"
                groupResizeBehavior="preserve-pixel-size"
              >
                <aside className="bg-card text-card-foreground flex h-full min-h-0 flex-col">
                  <ProjectPalettePanel
                    items={sceneModelCatalog}
                    currentMap={sceneInfo?.maps?.[0] ?? null}
                    draggingItemId={draggingCatalogItem?.id ?? null}
                    onDragStart={setDraggingCatalogItem}
                    onDragEnd={() => setDraggingCatalogItem(null)}
                    onSelectMap={setSceneMap}
                    onToggleLock={setObjectLocked}
                    environmentId={sceneInfo?.environmentId}
                    onEnvironmentChange={setEnvironmentId}
                    lighting={sceneInfo?.lighting}
                    onLightingChange={setLighting}
                    onLightingInteractionStart={startTransformInteraction}
                    onLightingInteractionEnd={endTransformInteraction}
                    sceneInfo={sceneInfo}
                    virtualTagsPath={virtualTagsPath}
                  />
                </aside>
              </ResizablePanel>
              <ResizableHandle />
            </>
          ) : null}

          {/* 중앙 캔버스 — 패널이 캔버스를 덮지 않는 도킹 워크벤치 구조.
            뷰포트 위 헤더 바는 캔버스 바깥의 크롬이고, 뷰포트 안에는 선택
            컨텍스트 바(하단 중앙)·도움말(우하단)·축 기즈모(우상단)만 띄운다. 뷰포트 중앙 상단은 가장 중요한 시야라
            어떤 UI 도 두지 않는다. */}
          <ResizablePanel id="edit-canvas">
            <div className="flex h-full min-h-0 flex-col">
              <EditorHeaderBar
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                saveDisabled={saveDisabled}
                isSaving={isSaving}
                isDirty={isDirty}
                onSave={() => void saveCurrentScene()}
                onExport={() => downloadSceneInfo(regionId, sceneInfo)}
                mode={transformMode}
                onModeChange={setTransformMode}
                onAddText={handleAddTextAtView}
                transformSpace={isScaleMode ? 'local' : transformSpace}
                onTransformSpaceChange={setTransformSpace}
                transformSpaceDisabled={isScaleMode}
                snapEnabled={snapEnabled}
                snapStep={snapStep}
                onToggleSnap={toggleSnap}
                onSnapStepChange={setSnapStep}
                showGrid={showGrid}
                onToggleGrid={toggleGrid}
                onResetView={() => cameraActionsRef.current?.resetView()}
                onTopView={() => cameraActionsRef.current?.topView()}
                sceneDisabled={saveDisabled}
                leftPanelCollapsed={leftCollapsed}
                onToggleLeftPanel={() => setLeftCollapsed((v) => !v)}
                rightPanelCollapsed={rightCollapsed}
                onToggleRightPanel={() => setRightCollapsed((v) => !v)}
                isFullscreen={isFullscreen}
                fullscreenSupported={fullscreenSupported}
                onToggleFullscreen={toggleFullscreen}
              />
              <div className="relative min-h-0 flex-1">
                <SceneObjectsEditCanvas
                  rootRef={canvasRootRef}
                  cameraStateRef={cameraStateRef}
                  initialCamera={initialCamera}
                  sceneInfo={sceneInfo}
                  regionId={regionId}
                  catalogItems={sceneModelCatalog}
                  transformMode={transformMode}
                  draggingModelCatalogItem={draggingCatalogItem}
                  onTransformVectorChange={(field, value) => {
                    // 모델/텍스트/지도는 통합 함수가 id로 컬렉션을 해석한다.
                    // 모델 안쪽 노드는 읽기 전용이라 기즈모가 붙지 않는다.
                    updateSelectedTransformVector(field, value, {
                      recordHistory: false,
                    });
                  }}
                  onTransformCommit={(position, rotation, scale) => {
                    // 드래그 완료 시 position/rotation/scale을 단일 updateSceneInfo로
                    // commit해 중간 렌더를 없애고 selectedObject 리셋 버그를 방지한다.
                    commitSelectedTransform(position, rotation, scale, {
                      recordHistory: false,
                    });
                  }}
                  onMultiTransformCommit={(updates) => {
                    updateMultiObjectTransforms(updates, {
                      recordHistory: false,
                    });
                  }}
                  onAddModel={(catalogItem, position) => {
                    addModel(catalogItem, position);
                    setDraggingCatalogItem(null);
                  }}
                  onTransformInteractionStart={startTransformInteraction}
                  onTransformInteractionEnd={endTransformInteraction}
                  focusSelectedRef={focusSelectedRef}
                  cameraActionsRef={cameraActionsRef}
                  snapEnabled={snapEnabled}
                  snapStep={snapStep}
                  transformSpace={transformSpace}
                  showGrid={showGrid}
                />

                <EditorSelectionBar
                  hasSelection={hasSelection}
                  onDuplicate={duplicateSelectedObject}
                  onDelete={removeSelectedModel}
                />
                {/* 우측 하단 단축키 도움말 — 선택 컨텍스트 바는 하단 중앙이라
                  겹치지 않는다. */}
                <SceneShortcutsHelp />

                {!sceneInfo ? (
                  <div className="bg-background/75 absolute inset-0 flex items-center justify-center backdrop-blur-sm">
                    <p className="text-muted-foreground text-sm font-medium">
                      {t('monitoring:editor.loading')}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </ResizablePanel>

          {/* 우측 도킹 컬럼 — 상단 Hierarchy(1) + 하단 Inspector(2) */}
          {!rightCollapsed ? (
            <>
              <ResizableHandle />
              <ResizablePanel
                id="hierarchy-inspector"
                defaultSize="18rem"
                minSize="14rem"
                maxSize="26rem"
                groupResizeBehavior="preserve-pixel-size"
              >
                <aside className="bg-card text-card-foreground flex h-full min-h-0 flex-col">
                  {/* Hierarchy/Inspector 사이도 드래그로 조절한다. 기본 1:2는
                    종전 flex-[1]/flex-[2] 비율 그대로. 경계선은 border-t 대신
                    ResizableHandle(1px)이 겸한다. */}
                  <ResizablePanelGroup orientation="vertical">
                    <ResizablePanel
                      id="hierarchy"
                      defaultSize="33%"
                      minSize="8rem"
                    >
                      <div
                        ref={hierarchyRootRef}
                        className="flex h-full min-h-0 flex-col"
                      >
                        <HierarchyPanel
                          sceneInfo={sceneInfo}
                          selectedIds={selectedIds}
                          onSelectPlacedModel={selectPlacedModel}
                          onDeletePlacedModel={deletePlacedModel}
                          onSelectPlacedText={selectPlacedText}
                          onDeletePlacedText={deletePlacedText}
                          onTogglePlacedModel={toggleModel}
                          onTogglePlacedText={toggleText}
                          onTogglePlacedMap={toggleMap}
                          onSelectPlacedMap={selectPlacedMap}
                          onDeletePlacedMap={deletePlacedMap}
                          onToggleLock={setObjectLocked}
                          onRenameObject={renameObject}
                          onSelectNode={selectPlacedNode}
                          jointNodePathsByModel={jointNodePathsByModel}
                        />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel id="inspector" minSize="10rem">
                      <div className="flex h-full min-h-0 flex-col">
                        <SceneObjectInspector
                          className="rounded-none bg-transparent ring-0"
                          selectedModel={selectedModel}
                          selectedText={selectedText}
                          selectedMesh={selectedMesh}
                          selectedMap={selectedMap}
                          multiSelectCount={selectedIds.size}
                          onOpacityChange={updateSelectedOpacity}
                          onLabelHiddenChange={updateSelectedLabelHidden}
                          onTransformChange={updateSelectedTransform}
                          onTextContentChange={updateSelectedTextContent}
                          onTextColorChange={updateSelectedTextColor}
                          tagMapping={tagMappingHandlers}
                          rigging={riggingHandlers}
                        />
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </aside>
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </div>
    </PortalContainerProvider>
  );
}

/**
 * 우측 상단 Hierarchy 패널 — 검색 헤더 + 배치된 객체 목록.
 * 모델 팔레트는 좌측 도킹 패널(ProjectPalettePanel)이, 저장/내보내기는
 * 뷰포트 위 헤더 바(EditorHeaderBar)가 담당한다.
 */
function HierarchyPanel({
  sceneInfo,
  selectedIds,
  onSelectPlacedModel,
  onDeletePlacedModel,
  onSelectPlacedText,
  onDeletePlacedText,
  onTogglePlacedModel,
  onTogglePlacedText,
  onTogglePlacedMap,
  onSelectPlacedMap,
  onDeletePlacedMap,
  onToggleLock,
  onRenameObject,
  onSelectNode,
  jointNodePathsByModel,
}: {
  sceneInfo: SavedSceneInfo | null;
  selectedIds: Set<string>;
  onSelectNode: (modelId: string, nodePath: string) => void;
  jointNodePathsByModel: Map<string, Set<string>>;
  onSelectPlacedMap: (id: string) => void;
  onDeletePlacedMap: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  onRenameObject: (id: string, name: string) => void;
  onSelectPlacedModel: (id: string) => void;
  onDeletePlacedModel: (id: string) => void;
  onSelectPlacedText: (id: string) => void;
  onDeletePlacedText: (id: string) => void;
  onTogglePlacedModel: (id: string) => void;
  onTogglePlacedText: (id: string) => void;
  onTogglePlacedMap: (id: string) => void;
}) {
  const [objectSearch, setObjectSearch] = useState('');

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PaletteHeader
        objectSearch={objectSearch}
        onObjectSearchChange={setObjectSearch}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <PalettePlacedObjects
          placedModels={sceneInfo?.models ?? []}
          placedTexts={sceneInfo?.texts ?? []}
          placedMaps={sceneInfo?.maps ?? []}
          objectSearch={objectSearch}
          selectedIds={selectedIds}
          onSelectPlacedModel={onSelectPlacedModel}
          onDeletePlacedModel={onDeletePlacedModel}
          onSelectPlacedText={onSelectPlacedText}
          onDeletePlacedText={onDeletePlacedText}
          onTogglePlacedModel={onTogglePlacedModel}
          onTogglePlacedText={onTogglePlacedText}
          onTogglePlacedMap={onTogglePlacedMap}
          onSelectPlacedMap={onSelectPlacedMap}
          onDeletePlacedMap={onDeletePlacedMap}
          onToggleLock={onToggleLock}
          onRenameObject={onRenameObject}
          onSelectNode={onSelectNode}
          jointNodePathsByModel={jointNodePathsByModel}
        />
      </div>
    </div>
  );
}

const DEFAULT_MODEL_CATEGORY: ModelPanelCategory = 'indoor';

/**
 * Project 패널은 상단 탭(모델/맵/배경)으로 나뉜다.
 *
 * 맵과 배경은 모델 카테고리가 아니다 — 드래그 앤 드롭으로 배치하는 에셋이
 * 아니라 씬에 하나뿐인 전역 설정(클릭 단일 선택)이라, 카테고리 목록에 섞으면
 * 카탈로그·드롭 경로까지 모델처럼 다루게 된다. 그래서 모델 탭 안의 좌측
 * 카테고리 목록에는 실제 모델 분류(내업/외업/기타)만 남기고, 맵·배경은
 * 같은 층위의 탭으로 분리한다.
 */
const PANEL_TABS = ['models', 'map', 'background', 'tags'] as const;
type PanelTab = (typeof PANEL_TABS)[number];

const PANEL_TAB_LABEL_KEY: Record<PanelTab, string> = {
  models: 'monitoring:editor.paletteTabs.models',
  map: 'monitoring:editor.paletteTabs.map',
  background: 'monitoring:editor.paletteTabs.background',
  tags: 'monitoring:editor.paletteTabs.tags',
};

// 'map' 카테고리는 카탈로그에 항목이 없고(맵은 맵 탭이 담당) 목록에
// 빈 폴더로만 남으므로 표시에서 제외한다. domain 타입은 건드리지 않는다.
type ModelPanelCategory = Exclude<SceneModelCategory, 'map'>;
const MODEL_PANEL_CATEGORIES = SCENE_MODEL_CATEGORIES.filter(
  (category): category is ModelPanelCategory => category !== 'map',
);

const MODEL_CATEGORY_LABEL_KEY: Record<ModelPanelCategory, string> = {
  indoor: 'monitoring:editor.modelCategories.indoor',
  outdoor: 'monitoring:editor.modelCategories.outdoor',
  etc: 'monitoring:editor.modelCategories.etc',
};

/**
 * 좌측 도킹 Project 팔레트 — 상단 탭(모델/맵/배경)으로 전환하는 세로 패널.
 * 모델 탭은 카테고리 칩 + 검색 + 드래그 가능한 에셋 그리드,
 * 맵·배경 탭은 클릭 단일 선택 타일 그리드다.
 */
function ProjectPalettePanel({
  items,
  currentMap,
  draggingItemId,
  onDragStart,
  onDragEnd,
  onSelectMap,
  onToggleLock,
  environmentId,
  onEnvironmentChange,
  lighting,
  onLightingChange,
  onLightingInteractionStart,
  onLightingInteractionEnd,
  sceneInfo,
  virtualTagsPath,
}: {
  items: SceneModelCatalogItem[];
  currentMap: SavedMapInfo | null;
  /** 태그 탭 — 이 씬이 참조하는 태그 목록을 뽑는다. */
  sceneInfo: SavedSceneInfo | null;
  /** 가상 태그 관리 페이지 경로. */
  virtualTagsPath: string;
  environmentId: string | null | undefined;
  onEnvironmentChange: (environmentId: string | null) => void;
  lighting: SavedLightingInfo | undefined;
  onLightingChange: (
    patch: Partial<SavedLightingInfo>,
    options?: { recordHistory?: boolean },
  ) => void;
  onLightingInteractionStart: () => void;
  onLightingInteractionEnd: () => void;
  draggingItemId: string | null;
  onDragStart: (item: SceneModelCatalogItem) => void;
  onDragEnd: () => void;
  onSelectMap: (catalogItem: SceneMapCatalogItem | null) => void;
  onToggleLock: (id: string, locked: boolean) => void;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PanelTab>('models');
  const [activeCategory, setActiveCategory] = useState<ModelPanelCategory>(
    DEFAULT_MODEL_CATEGORY,
  );
  const [assetSearch, setAssetSearch] = useState('');
  const [showThumbnailGenerator, setShowThumbnailGenerator] = useState(false);
  const categoryCounts = useMemo(() => {
    return MODEL_PANEL_CATEGORIES.reduce(
      (acc, category) => {
        acc[category] = items.filter(
          (item) => item.category === category,
        ).length;
        return acc;
      },
      {} as Record<ModelPanelCategory, number>,
    );
  }, [items]);
  const categoryItems = useMemo(() => {
    return items.filter((item) => item.category === activeCategory);
  }, [activeCategory, items]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* 탭 헤더 — 모델/맵/배경/태그 (언더라인 탭, 패널보다 넓어지면 가로
          스크롤). 접기/펼치기는 헤더 바 왼쪽 끝의 고정 토글이 맡는다.
          높이 h-9 는 캔버스 위 EditorHeaderBar·우측 PaletteHeader 와 같은
          값 — 세 컬럼 하단선을 한 줄에 맞춘다. */}
      <div className="border-border flex h-9 shrink-0 items-stretch border-b">
        <div className="flex min-w-0 flex-1 items-stretch gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PANEL_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={isActive}
                onClick={(event) => {
                  setActiveTab(tab);
                  event.currentTarget.scrollIntoView({
                    inline: 'nearest',
                    block: 'nearest',
                  });
                }}
                className={cn(
                  'flex h-full shrink-0 cursor-pointer items-center border-b-2 px-3 text-[11px] font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground border-transparent',
                )}
              >
                {t(PANEL_TAB_LABEL_KEY[tab])}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-2">
        {activeTab !== 'models' ? (
          <div className="h-full min-h-0 overflow-y-auto">
            {activeTab === 'map' ? (
              <PaletteMapSection
                currentMap={currentMap}
                onSelectMap={onSelectMap}
                onToggleLock={onToggleLock}
              />
            ) : activeTab === 'tags' ? (
              <PaletteVirtualTagSection
                sceneInfo={sceneInfo}
                managePath={virtualTagsPath}
              />
            ) : (
              <PaletteEnvironmentSection
                environmentId={environmentId}
                onChange={onEnvironmentChange}
                lighting={lighting}
                onShadowsChange={(shadows) => onLightingChange({ shadows })}
                // 드래그 중에는 recordHistory: false — 종료 시
                // onLightingInteractionEnd(endTransformInteraction)가 1회 커밋.
                onSunAngleChange={({ azimuth, elevation }) =>
                  onLightingChange(
                    { sunAzimuth: azimuth, sunElevation: elevation },
                    { recordHistory: false },
                  )
                }
                onSunDragStart={onLightingInteractionStart}
                onSunDragEnd={onLightingInteractionEnd}
              />
            )}
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            {/* 카테고리 — 좁은 세로 패널이라 사이드 목록 대신 칩 줄로 배치 */}
            <div className="flex shrink-0 flex-wrap gap-1 pb-2">
              {MODEL_PANEL_CATEGORIES.map((category) => {
                const isActive = activeCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveCategory(category)}
                    className={cn(
                      'flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition',
                      isActive
                        ? 'border-primary/30 bg-primary/12 text-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                    )}
                  >
                    {t(MODEL_CATEGORY_LABEL_KEY[category])}
                    <span
                      className={cn(
                        'text-[10px]',
                        isActive ? 'text-primary' : 'text-muted-foreground/70',
                      )}
                    >
                      {categoryCounts[category]}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mb-2 flex shrink-0 items-center gap-1.5">
              <div className="border-border bg-muted text-foreground focus-within:border-ring focus-within:ring-ring/50 flex h-7 w-full min-w-0 flex-1 items-center border px-2 transition-colors focus-within:ring-3">
                <Search className="text-muted-foreground/50 mr-2 size-3 shrink-0" />
                <Input
                  value={assetSearch}
                  onChange={(event) => {
                    setAssetSearch(event.target.value);
                  }}
                  placeholder={t('monitoring:editor.searchModels')}
                  className="placeholder:text-muted-foreground h-full flex-1 border-0 bg-transparent px-0 text-[11px] leading-none shadow-none focus:border-0 focus:ring-0"
                />
              </div>
              {/* dev 전용: 아래 모델 목록을 정적 썸네일 생성 패널로 토글한다.
                  저장 미들웨어가 dev 서버에만 있으므로 운영에는 노출하지 않는다. */}
              {import.meta.env.DEV ? (
                <button
                  type="button"
                  onClick={() => setShowThumbnailGenerator((v) => !v)}
                  aria-pressed={showThumbnailGenerator}
                  title="미리보기 썸네일 생성"
                  aria-label="미리보기 썸네일 생성"
                  className={cn(
                    'inline-flex size-7 shrink-0 cursor-pointer items-center justify-center border transition-colors',
                    showThumbnailGenerator
                      ? 'border-primary/30 bg-primary/12 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                  )}
                >
                  <Images className="size-3.5" />
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {showThumbnailGenerator ? (
                <PreviewThumbnailGeneratorPanel />
              ) : (
                <PaletteAssetGrid
                  items={categoryItems}
                  draggingItemId={draggingItemId}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  emptyMessage={t('monitoring:editor.noModelsInCategory')}
                  assetSearch={assetSearch}
                  onAssetSearchChange={setAssetSearch}
                  showToolbar={false}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
