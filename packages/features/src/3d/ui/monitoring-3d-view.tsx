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
import type { AlarmSeverity } from '@crane/domain/alarm';
import { Button } from '@crane/ui/atoms/button';
import {
  ThreeSceneViewer,
  type SceneController,
} from '@crane/ui/organisms/three-scene-viewer';
import type { Vector3Tuple } from '@crane/core/types/math';
import { useObjectFocusStore } from '../model/use-object-focus-store';
import { OutdoorWorkModelSimulation, useSceneData } from './outdoor-work-model-simulation';
import { SceneEnvironment } from './scene-environment';
import {
  SCENE_CAMERA_CLIP,
  SCENE_GL_OPTIONS,
  SceneLighting,
} from './scene-render-preset';
import { SceneLoadingOverlay, SceneReadyProbe } from './scene-loading-overlay';
import type { SensorFeedRenderer } from './sensor-billboard';

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
  onSensorSelect?: (
    channelId: string,
    sensorType: 'camera' | 'lidar',
  ) => void;
  /**
   * 풀스크린 빌보드 호버 시 미니 썸네일 안에 렌더할 비전 피드 컴포넌트.
   * channel/sensorType에 맞는 실제 스트림 또는 placeholder를 반환하는 함수.
   */
  renderSensorFeed?: SensorFeedRenderer;
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
  onSensorSelect,
  renderSensorFeed,
}: Monitoring3dViewProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sceneControllerRef = useRef<SceneController | null>(null);
  const { sceneInfo, isLoading } = useSceneData(regionId, mode);
  const [sceneReady, setSceneReady] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const focusStack = useObjectFocusStore((s) => s.focusStack);
  const popFocus = useObjectFocusStore((s) => s.popFocus);
  const clearFocus = useObjectFocusStore((s) => s.clearFocus);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  const handleFullscreenChange = useCallback(
    (next: boolean) => {
      setIsFullscreen(next);
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

  const cameraPosition = sceneInfo?.camera?.position ?? DEFAULT_CAMERA_POSITION;
  const cameraTarget = sceneInfo?.camera?.target ?? DEFAULT_CAMERA_TARGET;
  // 인라인 리터럴로 넘기면 부모 리렌더마다 새 객체 → SceneControlsBridge의
  // 컨트롤러 재등록 effect가 재실행되며 reset()이 사용자 카메라를 초기
  // 위치로 되돌린다(알람 배너 등 잦은 리렌더 화면에서 실제 발생).
  const cameraPreset = useMemo(
    () => ({ defaultPosition: cameraPosition, defaultTarget: cameraTarget }),
    [cameraPosition, cameraTarget],
  );

  const focusOverlay =
    focusStack.length > 0 ? (
      <Button
        variant="outline"
        size="sm"
        className="bg-background/85 border-border/70 pointer-events-auto absolute top-3 left-3 gap-1.5 shadow-sm backdrop-blur-sm"
        onClick={popFocus}
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
          onPointerMissed: clearFocus,
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
        toolbarExtras={toolbarExtras}
        onFullscreenChange={handleFullscreenChange}
        onControllerReady={handleControllerReady}
      >
        <SceneLighting />
        {/* 배경 파노라마는 자체 Suspense — 4K EXR(수~십수 MB)이 씬(맵·모델)
            표시를 붙잡지 않고, 로드되는 대로 단색 배경을 대체한다 */}
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
            alarmsByCraneId={alarmsByCraneId}
            alarmHighlightMesh={alarmHighlightMesh}
            mode={mode}
            onMoveTo={handleMoveTo}
            onResetCamera={handleResetCamera}
            onSensorSelect={onSensorSelect}
            isFullscreen={isFullscreen}
            renderSensorFeed={renderSensorFeed}
          />
          {sceneExtras}
          <SceneReadyProbe onReady={handleSceneReady} />
        </Suspense>
      </ThreeSceneViewer>
    </div>
  );
}
