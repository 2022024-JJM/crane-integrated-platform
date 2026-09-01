import {
  SCENE_MODEL_CATEGORIES,
  isSceneStoredLocallyOnly,
  sceneModelCatalog,
  type SavedLightingInfo,
  type SavedMapInfo,
  type SavedSceneInfo,
  type SceneMapCatalogItem,
  type SceneModelCategory,
  type SceneModelCatalogItem,
} from '@crane/domain/3d';
import {
  SceneHistoryControls,
  SceneTransformModeToggle,
} from '@crane/features/3d';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  HardDrive,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Save,
  Search,
  Type,
} from 'lucide-react';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import { Input } from '@crane/ui/atoms/input';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@crane/ui/molecules/resizable';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { useSceneEditorSession } from '../model/use-scene-editor-session';
import { SceneShortcutsHelp } from './scene-shortcuts-help';
import { SceneUnsavedChangesDialog } from './scene-unsaved-changes-dialog';
import {
  PaletteAssetGrid,
  PaletteEnvironmentSection,
  PaletteHeader,
  PaletteMapSection,
  PalettePlacedObjects,
  SceneObjectInspector,
  SceneObjectsEditCanvas,
} from '@crane/widgets/3d';

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

export function SceneObjectsEditPage({ regionId }: SceneObjectsEditPageProps) {
  const { t } = useTranslation();
  const [draggingCatalogItem, setDraggingCatalogItem] =
    useState<SceneModelCatalogItem | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  // 패널 접힘은 세션 상태다 — 새로고침하면 다시 펼쳐진다. 접힌 쪽은 컬럼
  // 자체를 렌더하지 않아 캔버스 패널이 그만큼 넓어지고, 캔버스 모서리의
  // 재오픈 버튼만 남는다. 드래그로 조절한 패널 너비도 마찬가지로 세션
  // 상태다 — 접었다 펴면 기본 너비로 돌아온다.
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
  const focusSelectedRef = useRef<(() => void) | null>(null);
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
    updateSelectedTransform,
    updateSelectedTransformVector,
    commitSelectedTransform,
    updateSelectedTextContent,
    updateSelectedTextColor,
    selectedText,
    selectedMesh,
    updateSelectedMeshTransform,
    updateSelectedMeshTransformVector,
    updateSelectedMeshOpacity,
    updateSelectedValueMap,
    selectedObjectType,
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
  // 운영 빌드에는 저장 백엔드가 없어 localStorage에만 남는다. dev(파일 저장)와
  // 똑같이 "저장됨"으로 표시하면, 사용자는 배포된 줄 알지만 실제로는 자기
  // 브라우저에만 있다 — 캐시를 지우거나 다른 PC에서 열면 사라진다.
  // "저장됨" 상태일 때만 고지한다 — 저장 전/저장 중에 띄우면 경고가 상시
  // 노출돼 무뎌지고, 정작 알려야 할 순간(방금 저장했는데 이 브라우저에만
  // 남았을 때)의 신호가 묻힌다.
  const showLocalOnlyNotice =
    isSceneStoredLocallyOnly() && !isSaving && !isDirty;
  const saveStatusLabel = isSaving
    ? t('monitoring:editor.statusSaving')
    : isDirty
      ? t('monitoring:editor.statusUnsaved')
      : showLocalOnlyNotice
        ? t('monitoring:editor.statusSavedLocalOnly')
        : t('monitoring:editor.statusSaved');
  const saveStatusClassName = isSaving
    ? 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'
    : isDirty
      ? 'border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-100'
      : showLocalOnlyNotice
        ? // 초록(=안전하게 보관됨)으로 칠하면 고지 문구와 색이 엇갈린다.
          // 중립 톤으로 "저장은 됐지만 완전하지 않다"를 색으로도 전한다.
          'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
        : 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100';

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
    undo,
  ]);

  return (
    <div className="bg-muted/20 h-full min-h-0 w-full overflow-hidden">
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
                  onCollapse={() => setLeftCollapsed(true)}
                />
              </aside>
            </ResizablePanel>
            <ResizableHandle />
          </>
        ) : null}

        {/* 중앙 캔버스 — 패널이 캔버스를 덮지 않는 도킹 워크벤치 구조 */}
        <ResizablePanel id="edit-canvas">
          <div className="relative h-full min-h-0 w-full">
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
                // mesh는 meshOverrides 경로가 따로 있고, 모델/텍스트/지도는
                // 통합 함수가 id로 컬렉션을 해석한다.
                if (selectedObjectType === 'mesh') {
                  updateSelectedMeshTransformVector(field, value, {
                    recordHistory: false,
                  });
                } else {
                  updateSelectedTransformVector(field, value, {
                    recordHistory: false,
                  });
                }
              }}
              onTransformCommit={(position, rotation, scale) => {
                // 드래그 완료 시 position/rotation/scale을 단일 updateSceneInfo로
                // commit해 중간 렌더를 없애고 selectedObject 리셋 버그를 방지한다.
                commitSelectedTransform(position, rotation, scale, {
                  recordHistory: false,
                });
              }}
              onMultiTransformCommit={(updates) => {
                updateMultiObjectTransforms(updates, { recordHistory: false });
              }}
              onAddModel={(catalogItem, position) => {
                addModel(catalogItem, position);
                setDraggingCatalogItem(null);
              }}
              showLabels={showLabels}
              onTransformInteractionStart={startTransformInteraction}
              onTransformInteractionEnd={endTransformInteraction}
              focusSelectedRef={focusSelectedRef}
            />

            {/* 접힌 패널의 재오픈 버튼 — 접힌 쪽 캔버스 모서리에만 남는다. */}
            {leftCollapsed ? (
              <button
                type="button"
                onClick={() => setLeftCollapsed(false)}
                aria-label={t('monitoring:editor.expandPanel')}
                title={t('monitoring:editor.expandPanel')}
                className="border-border bg-card/95 text-muted-foreground hover:bg-card hover:text-foreground absolute top-3 left-3 z-10 flex size-8 cursor-pointer items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition"
              >
                <PanelLeftOpen className="size-4" />
              </button>
            ) : null}
            {rightCollapsed ? (
              <button
                type="button"
                onClick={() => setRightCollapsed(false)}
                aria-label={t('monitoring:editor.expandPanel')}
                title={t('monitoring:editor.expandPanel')}
                className="border-border bg-card/95 text-muted-foreground hover:bg-card hover:text-foreground absolute top-3 right-3 z-10 flex size-8 cursor-pointer items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition"
              >
                <PanelRightOpen className="size-4" />
              </button>
            ) : null}

            {/* 중앙 상단 floating toolbar */}
            <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2">
              <div className="pointer-events-auto">
                <SceneTransformModeToggle
                  mode={transformMode}
                  onModeChange={setTransformMode}
                  leadingContent={
                    <div className="flex items-center gap-2">
                      {!saveDisabled ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'h-8 rounded-sm border px-1.5 text-[12px] font-medium tracking-[0.02em]',
                                    saveStatusClassName,
                                  )}
                                />
                              }
                            >
                              {isSaving ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : isDirty ? (
                                <AlertCircle className="size-4" />
                              ) : showLocalOnlyNotice ? (
                                <HardDrive className="size-4" />
                              ) : (
                                <CheckCircle2 className="size-4" />
                              )}
                              {saveStatusLabel}
                            </TooltipTrigger>
                            <TooltipContent>
                              {showLocalOnlyNotice
                                ? t(
                                    'monitoring:editor.statusSavedLocalOnlyHint',
                                  )
                                : saveStatusLabel}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : null}
                      <SceneHistoryControls
                        canUndo={canUndo}
                        canRedo={canRedo}
                        onUndo={undo}
                        onRedo={redo}
                      />
                    </div>
                  }
                  trailingContent={
                    <div className="bg-background/95 border-border/80 flex h-8.5 items-center gap-2 rounded-lg border px-3 shadow-sm backdrop-blur-sm">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                aria-label={t('monitoring:editor.addText')}
                                disabled={saveDisabled}
                                className="text-muted-foreground hover:text-foreground flex h-full cursor-pointer items-center justify-center transition-colors disabled:cursor-default disabled:opacity-40"
                              />
                            }
                            onClick={handleAddTextAtView}
                          >
                            <Type className="size-4" />
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('monitoring:editor.addText')}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <span className="bg-border h-4 w-px" />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                aria-label={
                                  showLabels
                                    ? t('monitoring:editor.hideLabels')
                                    : t('monitoring:editor.showLabels')
                                }
                                className="text-muted-foreground hover:text-foreground flex h-full cursor-pointer items-center justify-center transition-colors"
                              />
                            }
                            onClick={() => setShowLabels((prev) => !prev)}
                          >
                            {/* 아이콘은 다음 동작이 아니라 현재 상태를 나타낸다 —
                            표시 중이면 Eye, 숨김이면 EyeOff. 톤은 양옆 버튼과
                            동일하게 두고 상태 구분은 아이콘으로만 한다. */}
                            {showLabels ? (
                              <Eye className="size-4" />
                            ) : (
                              <EyeOff className="size-4" />
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            {showLabels
                              ? t('monitoring:editor.hideLabels')
                              : t('monitoring:editor.showLabels')}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <span className="bg-border h-4 w-px" />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                aria-label={t('monitoring:editor.save')}
                                disabled={saveDisabled || isSaving}
                                className="text-muted-foreground hover:text-foreground flex h-full cursor-pointer items-center justify-center transition-colors disabled:cursor-default disabled:opacity-40"
                              />
                            }
                            onClick={() => void saveCurrentScene()}
                          >
                            {isSaving ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Save className="size-4" />
                            )}
                          </TooltipTrigger>
                          {/* 단축키는 우측 하단 도움말 팝업에서 한꺼번에 안내한다. */}
                          <TooltipContent>
                            {t('monitoring:editor.save')}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <span className="bg-border h-4 w-px" />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                aria-label={t('monitoring:editor.exportJson')}
                                disabled={saveDisabled}
                                className="text-muted-foreground hover:text-foreground flex h-full cursor-pointer items-center justify-center transition-colors disabled:cursor-default disabled:opacity-40"
                              />
                            }
                            onClick={() =>
                              downloadSceneInfo(regionId, sceneInfo)
                            }
                          >
                            <Download className="size-4" />
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('monitoring:editor.exportJson')}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  }
                />
              </div>
            </div>

            {/* 우측 하단 단축키 도움말 — 기즈모는 좌하단이라 겹치지 않는다. */}
            <SceneShortcutsHelp />

            {!sceneInfo ? (
              <div className="bg-background/75 absolute inset-0 flex items-center justify-center backdrop-blur-sm">
                <p className="text-muted-foreground text-sm font-medium">
                  {t('monitoring:editor.loading')}
                </p>
              </div>
            ) : null}
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
                        onCollapse={() => setRightCollapsed(true)}
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
                        onTransformChange={updateSelectedTransform}
                        onTextContentChange={updateSelectedTextContent}
                        onTextColorChange={updateSelectedTextColor}
                        onMeshOpacityChange={updateSelectedMeshOpacity}
                        onMeshTransformChange={updateSelectedMeshTransform}
                        onValueMapChange={updateSelectedValueMap}
                        onBackToParent={() => {
                          if (selectedMesh) {
                            selectPlacedModel(selectedMesh.modelId);
                          }
                        }}
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
  );
}

