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
import {
  modelObjectRegistry,
  resolveCameraBoundsMaps,
  resolveEnvironmentFileUrl,
  unionObjectBounds,
} from '@crane/domain/3d';
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
import { SceneFrameGovernor } from './scene-frame-governor';
import { SceneSurfaceCamera } from './scene-surface-camera';
import { SceneCameraLimits } from './scene-camera-limits';
import { SceneTerrainLod } from './scene-terrain-lod';
import {
  SCENE_CAMERA_CLIP,
  SCENE_GL_OPTIONS,
  SCENE_RAYCASTER_OPTIONS,
  SceneLighting,
} from './scene-render-preset';
import { sceneCanvasShadows } from '../lib/scene-shadow';
import { SceneLoadingOverlay, SceneReadyProbe } from './scene-loading-overlay';
import { ScenePerfHud } from './scene-perf-hud';
import { ScenePerfProbe } from './scene-perf-probe';
import { SceneWarmupIndicator } from './scene-warmup-indicator';
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
  // 탑뷰 fit 대상 = 카메라 영역 제한에 체크된 지도들의 합집합(없으면 모든
  // 지도) — SceneCameraLimits 와 같은 기준. id 목록을 이어 붙인 문자열만
  // 의존성에 넣어 sceneInfo 객체가 갱신돼도 cameraPreset 참조가 바뀌지 않게
  // 한다(위 주석의 reset 문제). 객체는 버튼을 누르는 시점에 레지스트리에서
  // 읽으므로 로드 타이밍과 무관하다.
  const cameraBoundsKey = resolveCameraBoundsMaps(sceneInfo?.maps)
    .map((m) => m.id)
    .join('|');
  const cameraPreset = useMemo(
    () => ({
      defaultPosition: cameraPosition,
      defaultTarget: cameraTarget,
      getTopViewBounds: () =>
        unionObjectBounds(
          cameraBoundsKey
            .split('|')
            .filter(Boolean)
            .map((id) => modelObjectRegistry.get(id)),
        ),
    }),
    [cameraPosition, cameraTarget, cameraBoundsKey],
  );

  // 좌측 상단 열(재생 컨트롤 바 아래) — 포커스 복귀 버튼 위, 후처리 상태 아래.
  const topLeftOverlay = (
    <div className="pointer-events-none absolute top-16 left-3 flex flex-col items-start gap-2">
      {focusedModelId !== null ? (
        <Button
          variant="outline"
          size="sm"
          className="bg-background/85 border-border/70 pointer-events-auto gap-1.5 shadow-sm backdrop-blur-sm"
          onClick={exitFocus}
        >
          <ArrowLeft className="size-4" />
          {t('monitoring:focus.back')}
        </Button>
      ) : null}
      <SceneWarmupIndicator />
    </div>
  );

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
          // BVH raycast 를 최근접 히트에서 조기 종료 — 프리셋 주석 참고.
          raycaster: SCENE_RAYCASTER_OPTIONS,
          shadows: sceneCanvasShadows(sceneInfo?.lighting),
          // 프레임은 SceneFrameGovernor 가 만든다(모니터링과 같은 규칙) —
          // 재생 중 30fps, 정지 프레임은 조작 invalidate 만.
          frameloop: 'demand',
          onPointerMissed: exitFocus,
        }}
        overlay={
          <>
            {/* 에셋 로드가 끝날 때까지 캔버스를 덮는다 — 부분 팝인 깜빡임 방지 */}
            <SceneLoadingOverlay ready={sceneReady} />
            {topLeftOverlay}
            {replayControlsOverlay}
            {/* dev 전용 성능 HUD(좌하단) — localStorage crane:perf-hud='1'
                일 때만 표시. 값은 Canvas 안 ScenePerfProbe 가 기록한다. */}
            <ScenePerfHud />
          </>
        }
        onControllerReady={handleControllerReady}
      >
        <SceneFrameGovernor
          animating={
            resolveEnvironmentFileUrl(regionId, sceneInfo?.environmentId) !==
            null
          }
          slow={sceneInfo?.lighting?.sunMode === 'solar'}
        />
        {/* 리플레이의 낮/밤은 프레임 타임스탬프를 따른다 — 기록된 그 시각의
            태양·그림자가 재현된다(solar 모드 씬 한정). */}
        <SceneLighting
          sceneInfo={sceneInfo}
          regionId={regionId}
          timeSource="replay"
        />
        <SceneSurfaceCamera
          regionId={regionId}
          environmentId={sceneInfo?.environmentId}
        />
        {/* 표면 카메라 바로 다음 — 같은 priority 의 useFrame 은 마운트 순서라
            표면 피벗 뒤에 이동 범위·바닥을 clamp 한다. */}
        <SceneCameraLimits sceneInfo={sceneInfo} />
        {/* 카메라 확정 뒤 지형 타일 LOD 전환 — 이 프레임의 최종 시점 기준. */}
        <SceneTerrainLod />
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
          <ScenePerfProbe />
        </Suspense>
      </ThreeSceneViewer>
    </div>
  );
}
