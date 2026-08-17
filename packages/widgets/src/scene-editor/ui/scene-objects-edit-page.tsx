import {
  SCENE_MODEL_CATEGORIES,
  isSceneStoredLocallyOnly,
  sceneModelCatalog,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { useSceneEditorSession } from '../model/use-scene-editor-session';
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
  // 자체를 렌더하지 않아 캔버스(flex-1)가 그만큼 넓어지고, 캔버스 모서리의
  // 재오픈 버튼만 남는다.
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
  const fitAllRef = useRef<(() => void) | null>(null);
  const fitSelectedRef = useRef<(() => void) | null>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);
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
    updateSelectedTextTransform,
    updateSelectedTextTransformVector,
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
    setSceneMap,
    selectPlacedMap,
    setEnvironmentId,
    selectedMap,
    updateSelectedMapTransform,
    updateSelectedMapTransformVector,
    commitSelectedMapTransform,
    setObjectLocked,
    toggleModel,
    toggleText,
    selectAll,
    updateMultiObjectPositions,
    startTransformInteraction,
    endTransformInteraction,
    cameraStateRef,
    initialCamera,
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
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd+S는 캔버스 포커스 검사보다 먼저 처리한다. 아래 게이트에
      // 걸리면 브라우저의 "페이지 저장" 대화상자가 그대로 뜨는데, 인스펙터에
      // 값을 입력한 직후(=포커스가 패널에 있을 때)가 사용자가 저장을 누르는
      // 바로 그 순간이라 가장 잘 터진다. 입력 중에도 저장은 유효한 동작이므로
      // isEditableTarget도 통과시킨다.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
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
       * - **맨 키**(Delete, R, Home, Enter): 캔버스 포커스일 때만. 패널의
       *   버튼을 조작하다 Enter나 Delete를 누르면 객체가 지워지는 사고가
       *   난다. 이쪽은 제약을 유지하는 게 맞다.
       *
       * 텍스트 입력 중(isEditableTarget)은 위에서 이미 걸렀다.
       */
      const hasModifier = event.ctrlKey || event.metaKey;

      const isUndoShortcut =
        hasModifier && !event.shiftKey && event.key.toLowerCase() === 'z';
      const isRedoShortcut =
        (hasModifier && event.key.toLowerCase() === 'y') ||
        (hasModifier && event.shiftKey && event.key.toLowerCase() === 'z');

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

      const isDuplicateShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd';

      if (isDuplicateShortcut) {
        event.preventDefault();
        duplicateSelectedObject();
        return;
      }

      const isSelectAllShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a';

      const currentSceneInfo = sceneInfoRef.current;
      if (isSelectAllShortcut && currentSceneInfo) {
        event.preventDefault();
        // 잠긴 모델은 전체 선택에서도 제외한다 — 잠금은 "편집 대상에서
        // 제외"라는 하나의 규칙이다(마퀴·클릭 선택과 동일).
        const allIds = [
          ...currentSceneInfo.models.filter((m) => !m.locked).map((m) => m.id),
          ...(currentSceneInfo.texts ?? []).map((t) => t.id),
        ];
        selectAll(allIds);
        return;
      }

      // 여기서부터는 맨 키 단축키다 — 캔버스에 포커스가 있을 때만 처리한다.
      // 패널 버튼을 조작하다 Enter/Delete를 눌러 객체가 사라지면 안 된다.
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

      if (event.key === 'Home') {
        event.preventDefault();
        fitAllRef.current?.();
        return;
      }

      const currentSelectedIds = selectedIdsRef.current;
      if (event.key === 'Enter' && currentSelectedIds.size > 0) {
        event.preventDefault();
        fitSelectedRef.current?.();
        return;
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        resetCameraRef.current?.();
        return;
      }

      if (event.key !== 'Delete' || currentSelectedIds.size === 0) {
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
    <div className="bg-muted/20 flex h-full min-h-0 w-full flex-row overflow-hidden">
      {/* 좌측 도킹 패널 — Project: 에셋 팔레트(모델/맵/배경) */}
      {!leftCollapsed ? (
        <aside className="border-border bg-card text-card-foreground flex w-[13rem] shrink-0 flex-col border-r">
          <ProjectPalettePanel
            items={sceneModelCatalog}
            currentMap={sceneInfo?.maps?.[0] ?? null}
            draggingItemId={draggingCatalogItem?.id ?? null}
            onDragStart={setDraggingCatalogItem}
            onDragEnd={() => setDraggingCatalogItem(null)}
            onSelectMap={setSceneMap}
            environmentId={sceneInfo?.environmentId}
            onEnvironmentChange={setEnvironmentId}
            onCollapse={() => setLeftCollapsed(true)}
          />
        </aside>
      ) : null}

      {/* 중앙 캔버스 — 패널이 캔버스를 덮지 않는 도킹 워크벤치 구조 */}
      <div className="relative min-h-0 min-w-0 flex-1">
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
            if (selectedObjectType === 'text') {
              updateSelectedTextTransformVector(field, value, {
                recordHistory: false,
              });
            } else if (selectedObjectType === 'mesh') {
              updateSelectedMeshTransformVector(field, value, {
                recordHistory: false,
              });
            } else if (selectedObjectType === 'map') {
              updateSelectedMapTransformVector(field, value, {
                recordHistory: false,
              });
            } else {
              updateSelectedTransformVector(field, value, {
                recordHistory: false,
              });
            }
          }}
          onTransformCommit={(position, rotation, scale) => {
            // 모델 드래그 완료 시 position/rotation/scale을 단일 updateSceneInfo로
            // commit해 중간 렌더를 없애고 selectedObject 리셋 버그를 방지한다.
            if (selectedObjectType === 'map') {
              commitSelectedMapTransform(position, rotation, scale, {
                recordHistory: false,
              });
              return;
            }
            commitSelectedTransform(position, rotation, scale, {
              recordHistory: false,
            });
          }}
          onMultiTransformCommit={(updates) => {
            updateMultiObjectPositions(updates, { recordHistory: false });
          }}
          onAddModel={(catalogItem, position) => {
            addModel(catalogItem, position);
            setDraggingCatalogItem(null);
          }}
          showLabels={showLabels}
          onTransformInteractionStart={startTransformInteraction}
          onTransformInteractionEnd={endTransformInteraction}
          fitAllRef={fitAllRef}
          fitSelectedRef={fitSelectedRef}
          resetCameraRef={resetCameraRef}
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
                            ? t('monitoring:editor.statusSavedLocalOnlyHint')
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
                        {showLabels ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4 opacity-50" />
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
                      {/* 단축키를 툴팁에 노출한다 — 버튼만 있으면 Ctrl+S가
                          있는지 알 길이 없어 브라우저 저장 대화상자를 먼저
                          만나게 된다. */}
                      <TooltipContent>
                        {t('monitoring:editor.save')} (Ctrl+S)
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
                        onClick={() => downloadSceneInfo(regionId, sceneInfo)}
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

        {!sceneInfo ? (
          <div className="bg-background/75 absolute inset-0 flex items-center justify-center backdrop-blur-sm">
            <p className="text-muted-foreground text-sm font-medium">
              {t('monitoring:editor.loading')}
            </p>
          </div>
        ) : null}
      </div>

      {/* 우측 도킹 컬럼 — 상단 Hierarchy(1) + 하단 Inspector(2) */}
      {!rightCollapsed ? (
        <aside className="border-border bg-card text-card-foreground flex w-[18rem] shrink-0 flex-col border-l">
          <div className="flex min-h-0 flex-[1] flex-col">
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
              onSelectPlacedMap={selectPlacedMap}
              onToggleLock={setObjectLocked}
              onRenameObject={renameObject}
            />
          </div>
          <div className="border-border flex min-h-0 flex-[2] flex-col border-t">
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
              onTextTransformChange={updateSelectedTextTransform}
              onMeshOpacityChange={updateSelectedMeshOpacity}
              onMeshTransformChange={updateSelectedMeshTransform}
              onValueMapChange={updateSelectedValueMap}
              onMapTransformChange={updateSelectedMapTransform}
              onBackToParent={() => {
                if (selectedMesh) {
                  selectPlacedModel(selectedMesh.modelId);
                }
              }}
            />
          </div>
        </aside>
      ) : null}
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
  onSelectPlacedMap,
  onToggleLock,
  onRenameObject,
  onCollapse,
}: {
  sceneInfo: SavedSceneInfo | null;
  selectedIds: Set<string>;
  onSelectPlacedMap: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  onRenameObject: (id: string, name: string) => void;
  onCollapse: () => void;
  onSelectPlacedModel: (id: string) => void;
  onDeletePlacedModel: (id: string) => void;
  onSelectPlacedText: (id: string) => void;
  onDeletePlacedText: (id: string) => void;
  onTogglePlacedModel: (id: string) => void;
  onTogglePlacedText: (id: string) => void;
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
          onSelectPlacedMap={onSelectPlacedMap}
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
  environmentId,
  onEnvironmentChange,
  onCollapse,
}: {
  items: SceneModelCatalogItem[];
  currentMap: SavedMapInfo | null;
  environmentId: string | null | undefined;
  onEnvironmentChange: (environmentId: string | null) => void;
  draggingItemId: string | null;
  onDragStart: (item: SceneModelCatalogItem) => void;
  onDragEnd: () => void;
  onSelectMap: (catalogItem: SceneMapCatalogItem | null) => void;
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
              />
            ) : (
              <PaletteEnvironmentSection
                environmentId={environmentId}
                onChange={onEnvironmentChange}
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