/**
 * 우측 상단 Hierarchy 패널 — 검색 헤더 + 배치된 객체 목록.
 * 모델 팔레트는 좌측 도킹 패널(ProjectPalettePanel)이, 저장/내보내기는
 * 중앙 상단 툴바가 담당한다.
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
  onCollapse,
}: {
  sceneInfo: SavedSceneInfo | null;
  selectedIds: Set<string>;
  onSelectPlacedMap: (id: string) => void;
  onDeletePlacedMap: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  onRenameObject: (id: string, name: string) => void;
  onCollapse: () => void;
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
        onCollapse={onCollapse}
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
const PANEL_TABS = ['models', 'map', 'background'] as const;
type PanelTab = (typeof PANEL_TABS)[number];

const PANEL_TAB_LABEL_KEY: Record<PanelTab, string> = {
  models: 'monitoring:editor.paletteTabs.models',
  map: 'monitoring:editor.paletteTabs.map',
  background: 'monitoring:editor.paletteTabs.background',
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
  onCollapse,
}: {
  items: SceneModelCatalogItem[];
  currentMap: SavedMapInfo | null;
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
  onCollapse: () => void;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PanelTab>('models');
  const [activeCategory, setActiveCategory] = useState<ModelPanelCategory>(
    DEFAULT_MODEL_CATEGORY,
  );
  const [assetSearch, setAssetSearch] = useState('');
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
      {/* 탭 헤더 — 모델/맵/배경 (언더라인 탭) + 접기 버튼 */}
      <div className="border-border flex shrink-0 items-center justify-between border-b pt-1">
        <div className="flex items-center gap-0">
          {PANEL_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'cursor-pointer border-b-2 px-4 py-2 text-[11px] font-medium transition-colors',
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
        <button
          type="button"
          onClick={onCollapse}
          aria-label={t('monitoring:editor.collapsePanel')}
          title={t('monitoring:editor.collapsePanel')}
          className="text-muted-foreground hover:text-foreground mr-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors"
        >
          <PanelLeftClose className="size-4" />
        </button>
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
            <div className="border-border bg-muted text-foreground focus-within:border-ring focus-within:ring-ring/50 mb-2 flex h-7 w-full min-w-0 shrink-0 items-center border px-2 transition-colors focus-within:ring-3">
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
            <div className="min-h-0 flex-1 overflow-y-auto">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
