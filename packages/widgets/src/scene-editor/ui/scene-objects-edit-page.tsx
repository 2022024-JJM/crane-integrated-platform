import {
  SCENE_MODEL_CATEGORIES,
  isSceneStoredLocallyOnly,
  sceneEnvironmentCatalog,
  sceneModelCatalog,
  type SavedMapInfo,
  type SavedSceneInfo,
  type SceneModelCategory,
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
  FolderClosed,
  HardDrive,
  Layers3,
  Loader2,
  Map,
  PanelLeftClose,
  PanelRightClose,
  Radar,
  Search,
  SlidersHorizontal,
  Type,
} from 'lucide-react';
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
  type VisionChannelOption,
} from '@crane/widgets/3d';
import {
  SCENE_SENSOR_DRAG_TYPE,
  SCENE_TEXT_DRAG_TYPE,
  getPlacedObjectItems,
} from '@crane/widgets/3d';

interface SceneObjectsEditPageProps {
  regionId: string;
  /**
   * 인스펙터에서 카메라/라이다 센서에 매핑할 수 있는 비전 채널 목록.
   * app 레이어가 자기 도메인 채널(예: goliath-crane의 CAMERA_CHANNELS)을 주입한다.
   * 미지정 시 인스펙터에 채널 매핑 UI가 표시되지 않는다.
   */
  visionChannels?: readonly VisionChannelOption[];
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
  visionChannels,
}: SceneObjectsEditPageProps) {
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
    selectPlacedMap,
    setEnvironmentId,
    selectedMap,
    updateSelectedMapTransform,
    updateSelectedMapTransformVector,
    commitSelectedMapTransform,
    setMapLocked,
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
  // 운영 빌드에는 저장 백엔드가 없어 localStorage에만 남는다. dev(파일 저장)와
  // 똑같이 "저장됨"으로 표시하면, 사용자는 배포된 줄 알지만 실제로는 자기
  // 브라우저에만 있다 — 캐시를 지우거나 다른 PC에서 열면 사라진다.
  // "저장됨" 상태일 때만 고지한다 — 저장 전/저장 중에 띄우면 경고가 상시
  // 노출돼 무뎌지고, 정작 알려야 할 순간(방금 저장했는데 이 브라우저에만
  // 남았을 때)의 신호가 묻힌다.
  const showLocalOnlyNotice = isSceneStoredLocallyOnly() && !isSaving && !isDirty;
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
    startTransition(() => {
      setRightCollapsed(!hasSelection);
    });
  }, [hasSelection]);

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
        const allIds = [
          ...currentSceneInfo.models.map((m) => m.id),
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
    <div className="bg-muted/20 flex h-full min-h-0 w-full flex-col overflow-hidden">
      {/* 상단 영역: 캔버스 + 좌우 floating 패널 */}
      <div className="relative min-h-0 flex-1">
        {/* 캔버스가 부모 컨테이너 100%를 차지. 패널은 위에 떠 있다. */}
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
            } else if (
              selectedObjectType === 'sensor' &&
              selectedSensor &&
              (field === 'position' || field === 'rotation')
            ) {
              updateSensor(selectedSensor.id, { [field]: value });
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
            onSelectPlacedMap={selectPlacedMap}
            onToggleMapLock={setMapLocked}
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
            selectedMap={selectedMap}
            multiSelectCount={selectedIds.size}
            visionChannels={visionChannels}
            allSensors={sceneInfo?.sensors}
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
            onMapTransformChange={updateSelectedMapTransform}
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
        maps={sceneInfo?.maps ?? []}
        draggingItemId={draggingCatalogItem?.id ?? null}
        onDragStart={setDraggingCatalogItem}
        onDragEnd={() => setDraggingCatalogItem(null)}
        onTextDragStart={() => setIsDraggingText(true)}
        onTextDragEnd={() => setIsDraggingText(false)}
        onSensorDragStart={(kind) => setDraggingSensorType(kind)}
        onSensorDragEnd={() => setDraggingSensorType('')}
        onDeleteMap={deleteMap}
        environmentId={sceneInfo?.environmentId}
        onEnvironmentChange={setEnvironmentId}
      />
    </div>
  );
}

