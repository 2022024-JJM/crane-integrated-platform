import { ArrowLeft, CalendarRange, ChevronDown } from 'lucide-react';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Box3 } from 'three';
import { modelObjectRegistry } from '@crane/domain/3d';
import { Button } from '@crane/ui/atoms/button';
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from '@crane/ui/molecules/popover';
import {
  ThreeSceneViewer,
  type SceneController,
} from '@crane/ui/organisms/three-scene-viewer';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  formatReplayTimestamp,
  type MonitoringReplayUiState,
} from '@crane/domain/monitoring';
import { useObjectFocusStore } from '../model/use-object-focus-store';
import {
  OutdoorWorkModelSimulation,
  useSceneData,
} from './outdoor-work-model-simulation';
import { ReplayPlayerControls } from './replay-player-controls';
import { SceneEnvironment } from './scene-environment';
import { SceneSurfaceCamera } from './scene-surface-camera';
import {
  SCENE_CAMERA_CLIP,
  SCENE_GL_OPTIONS,
  SceneLighting,
} from './scene-render-preset';
import { sceneCanvasShadows } from '../lib/scene-shadow';
import { SceneLoadingOverlay, SceneReadyProbe } from './scene-loading-overlay';
import { ReplaySearchForm } from './replay-search-form';

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [-65, 20, -10];
const DEFAULT_CAMERA_TARGET: Vector3Tuple = [-65, 0, -35];

const EMPTY_ALARMS: Record<string, never> = {};

interface Replay3dViewProps {
  regionId: string;
  onLoadingChange?: (isLoading: boolean) => void;
  search?: MonitoringReplayUiState;
}

function formatRangeButtonLabel(
  viewingFrom: string,
  viewingTo: string,
): string {
  const from = formatReplayTimestamp(viewingFrom, 'datetime');
  const to = formatReplayTimestamp(viewingTo, 'time');
  if (from && to) return `${from} ~ ${to}`;
  return viewingFrom && viewingTo ? `${viewingFrom} ~ ${viewingTo}` : '';
}

export function Replay3dView({
  regionId,
  onLoadingChange,
  search,
}: Replay3dViewProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sceneControllerRef = useRef<SceneController | null>(null);
  const { sceneInfo, isLoading } = useSceneData(regionId, 'replay');
  const focusedModelId = useObjectFocusStore((s) => s.focusedModelId);
  const exitFocus = useObjectFocusStore((s) => s.exitFocus);

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  const handleControllerReady = useCallback(
    (controller: SceneController | null) => {
      sceneControllerRef.current = controller;
    },
    [],
  );

  const handleMoveTo = useCallback(
    (position: Vector3Tuple, target: Vector3Tuple) => {
      sceneControllerRef.current?.moveTo(position, target);
    },
    [],
  );

  const handleResetCamera = useCallback(() => {
    sceneControllerRef.current?.reset();
  }, []);

  const handleGetPose = useCallback(
    () => sceneControllerRef.current?.getPose() ?? null,
    [],
  );

  const [sceneReady, setSceneReady] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const cameraPosition = sceneInfo?.camera?.position ?? DEFAULT_CAMERA_POSITION;
  const cameraTarget = sceneInfo?.camera?.target ?? DEFAULT_CAMERA_TARGET;
  // 인라인 리터럴 금지 — monitoring-3d-view의 cameraPreset 주석 참고
  // (부모 리렌더마다 SceneControlsBridge가 reset()을 호출해 카메라가 튄다).
  // 탑뷰 fit 대상 = 지도 bounds. mapId(문자열)만 의존성에 넣어 sceneInfo
  // 객체가 갱신돼도 cameraPreset 참조가 바뀌지 않게 한다(위 주석의 reset 문제).
  const mapId = sceneInfo?.maps?.[0]?.id;
  const cameraPreset = useMemo(
    () => ({
      defaultPosition: cameraPosition,
      defaultTarget: cameraTarget,
      getTopViewBounds: () => {
        const map = mapId ? modelObjectRegistry.get(mapId) : undefined;
        return map ? new Box3().setFromObject(map) : null;
      },
    }),
    [cameraPosition, cameraTarget, mapId],
  );

  const focusOverlay =
    focusedModelId !== null ? (
      <Button
        variant="outline"
        size="sm"
        className="bg-background/85 border-border/70 pointer-events-auto absolute top-16 left-3 gap-1.5 shadow-sm backdrop-blur-sm"
        onClick={exitFocus}
      >
        <ArrowLeft className="size-4" />
        {t('monitoring:focus.back')}
      </Button>
    ) : null;

  const searchSlot = search ? (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5">
            <CalendarRange className="size-4" />
            <span className="font-mono text-xs">
              {formatRangeButtonLabel(search.viewingFrom, search.viewingTo)}
            </span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        }
      />
      <PopoverPopup align="start" className="w-72 p-3">
        <ReplaySearchForm
          bare
          draftFrom={search.draftFrom}
          draftTo={search.draftTo}
          onDraftFromChange={search.setDraftFrom}
          onDraftToChange={search.setDraftTo}
          onSearch={search.submitSearch}
          canSearch={search.canSearch}
          validationReason={search.validationReason}
          isLoading={search.isLoading}
          isError={search.isError}
          errorMessage={search.errorMessage}
        />
      </PopoverPopup>
    </Popover>
  ) : null;

  const replayControlsOverlay = (
    <ReplayPlayerControls
      className="pointer-events-auto absolute inset-x-0 top-0 z-30"
      searchSlot={searchSlot}
    />
  );

  if (isLoading) {
    return (
      <div
        ref={rootRef}
        className="relative h-full min-h-0 w-full bg-(--canvas-background)"
      />
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-0 w-full bg-(--canvas-background)"
    >
      <ThreeSceneViewer
        cameraPreset={cameraPreset}
        cameraClip={SCENE_CAMERA_CLIP}
        canvasProps={{
          gl: SCENE_GL_OPTIONS,
          shadows: sceneCanvasShadows(sceneInfo?.lighting),
          onPointerMissed: exitFocus,
        }}
        overlay={
          <>
            {/* 에셋 로드가 끝날 때까지 캔버스를 덮는다 — 부분 팝인 깜빡임 방지 */}
            <SceneLoadingOverlay ready={sceneReady} />
            {focusOverlay}
            {replayControlsOverlay}
          </>
        }
        onControllerReady={handleControllerReady}
      >
        <SceneLighting sceneInfo={sceneInfo} />
        <SceneSurfaceCamera
          regionId={regionId}
          environmentId={sceneInfo?.environmentId}
        />
        {/* 실시간 뷰와 같은 배경 — 없으면 실시간↔리플레이 전환에서 하늘만
            사라져 다른 씬처럼 보인다. 자체 Suspense라 EXR 로드가 리플레이
            재생을 붙잡지 않는다. */}
        <Suspense fallback={null}>
          <SceneEnvironment
            regionId={regionId}
            environmentId={sceneInfo?.environmentId}
          />
        </Suspense>
        <Suspense fallback={null}>
          <OutdoorWorkModelSimulation
            sceneInfo={sceneInfo}
            regionId={regionId}
            alarmsByCraneId={EMPTY_ALARMS}
            alarmHighlightMesh={false}
            mode="replay"
            onMoveTo={handleMoveTo}
            onResetCamera={handleResetCamera}
            getPose={handleGetPose}
          />
          <SceneReadyProbe onReady={handleSceneReady} />
        </Suspense>
      </ThreeSceneViewer>
    </div>
  );
}
