import {
  sceneModelCatalog,
  type SavedMapInfo,
  type SavedSceneInfo,
  type SceneModelCatalogItem,
} from '@crane/domain/3d';
import {
  SceneHistoryControls,
  SceneTransformModeToggle,
} from '@crane/features/3d';
import {
  AlertCircle,
  Camera as CameraIcon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  PanelLeftClose,
  PanelRightClose,
  Radar,
  SlidersHorizontal,
  Type,
} from 'lucide-react';
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { useSceneEditorSession } from '../model/use-scene-editor-session';
import {
  PaletteAssetGrid,
  PaletteHeader,
  PaletteMapSection,
  PalettePlacedObjects,
  SceneObjectInspector,
  SceneObjectsEditCanvas,
} from '@crane/widgets/3d';
import {
  SCENE_SENSOR_DRAG_TYPE,
  SCENE_TEXT_DRAG_TYPE,
} from '../../3d/ui/use-scene-drop';

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
  const [draggingSensorType, setDraggingSensorType] = useState<
    '' | 'lidar' | 'camera'
  >('');
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
    updateSelectedMeshName,
    updateSelectedValueMap,
    selectedObjectType,
    removeSelectedModel,
    duplicateSelectedObject,
    addModel,
    addText,
    addLidarSensor,
    addCameraSensor,
    updateSensor,
    selectedSensor,
    selectPlacedModel,
    deletePlacedModel,
    selectPlacedText,
    deletePlacedText,
    selectPlacedSensor,
    deletePlacedSensor,
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

  // 좌측 패널은 카탈로그/배치 객체 목록이라 작업 흐름상 자주 본다 → 기본 펼침.
  // 우측 inspector는 선택된 객체가 있을 때만 의미가 있으므로 기본 접힘 + 선택
  // 시 자동 펼침. 선택 해제 시 자동으로 닫지는 않는다(잠깐 deselect 후 다른
  // 객체를 선택하는 흐름에서 패널이 깜빡이는 걸 방지).
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);

  const hasSelection = selectedIds.size > 0;
  const saveDisabled = !sceneInfo;
  const saveStatusLabel = isSaving
    ? t('monitoring:editor.statusSaving')
    : isDirty
      ? t('monitoring:editor.statusUnsaved')
      : t('monitoring:editor.statusSaved');
  const saveStatusClassName = isSaving
    ? 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'
    : isDirty
      ? 'border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-100'
      : 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100';

  useEffect(() => {
    startTransition(() => {
      setRightCollapsed(!hasSelection);
    });
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

      const currentSceneInfo = sceneInfoRef.current;
      if (isSelectAllShortcut && currentSceneInfo) {
        event.preventDefault();
        const allIds = [
          ...currentSceneInfo.models.map((m) => m.id),
          ...(currentSceneInfo.texts ?? []).map((t) => t.id),
        ];
        selectAll(allIds);
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
  }, [duplicateSelectedObject, redo, removeSelectedModel, selectAll, undo]);

  return (
    <div className="bg-muted/20 flex h-full min-h-0 w-full flex-col overflow-hidden">
      {/* 상단 영역: 캔버스 + 좌우 floating 패널 */}
      <div className="relative min-h-0 flex-1">
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
            } else if (
              selectedObjectType === 'sensor' &&
              selectedSensor &&
              (field === 'position' || field === 'rotation')
            ) {
              updateSensor(selectedSensor.id, { [field]: value });
            } else {
              updateSelectedTransformVector(field, value, {
                recordHistory: false,
              });
            }
          }}
          onTransformCommit={(position, rotation, scale) => {
            // 모델 드래그 완료 시 position/rotation/scale을 단일 updateSceneInfo로
            // commit해 중간 렌더를 없애고 selectedObject 리셋 버그를 방지한다.
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
          isDraggingText={isDraggingText}
          onAddText={(position) => {
            addText(position);
            setIsDraggingText(false);
          }}
          draggingSensorType={draggingSensorType}
          onAddLidarSensor={(position) => {
            addLidarSensor(position);
            setDraggingSensorType('');
          }}
          onAddCameraSensor={(position) => {
            addCameraSensor(position);
            setDraggingSensorType('');
          }}
          showLabels={showLabels}
          onTransformInteractionStart={startTransformInteraction}
          onTransformInteractionEnd={endTransformInteraction}
          fitAllRef={fitAllRef}
          fitSelectedRef={fitSelectedRef}
          resetCameraRef={resetCameraRef}
          inspectorOpen={!rightCollapsed}
        />

        {/* 좌측 floating panel — Hierarchy: 배치된 객체 목록 */}
        <FloatingPanel
          side="left"
          collapsed={leftCollapsed}
          expandedWidth="w-[20rem]"
          onExpand={() => setLeftCollapsed(false)}
          onCollapse={() => setLeftCollapsed(true)}
          railIcon={<Layers3 className="size-4" />}
          railLabel={t('monitoring:editor.placedObjects')}
        >
          <HierarchyPanel
            sceneInfo={sceneInfo}
            selectedIds={selectedIds}
            isSaving={isSaving}
            onSelectPlacedModel={selectPlacedModel}
            onDeletePlacedModel={deletePlacedModel}
            onSelectPlacedText={selectPlacedText}
            onDeletePlacedText={deletePlacedText}
            onSelectPlacedSensor={selectPlacedSensor}
            onDeletePlacedSensor={deletePlacedSensor}
            onTogglePlacedModel={toggleModel}
            onTogglePlacedText={toggleText}
            onSave={() => void saveCurrentScene()}
            onExport={() => downloadSceneInfo(regionId, sceneInfo)}
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
            selectedSensor={selectedSensor}
            selectedMesh={selectedMesh}
            multiSelectCount={selectedIds.size}
            onNameChange={updateSelectedName}
            onOpacityChange={updateSelectedOpacity}
            onTransformChange={(field, axis, value) => {
              // 센서가 선택돼 있으면 sensor의 position/rotation을 직접 수정.
              // 텍스트/모델/메시는 기존 핸들러로.
              if (
                selectedSensor &&
                (field === 'position' || field === 'rotation')
              ) {
                const current =
                  field === 'position'
                    ? selectedSensor.position
                    : selectedSensor.rotation;
                const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
                const next: [number, number, number] = [
                  current[0],
                  current[1],
                  current[2],
                ];
                next[idx] = value;
                updateSensor(selectedSensor.id, { [field]: next });
                return;
              }
              updateSelectedTransform(field, axis, value);
            }}
            onTextContentChange={updateSelectedTextContent}
            onTextColorChange={updateSelectedTextColor}
            onTextTransformChange={updateSelectedTextTransform}
            onMeshNameChange={updateSelectedMeshName}
            onMeshOpacityChange={updateSelectedMeshOpacity}
            onMeshTransformChange={updateSelectedMeshTransform}
            onSensorChange={updateSensor}
            onValueMapChange={updateSelectedValueMap}
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
                <div className="flex items-center gap-2">
                  {!saveDisabled ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        'h-8 rounded-sm border px-1.5 text-[12px] font-medium tracking-[0.02em]',
                        saveStatusClassName,
                      )}
                    >
                      {isSaving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : isDirty ? (
                        <AlertCircle className="size-4" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      {saveStatusLabel}
                    </Badge>
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
                  <span className="max-w-36 truncate text-xs font-medium">
                    {selectedIds.size > 1
                      ? t('monitoring:editor.multipleSelected', {
                          count: selectedIds.size,
                        })
                      : selectedModelLabel ||
                        t('monitoring:editor.noSelection')}
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

      {/* 하단 패널 — Project: 3D 모델 에셋 그리드 + 센서/텍스트 도구 */}
      <BottomProjectPanel
        items={sceneModelCatalog}
        map={sceneInfo?.map ?? null}
        draggingItemId={draggingCatalogItem?.id ?? null}
        onDragStart={setDraggingCatalogItem}
        onDragEnd={() => setDraggingCatalogItem(null)}
        onTextDragStart={() => setIsDraggingText(true)}
        onTextDragEnd={() => setIsDraggingText(false)}
        onSensorDragStart={(kind) => setDraggingSensorType(kind)}
        onSensorDragEnd={() => setDraggingSensorType('')}
        onDeleteMap={deleteMap}
      />
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

/**
 * 좌측 Hierarchy 패널 — 저장/내보내기 헤더 + 배치된 객체 목록.
 * 모델 팔레트와 센서/텍스트 도구는 하단 패널로 이동했으므로 포함하지 않는다.
 */
function HierarchyPanel({
  sceneInfo,
  selectedIds,
  isSaving,
  onSelectPlacedModel,
  onDeletePlacedModel,
  onSelectPlacedText,
  onDeletePlacedText,
  onSelectPlacedSensor,
  onDeletePlacedSensor,
  onTogglePlacedModel,
  onTogglePlacedText,
  onSave,
  onExport,
}: {
  sceneInfo: SavedSceneInfo | null;
  selectedIds: Set<string>;
  isSaving: boolean;
  onSelectPlacedModel: (id: string) => void;
  onDeletePlacedModel: (id: string) => void;
  onSelectPlacedText: (id: string) => void;
  onDeletePlacedText: (id: string) => void;
  onSelectPlacedSensor: (id: string) => void;
  onDeletePlacedSensor: (id: string) => void;
  onTogglePlacedModel: (id: string) => void;
  onTogglePlacedText: (id: string) => void;
  onSave: () => void;
  onExport: () => void;
}) {
  return (
    <div className="border-border bg-card text-card-foreground flex h-full min-h-0 flex-col overflow-hidden rounded-xl border">
      <PaletteHeader
        onSave={onSave}
        onExport={onExport}
        saveDisabled={!sceneInfo}
        exportDisabled={!sceneInfo}
        isSaving={isSaving}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <PalettePlacedObjects
          placedModels={sceneInfo?.models ?? []}
          placedTexts={sceneInfo?.texts ?? []}
          placedSensors={sceneInfo?.sensors ?? []}
          selectedIds={selectedIds}
          onSelectPlacedModel={onSelectPlacedModel}
          onDeletePlacedModel={onDeletePlacedModel}
          onSelectPlacedText={onSelectPlacedText}
          onDeletePlacedText={onDeletePlacedText}
          onSelectPlacedSensor={onSelectPlacedSensor}
          onDeletePlacedSensor={onDeletePlacedSensor}
          onTogglePlacedModel={onTogglePlacedModel}
          onTogglePlacedText={onTogglePlacedText}
        />
      </div>
    </div>
  );
}

/**
 * 하단 Project 패널 — 탭으로 분리된 에셋/도구 영역.
 * 탭 1 "3D 모델": 드래그 가능한 모델 에셋 그리드.
 * 탭 2 "센서 / 텍스트": 텍스트·LiDAR·카메라 추가 버튼 + 지도 섹션.
 */
const BOTTOM_PANEL_MIN_H = 80;
const BOTTOM_PANEL_MAX_H = 480;
const BOTTOM_PANEL_DEFAULT_H = 224;
const BOTTOM_PANEL_COLLAPSED_H = 44;

function BottomProjectPanel({
  items,
  map,
  draggingItemId,
  onDragStart,
  onDragEnd,
  onTextDragStart,
  onTextDragEnd,
  onSensorDragStart,
  onSensorDragEnd,
  onDeleteMap,
}: {
  items: SceneModelCatalogItem[];
  map: SavedMapInfo | null;
  draggingItemId: string | null;
  onDragStart: (item: SceneModelCatalogItem) => void;
  onDragEnd: () => void;
  onTextDragStart: () => void;
  onTextDragEnd: () => void;
  onSensorDragStart: (kind: 'lidar' | 'camera') => void;
  onSensorDragEnd: () => void;
  onDeleteMap: () => void;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'models' | 'tools'>('models');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [panelHeight, setPanelHeight] = useState(BOTTOM_PANEL_DEFAULT_H);
  const dragStartY = useRef<number | null>(null);
  const dragStartH = useRef<number>(BOTTOM_PANEL_DEFAULT_H);
  const currentPanelHeight = isCollapsed
    ? BOTTOM_PANEL_COLLAPSED_H
    : panelHeight;

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartH.current = panelHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (dragStartY.current === null) return;
      const delta = dragStartY.current - ev.clientY;
      const next = Math.min(
        BOTTOM_PANEL_MAX_H,
        Math.max(BOTTOM_PANEL_MIN_H, dragStartH.current + delta),
      );
      setPanelHeight(next);
    };

    const onMouseUp = () => {
      dragStartY.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      className="border-border bg-card text-card-foreground relative flex shrink-0 flex-col overflow-hidden border-t"
      style={{ height: currentPanelHeight }}
    >
      {/* 리사이즈 핸들 */}
      {!isCollapsed ? (
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute inset-x-0 top-0 z-10 flex h-1 cursor-row-resize items-center justify-center"
        />
      ) : null}
      {/* 탭 헤더 */}
      <div className="border-border flex shrink-0 items-center justify-between border-b pt-1">
        <div className="flex items-center gap-0">
          <button
            type="button"
            onClick={() => setActiveTab('models')}
            className={cn(
              'border-b-2 px-4 py-2 text-[11px] font-medium transition-colors',
              activeTab === 'models'
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {t('monitoring:palette.title')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tools')}
            className={cn(
              'border-b-2 px-4 py-2 text-[11px] font-medium transition-colors',
              activeTab === 'tools'
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {t('monitoring:editor.sensorTextTab')}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="text-muted-foreground hover:text-foreground mr-2 inline-flex size-7 items-center justify-center rounded-md transition-colors"
          aria-label={isCollapsed ? 'Expand palette' : 'Collapse palette'}
          title={isCollapsed ? 'Expand palette' : 'Collapse palette'}
        >
          {isCollapsed ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      <div
        hidden={isCollapsed}
        aria-hidden={isCollapsed}
        className="min-h-0 flex-1 overflow-hidden"
      >
        <div
          hidden={activeTab !== 'models'}
          aria-hidden={activeTab !== 'models'}
          className="h-full overflow-hidden p-2"
        >
          <PaletteAssetGrid
            items={items}
            draggingItemId={draggingItemId}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        </div>

        <div
          hidden={activeTab !== 'tools'}
          aria-hidden={activeTab !== 'tools'}
          className="flex h-full flex-col gap-2 overflow-y-auto p-2"
        >
          <div
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(SCENE_TEXT_DRAG_TYPE, 'text');
              event.dataTransfer.effectAllowed = 'copy';
              onTextDragStart();
            }}
            onDragEnd={onTextDragEnd}
            className="border-border bg-muted text-muted-foreground hover:bg-muted/80 flex w-full cursor-grab items-center gap-2 rounded-md border px-3 py-2 text-[12px] transition active:cursor-grabbing"
          >
            <Type className="size-3.5" />
            {t('monitoring:editor.addText')}
          </div>

          <div
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(SCENE_SENSOR_DRAG_TYPE, 'lidar');
              event.dataTransfer.effectAllowed = 'copy';
              onSensorDragStart('lidar');
            }}
            onDragEnd={onSensorDragEnd}
            className="border-border bg-muted text-muted-foreground hover:bg-muted/80 flex w-full cursor-grab items-center gap-2 rounded-md border px-3 py-2 text-[12px] transition active:cursor-grabbing"
          >
            <Radar className="size-3.5" />
            {t('monitoring:editor.addLidarSensor')}
          </div>

          <div
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(SCENE_SENSOR_DRAG_TYPE, 'camera');
              event.dataTransfer.effectAllowed = 'copy';
              onSensorDragStart('camera');
            }}
            onDragEnd={onSensorDragEnd}
            className="border-border bg-muted text-muted-foreground hover:bg-muted/80 flex w-full cursor-grab items-center gap-2 rounded-md border px-3 py-2 text-[12px] transition active:cursor-grabbing"
          >
            <CameraIcon className="size-3.5" />
            {t('monitoring:editor.addCameraSensor')}
          </div>

          {map ? (
            <PaletteMapSection map={map} onDeleteMap={onDeleteMap} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