/**
 * Floating side panel — collapsed면 화면 가장자리의 작은 rail 버튼만 보이고,
 * expanded면 카드 형태로 콘텐츠를 펼친다. 닫기 버튼은 카드 헤더 위에 absolute로
 * 얹어 자식 컴포넌트(HierarchyPanel / SceneObjectInspector)에 손대지 않는다.
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
  onSelectPlacedMap,
  onToggleMapLock,
  onSave,
  onExport,
}: {
  sceneInfo: SavedSceneInfo | null;
  selectedIds: Set<string>;
  isSaving: boolean;
  onSelectPlacedMap: (id: string) => void;
  onToggleMapLock: (id: string, locked: boolean) => void;
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
  const { t } = useTranslation();
  const [objectSearch, setObjectSearch] = useState('');

  const placedObjectCount = useMemo(() => {
    return getPlacedObjectItems({
      placedModels: sceneInfo?.models ?? [],
      placedTexts: sceneInfo?.texts ?? [],
      placedSensors: sceneInfo?.sensors ?? [],
      placedMaps: sceneInfo?.maps ?? [],
      objectSearch,
      textObjectLabel: t('monitoring:editor.textObject'),
      mapObjectLabel: t('monitoring:editor.map'),
    }).length;
  }, [objectSearch, sceneInfo, t]);

  return (
    <div className="border-border bg-card text-card-foreground flex h-full min-h-0 flex-col overflow-hidden rounded-xl border">
      <PaletteHeader
        objectSearch={objectSearch}
        onObjectSearchChange={setObjectSearch}
        placedObjectCount={placedObjectCount}
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
          placedMaps={sceneInfo?.maps ?? []}
          objectSearch={objectSearch}
          selectedIds={selectedIds}
          onSelectPlacedModel={onSelectPlacedModel}
          onDeletePlacedModel={onDeletePlacedModel}
          onSelectPlacedText={onSelectPlacedText}
          onDeletePlacedText={onDeletePlacedText}
          onSelectPlacedSensor={onSelectPlacedSensor}
          onDeletePlacedSensor={onDeletePlacedSensor}
          onTogglePlacedModel={onTogglePlacedModel}
          onTogglePlacedText={onTogglePlacedText}
          onSelectPlacedMap={onSelectPlacedMap}
          onToggleMapLock={onToggleMapLock}
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
const DEFAULT_MODEL_CATEGORY: SceneModelCategory = 'indoor';

/**
 * Project 패널 좌측 카테고리 목록.
 *
 * 'background'는 모델 카테고리가 아니라 이 패널에만 있는 항목이다 —
 * SceneModelCategory(모델 에셋의 분류)에 넣으면 카탈로그·드래그 앤 드롭
 * 경로까지 배경을 모델처럼 다루게 되고, 배경은 드롭할 수 있는 물건이 아니다.
 * 사용자에게는 지도와 나란한 "씬 전역 설정"으로 보이는 편이 자연스러워
 * 표시 목록에서만 합류시킨다.
 */
const PANEL_CATEGORIES = [...SCENE_MODEL_CATEGORIES, 'background'] as const;
type PanelCategory = (typeof PANEL_CATEGORIES)[number];

const MODEL_CATEGORY_LABEL_KEY: Record<PanelCategory, string> = {
  indoor: 'monitoring:editor.modelCategories.indoor',
  outdoor: 'monitoring:editor.modelCategories.outdoor',
  map: 'monitoring:editor.modelCategories.map',
  etc: 'monitoring:editor.modelCategories.etc',
  background: 'monitoring:editor.modelCategories.background',
};

