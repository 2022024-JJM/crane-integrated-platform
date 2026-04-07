import {
  sceneModelCatalog,
  type SavedSceneInfo,
  type SceneModelCatalogItem,
} from '@crane/domain/3d';
import {
  SceneHistoryControls,
  SceneTransformModeToggle,
} from '@crane/features/3d';
import {
  Layers3,
  PanelLeftClose,
  PanelRightClose,
  SlidersHorizontal,
  Tag,
  Tags,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { useSceneEditorSession } from '../model/use-scene-editor-session';
import {
  SceneModelPalette,
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
  const [isDraggingText, setIsDraggingText] = useState(false);
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
  const fitAllRef = useRef<(() => void) | null>(null);
  const fitSelectedRef = useRef<(() => void) | null>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);
  const {
    sceneInfo,
    selectedIds,
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
    updateSelectedTextContent,
    updateSelectedTextColor,
    updateSelectedTextTransform,
    updateSelectedTextTransformVector,
    selectedText,
    selectedMesh,
    updateSelectedMeshTransform,
    updateSelectedMeshTransformVector,
    updateSelectedMeshOpacity,
    updateSelectedMeshName,
    selectedObjectType,
    removeSelectedModel,
    duplicateSelectedObject,
    addModel,
    addText,
    selectPlacedModel,
    deletePlacedModel,
    selectPlacedText,
    deletePlacedText,
    deleteMap,
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

  useEffect(() => {
    setDraggingCatalogItem(null);
  }, [regionId]);

  // 좌측 패널은 카탈로그/배치 객체 목록이라 작업 흐름상 자주 본다 → 기본 펼침.
  // 우측 inspector는 선택된 객체가 있을 때만 의미가 있으므로 기본 접힘 + 선택
  // 시 자동 펼침. 선택 해제 시 자동으로 닫지는 않는다(잠깐 deselect 후 다른
  // 객체를 선택하는 흐름에서 패널이 깜빡이는 걸 방지).
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);

  const hasSelection = selectedIds.size > 0;
  useEffect(() => {
    setRightCollapsed(!hasSelection);
  }, [hasSelection]);

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

      const isDuplicateShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd';

      if (isDuplicateShortcut) {
        event.preventDefault();
        duplicateSelectedObject();
        return;
      }

      const isSelectAllShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a';

      if (isSelectAllShortcut && sceneInfo) {
        event.preventDefault();
        const allIds = [
          ...sceneInfo.models.map((m) => m.id),
          ...(sceneInfo.texts ?? []).map((t) => t.id),
        ];
        selectAll(allIds);
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        fitAllRef.current?.();
        return;
      }

      if (event.key === 'Enter' && selectedIds.size > 0) {
        event.preventDefault();
        fitSelectedRef.current?.();
        return;
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        resetCameraRef.current?.();
        return;
      }

      if (event.key !== 'Delete' || selectedIds.size === 0) {
        return;
      }

      event.preventDefault();
      removeSelectedModel();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [duplicateSelectedObject, redo, removeSelectedModel, sceneInfo, selectAll, selectedIds, undo]);

  return (
    <div className="bg-muted/20 relative h-full min-h-0 w-full overflow-hidden">
      {/* 캔버스가 부모 컨테이너 100%를 차지. 패널은 위에 떠 있다. */}
      <SceneObjectsEditCanvas
        rootRef={canvasRootRef}
        cameraStateRef={cameraStateRef}
        initialCamera={initialCamera}
        sceneInfo={sceneInfo}
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
          } else {
            updateSelectedTransformVector(field, value, {
              recordHistory: false,
            });
          }
        }}
        onMultiTransformCommit={(updates) => {
          updateMultiObjectPositions(updates, { recordHistory: false });
        }}
        onAddModel={(catalogItem, position) => {
          addModel(catalogItem, position);
          setDraggingCatalogItem(null);
        }}
        isDraggingText={isDraggingText}
        onAddText={(position) => {
          addText(position);
          setIsDraggingText(false);
        }}
        showLabels={showLabels}
        onTransformInteractionStart={startTransformInteraction}
        onTransformInteractionEnd={endTransformInteraction}
        fitAllRef={fitAllRef}
        fitSelectedRef={fitSelectedRef}
        resetCameraRef={resetCameraRef}
      />

      {/* 좌측 floating panel — 카탈로그 + 배치 객체 목록 */}
      <FloatingPanel
        side="left"
        collapsed={leftCollapsed}
        expandedWidth="w-[24rem]"
        onExpand={() => setLeftCollapsed(false)}
        onCollapse={() => setLeftCollapsed(true)}
        railIcon={<Layers3 className="size-4" />}
        railLabel={t('monitoring:editor.placedObjects')}
      >
        <SceneModelPalette
          items={sceneModelCatalog}
          map={sceneInfo?.map ?? null}
          placedModels={sceneInfo?.models ?? []}
          draggingItemId={draggingCatalogItem?.id ?? null}
          selectedIds={selectedIds}
          onDragStart={setDraggingCatalogItem}
          onDragEnd={() => {
            setDraggingCatalogItem(null);
          }}
          onSelectPlacedModel={selectPlacedModel}
          onDeletePlacedModel={deletePlacedModel}
          placedTexts={sceneInfo?.texts ?? []}
          onSelectPlacedText={selectPlacedText}
          onDeletePlacedText={deletePlacedText}
          onTogglePlacedModel={toggleModel}
          onTogglePlacedText={toggleText}
          onTextDragStart={() => setIsDraggingText(true)}
          onTextDragEnd={() => setIsDraggingText(false)}
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
      </FloatingPanel>

      {/* 우측 floating panel — Inspector. 선택 시 자동 expand. */}
      <FloatingPanel
        side="right"
        collapsed={rightCollapsed}
        expandedWidth="w-[20rem]"
        onExpand={() => setRightCollapsed(false)}
        onCollapse={() => setRightCollapsed(true)}
        railIcon={<SlidersHorizontal className="size-4" />}
        railLabel={t('monitoring:inspector.title')}
      >
        <SceneObjectInspector
          selectedModel={selectedModel}
          selectedText={selectedText}
          selectedMesh={selectedMesh}
          multiSelectCount={selectedIds.size}
          onNameChange={updateSelectedName}
          onOpacityChange={updateSelectedOpacity}
          onTransformChange={updateSelectedTransform}
          onTextContentChange={updateSelectedTextContent}
          onTextColorChange={updateSelectedTextColor}
          onTextTransformChange={updateSelectedTextTransform}
          onMeshNameChange={updateSelectedMeshName}
          onMeshOpacityChange={updateSelectedMeshOpacity}
          onMeshTransformChange={updateSelectedMeshTransform}
          onBackToParent={() => {
            if (selectedMesh) {
              selectPlacedModel(selectedMesh.modelId);
            }
          }}
        />
      </FloatingPanel>

      {/* 중앙 상단 floating toolbar (기존) */}
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
                <button
                  type="button"
                  onClick={() => setShowLabels((prev) => !prev)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title={
                    showLabels
                      ? t('monitoring:editor.hideLabels')
                      : t('monitoring:editor.showLabels')
                  }
                >
                  {showLabels ? (
                    <Tag className="size-4" />
                  ) : (
                    <Tags className="size-4 opacity-50" />
                  )}
                </button>
                <span className="bg-border h-4 w-px" />
                <span className="max-w-36 truncate text-xs font-medium">
                  {selectedIds.size > 1
                    ? t('monitoring:editor.multipleSelected', {
                        count: selectedIds.size,
                      })
                    : selectedModelLabel || t('monitoring:editor.noSelection')}
                </span>
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
  );
}

