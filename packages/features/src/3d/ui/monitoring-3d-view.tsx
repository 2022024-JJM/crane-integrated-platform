import { ArrowLeft } from 'lucide-react';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Box3 } from 'three';
import { modelObjectRegistry } from '@crane/domain/3d';
import type { AlarmSeverity } from '@crane/domain/alarm';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { SCENE_TOOLBAR_BUTTON_CLASS } from '@crane/ui/molecules/scene-toolbar-button';
import {
  ThreeSceneViewer,
  type SceneController,
} from '@crane/ui/organisms/three-scene-viewer';
import type { Vector3Tuple } from '@crane/core/types/math';
import { useObjectFocusStore } from '../model/use-object-focus-store';
import { useSceneDock } from '../model/use-scene-dock';
import { useTagBindingSource } from '../model/use-tag-binding-source';
import { RigDriver } from './rig-driver';
import {
  OutdoorWorkModelSimulation,
  useSceneData,
} from './outdoor-work-model-simulation';
import { SceneEnvironment } from './scene-environment';
import { SceneSurfaceCamera } from './scene-surface-camera';
import {
  SCENE_CAMERA_CLIP,
  SCENE_GL_OPTIONS,
  SceneLighting,
} from './scene-render-preset';
import { sceneCanvasShadows } from '../lib/scene-shadow';
import { SceneLoadingOverlay, SceneReadyProbe } from './scene-loading-overlay';
import { SceneSimulationToggle } from './scene-simulation-toggle';
import { SceneViewBookmarks } from './scene-view-bookmarks';

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [-65, 20, -10];
const DEFAULT_CAMERA_TARGET: Vector3Tuple = [-65, 0, -35];

interface Monitoring3dViewProps {
  regionId: string;
  alarmsByCraneId?: Record<string, AlarmSeverity>;
  alarmHighlightMesh?: boolean;
  mode?: 'simulation' | 'replay' | 'realtime';
  onLoadingChange?: (isLoading: boolean) => void;
  fullscreenOverlay?: ReactNode;
  fullscreenTopRightOverlay?: ReactNode;
  fullscreenTopCenterOverlay?: ReactNode;
  toolbarExtras?: ReactNode;
  /**
   * Canvas 안에 추가로 마운트할 씬 콘텐츠(R3F 노드). 충돌 감지 레이어처럼
   * 페이지별 3D 확장 기능을 도메인 씬과 독립적으로 주입할 때 사용.
   */
  sceneExtras?: ReactNode;
  /**
   * Canvas 위에 겹치는 DOM 오버레이 (충돌 감지 HUD 등). ThreeSceneViewer의
   * overlay 슬롯(fullscreen 루트 내부)으로 합성되므로 전체화면에서도
   * 유지된다. 컨테이너가 pointer-events-none이라 orbit 조작을 막지 않는다.
   */
  overlayExtras?: ReactNode;
  /**
   * 렌더 해상도(DPR) 오버라이드 — 성능 거버닝용. r3f Canvas는 리렌더마다
   * 자신의 dpr prop을 재적용하므로, 내부에서 setDpr로 바꾸는 대신 이 prop을
   * 상태에 따라 바꿔야 안정적으로 반영된다. undefined면 기기 기본값.
   */
  canvasDpr?: number | [number, number];
  onFullscreenChange?: (isFullscreen: boolean) => void;
  /**
   * 조작 UI 배치. 'top-right'(기본)는 우측 상단 툴바(대시보드 미리보기 등
   * 작은 뷰). 'dock' 은 hover 펼침·고정 가능한 우측 독 레일 — 카메라
   * 버튼·toolbarExtras·북마크·시뮬레이션 토글. 독은 전체화면 루트 안이라
   * 전체화면에서도 같은 구성이 유지된다 (실시간 모니터링 화면).
   * 'none' 은 조작 UI 없이 씬만 보여준다 (대시보드 미리보기 모달).
   */
  toolbarLayout?: 'top-right' | 'dock' | 'none';
}

const EMPTY_ALARMS: Record<string, AlarmSeverity> = {};