function BottomProjectPanel({
  items,
  maps,
  draggingItemId,
  onDragStart,
  onDragEnd,
  onTextDragStart,
  onTextDragEnd,
  onSensorDragStart,
  onSensorDragEnd,
  onDeleteMap,
  environmentId,
  onEnvironmentChange,
}: {
  items: SceneModelCatalogItem[];
  maps: SavedMapInfo[];
  environmentId: string | null | undefined;
  onEnvironmentChange: (environmentId: string | null) => void;
  draggingItemId: string | null;
  onDragStart: (item: SceneModelCatalogItem) => void;
  onDragEnd: () => void;
  onTextDragStart: () => void;
  onTextDragEnd: () => void;
  onSensorDragStart: (kind: 'lidar' | 'camera') => void;
  onSensorDragEnd: () => void;
  onDeleteMap: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'models' | 'tools'>('models');
  const [activeCategory, setActiveCategory] = useState<PanelCategory>(
    DEFAULT_MODEL_CATEGORY,
  );
  const [assetSearch, setAssetSearch] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [panelHeight, setPanelHeight] = useState(BOTTOM_PANEL_DEFAULT_H);
  const dragStartY = useRef<number | null>(null);
  const dragStartH = useRef<number>(BOTTOM_PANEL_DEFAULT_H);
  const currentPanelHeight = isCollapsed
    ? BOTTOM_PANEL_COLLAPSED_H
    : panelHeight;
  const categoryCounts = useMemo(() => {
    return PANEL_CATEGORIES.reduce(
      (acc, category) => {
        acc[category] =
          category === 'map'
            ? maps.length
            : category === 'background'
              ? // 고를 수 있는 배경 수. 다른 카테고리 배지와 같은 의미
                // ("이 안에 몇 개가 있나")로 읽힌다.
                sceneEnvironmentCatalog.length
              : items.filter((item) => item.category === category).length;
        return acc;
      },
      {
        indoor: 0,
        outdoor: 0,
        map: 0,
        etc: 0,
        background: 0,
      } satisfies Record<PanelCategory, number>,
    );
  }, [items, maps]);
  const categoryItems = useMemo(() => {
    return items.filter((item) => item.category === activeCategory);
  }, [activeCategory, items]);

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
              'cursor-pointer border-b-2 px-4 py-2 text-[11px] font-medium transition-colors',
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
              'cursor-pointer border-b-2 px-4 py-2 text-[11px] font-medium transition-colors',
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
          className="text-muted-foreground hover:text-foreground mr-2 inline-flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors"
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
          className="h-full overflow-hidden px-2 pt-2 pb-1"
        >
          <div className="grid h-full min-h-0 grid-cols-[13rem_minmax(0,1fr)] gap-0 overflow-hidden">
            <div className="border-border/70 min-h-0 overflow-y-auto border-r pr-2">
              <div className="text-muted-foreground px-2 pb-2 text-[10px] font-semibold tracking-[0.12em] uppercase">
                {t('monitoring:editor.categoryLibrary')}
              </div>
              <div className="space-y-0.5">
                {PANEL_CATEGORIES.map((category) => {
                  const isActive = activeCategory === category;

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={cn(
                        'text-muted-foreground hover:bg-muted/70 hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition',
                        isActive && 'bg-primary/12 text-foreground',
                      )}
                    >
                      <FolderClosed
                        className={cn(
                          'size-3.5 shrink-0',
                          isActive
                            ? 'text-primary'
                            : 'text-muted-foreground/80',
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                        {t(MODEL_CATEGORY_LABEL_KEY[category])}
                      </span>
                      <Badge
                        render={<div />}
                        variant="outline"
                        className={cn(
                          'border-border bg-background/80 min-w-7 shrink-0 justify-center rounded-sm px-1.5 py-0 text-[10px]',
                          isActive && 'border-primary/30 bg-primary/10',
                        )}
                      >
                        {categoryCounts[category]}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden pl-3">
              <div className="border-border/60 flex shrink-0 items-center justify-between gap-3 border-b pb-2">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
                    {t('monitoring:palette.title')}
                  </p>
                  <p className="text-foreground truncate text-[12px] font-medium">
                    {t(MODEL_CATEGORY_LABEL_KEY[activeCategory])}
                  </p>
                </div>
                {activeCategory !== 'map' && activeCategory !== 'background' ? (
                  <div className="border-border bg-muted text-foreground focus-within:border-ring focus-within:ring-ring/50 flex h-7 w-full max-w-44 min-w-0 items-center border px-2 transition-colors focus-within:ring-3">
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
                ) : null}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pt-2">
                {activeCategory === 'background' ? (
                  <PaletteEnvironmentSection
                    environmentId={environmentId}
                    onChange={onEnvironmentChange}
                  />
                ) : activeCategory === 'map' ? (
                  maps.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {/* 선택·잠금은 좌측 계층 목록(Hierarchy)이 담당한다.
                          여기 Project 패널은 에셋 관리 영역이라 지도 삭제만
                          남긴다 — 같은 조작을 두 곳에 두면 어느 쪽이 정본인지
                          모호해진다. */}
                      {maps.map((m) => (
                        <PaletteMapSection
                          key={m.id}
                          map={m}
                          onDeleteMap={() => onDeleteMap(m.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-[12px]">
                      <Map className="size-6 opacity-30" />
                      <p>{t('monitoring:editor.noMap')}</p>
                    </div>
                  )
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
          </div>
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
            className="border-border bg-muted text-muted-foreground hover:bg-muted/80 flex w-full cursor-grab items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] transition active:cursor-grabbing"
          >
            <Type className="size-3" />
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
            className="border-border bg-muted text-muted-foreground hover:bg-muted/80 flex w-full cursor-grab items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] transition active:cursor-grabbing"
          >
            <Radar className="size-3" />
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
            className="border-border bg-muted text-muted-foreground hover:bg-muted/80 flex w-full cursor-grab items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] transition active:cursor-grabbing"
          >
            <CameraIcon className="size-3" />
            {t('monitoring:editor.addCameraSensor')}
          </div>

        </div>

      </div>
    </div>
  );
}