/**
 * Floating side panel — collapsed면 화면 가장자리의 작은 rail 버튼만 보이고,
 * expanded면 카드 형태로 콘텐츠를 펼친다. 닫기 버튼은 카드 헤더 위에 absolute로
 * 얹어 자식 컴포넌트(SceneModelPalette / SceneObjectInspector)에 손대지 않는다.
 *
 * pointer-events 처리: 컨테이너 자체는 pointer-events-none으로 두고 rail/카드만
 * pointer-events-auto. 이렇게 하면 collapsed 영역의 빈 공간 위에서도 캔버스
 * OrbitControls가 정상 동작한다.
 */
function FloatingPanel({
  side,
  collapsed,
  expandedWidth,
  onExpand,
  onCollapse,
  railIcon,
  railLabel,
  children,
}: {
  side: 'left' | 'right';
  collapsed: boolean;
  expandedWidth: string;
  onExpand: () => void;
  onCollapse: () => void;
  railIcon: ReactNode;
  railLabel: string;
  children: ReactNode;
}) {
  const sideClass = side === 'left' ? 'left-3' : 'right-3';
  // 닫기 버튼은 카드 바깥쪽 가장자리에 탭처럼 붙인다. 좌측 패널이면 카드의
  // 오른쪽 바깥(=캔버스 쪽), 우측 패널이면 카드의 왼쪽 바깥. 카드 헤더 안의
  // 저장/내보내기 버튼들과 겹치지 않게 한다.
  const closeBtnEdgeClass =
    side === 'left'
      ? '-right-3 top-1/2 -translate-y-1/2'
      : '-left-3 top-1/2 -translate-y-1/2';
  const CloseIcon = side === 'left' ? PanelLeftClose : PanelRightClose;

  return (
    <div
      className={cn(
        // z-0: 글로벌 헤더의 드롭다운/popover보다 낮게 둔다. 패널은 캔버스 위에
        // 떠 있기만 하면 되고(캔버스는 stacking context의 자연 흐름), 헤더에서
        // 내려오는 popover에 가리지 않아야 한다.
        'pointer-events-none absolute top-3 bottom-3 z-0 flex transition-[width] duration-200 ease-out',
        sideClass,
        collapsed ? 'w-10' : expandedWidth,
      )}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={onExpand}
          aria-label={railLabel}
          title={railLabel}
          className="border-border bg-card/95 text-muted-foreground hover:bg-card hover:text-foreground pointer-events-auto flex size-10 cursor-pointer items-center justify-center rounded-lg border shadow-sm backdrop-blur-sm transition"
        >
          {railIcon}
        </button>
      ) : (
        <div className="pointer-events-auto relative h-full w-full">
          {children}
          <button
            type="button"
            onClick={onCollapse}
            aria-label={railLabel}
            title={railLabel}
            className={cn(
              'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground absolute z-10 flex size-6 cursor-pointer items-center justify-center rounded-md border shadow-md transition',
              closeBtnEdgeClass,
            )}
          >
            <CloseIcon className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