export function Monitoring3dView({
  regionId,
  alarmsByCraneId = EMPTY_ALARMS,
  alarmHighlightMesh = false,
  mode = 'simulation',
  onLoadingChange,
  fullscreenOverlay,
  fullscreenTopRightOverlay,
  fullscreenTopCenterOverlay,
  toolbarExtras,
  sceneExtras,
  overlayExtras,
  canvasDpr,
  onFullscreenChange,
  toolbarLayout = 'top-right',
}: Monitoring3dViewProps) {
  const { t } = useTranslation();
  const isDock = toolbarLayout === 'dock';
  // 독 상태는 여기서 소유한다 — 앱 페이지에 두면 페이지 리렌더가 cameraPreset
  // 참조를 흔들어 카메라가 리셋되는 사고(아래 주석)로 이어진다.
  const toolsDock = useSceneDock('tools');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sceneControllerRef = useRef<SceneController | null>(null);
  const { sceneInfo, isLoading } = useSceneData(regionId, mode);
  // 태그 값 버스(가상 태그·WebSocket·리플레이) → 씬 맵핑 → 값 저장소. 드라이버는
  // Canvas 안(RigDriver)에서 매 프레임 노드에 적용한다.
  useTagBindingSource(sceneInfo, true);
  const [sceneReady, setSceneReady] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const focusedModelId = useObjectFocusStore((s) => s.focusedModelId);
  const exitFocus = useObjectFocusStore((s) => s.exitFocus);

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  const handleFullscreenChange = useCallback(
    (next: boolean) => {
      onFullscreenChange?.(next);
    },
    [onFullscreenChange],
  );

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

  const cameraPosition = sceneInfo?.camera?.position ?? DEFAULT_CAMERA_POSITION;
  const cameraTarget = sceneInfo?.camera?.target ?? DEFAULT_CAMERA_TARGET;
  // 인라인 리터럴로 넘기면 부모 리렌더마다 새 객체 → SceneControlsBridge의
  // 컨트롤러 재등록 effect가 재실행되며 reset()이 사용자 카메라를 초기
  // 위치로 되돌린다(알람 배너 등 잦은 리렌더 화면에서 실제 발생).
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
        className={cn(
          SCENE_TOOLBAR_BUTTON_CLASS,
          'pointer-events-auto absolute top-3 left-3 gap-1.5',
        )}
        onClick={exitFocus}
      >
        <ArrowLeft className="size-4" />
        {t('monitoring:focus.back')}
      </Button>
    ) : null;

  if (isLoading) {
    return (
      <div
        ref={rootRef}
        className="relative h-full min-h-0 w-full bg-(--canvas-background)"
      />
    );
  }

  const dockRight = isDock
    ? {
        label: t('common:viewer3d.dockTools', { defaultValue: '화면 조작' }),
        expanded: toolsDock.expanded,
        pinned: toolsDock.pinned,
        onPinnedChange: toolsDock.setPinned,
        handlers: toolsDock.handlers,
      }
    : undefined;

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-0 w-full bg-(--canvas-background)"
    >
      <ThreeSceneViewer
        cameraPreset={cameraPreset}
        cameraClip={SCENE_CAMERA_CLIP}
        canvasProps={{
          dpr: canvasDpr,
          gl: SCENE_GL_OPTIONS,
          shadows: sceneCanvasShadows(sceneInfo?.lighting),
          onPointerMissed: exitFocus,
        }}
        overlay={
          <>
            {/* 에셋 로드가 끝날 때까지 캔버스를 덮는다 — 부분 팝인 깜빡임 방지 */}
            <SceneLoadingOverlay ready={sceneReady} />
            {focusOverlay}
            {overlayExtras}
          </>
        }
        fullscreenOverlay={fullscreenOverlay}
        fullscreenTopRightOverlay={fullscreenTopRightOverlay}
        fullscreenTopCenterOverlay={fullscreenTopCenterOverlay}
        toolbarExtras={
          isDock ? (
            // 독 레일에는 페이지가 준 버튼 뒤에 시뮬레이션 재생 토글을 붙인다
            // (실시간 모니터링 화면 공통). 작은 뷰(top-right)에는 두지 않는다.
            <>
              {toolbarExtras}
              <SceneSimulationToggle />
            </>
          ) : (
            toolbarExtras
          )
        }
        toolbarPlacement={toolbarLayout}
        dockRight={dockRight}
        toolbarTrailing={
          toolbarLayout === 'none' ? undefined : (
            <SceneViewBookmarks
              regionId={regionId}
              variant={isDock ? 'rail' : 'toolbar'}
              getPose={handleGetPose}
              onMoveTo={handleMoveTo}
            />
          )
        }
        onFullscreenChange={handleFullscreenChange}
        onControllerReady={handleControllerReady}
      >
        <SceneLighting sceneInfo={sceneInfo} />
        <SceneSurfaceCamera
          regionId={regionId}
          environmentId={sceneInfo?.environmentId}
        />
        {/* 배경 파노라마는 자체 Suspense — 4K EXR(수~십수 MB)이 씬(맵·모델)
            표시를 붙잡지 않고, 로드되는 대로 단색 배경을 대체한다 */}
        <Suspense fallback={null}>
          <SceneEnvironment
            regionId={regionId}
            environmentId={sceneInfo?.environmentId}
          />
        </Suspense>
        <Suspense fallback={null}>
          <RigDriver sceneInfo={sceneInfo} />
          <OutdoorWorkModelSimulation
            sceneInfo={sceneInfo}
            regionId={regionId}
            alarmsByCraneId={alarmsByCraneId}
            alarmHighlightMesh={alarmHighlightMesh}
            mode={mode}
            onMoveTo={handleMoveTo}
            onResetCamera={handleResetCamera}
            getPose={handleGetPose}
          />
          {sceneExtras}
          <SceneReadyProbe onReady={handleSceneReady} />
        </Suspense>
      </ThreeSceneViewer>
    </div>
  );
}
