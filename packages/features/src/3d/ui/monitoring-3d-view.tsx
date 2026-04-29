import { ArrowLeft } from 'lucide-react';
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
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
  toolbarExtras?: ReactNode;
  onFullscreenChange?: (isFullscreen: boolean) => void;
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
  toolbarExtras,
  onFullscreenChange,
}: Monitoring3dViewProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sceneControllerRef = useRef<SceneController | null>(null);
  const { sceneInfo, isLoading } = useSceneData(regionId, mode);
  const focusStack = useObjectFocusStore((s) => s.focusStack);
  const popFocus = useObjectFocusStore((s) => s.popFocus);
  const clearFocus = useObjectFocusStore((s) => s.clearFocus);

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

  const cameraPosition = sceneInfo?.camera?.position ?? DEFAULT_CAMERA_POSITION;
  const cameraTarget = sceneInfo?.camera?.target ?? DEFAULT_CAMERA_TARGET;

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
        cameraPreset={{
          defaultPosition: cameraPosition,
          defaultTarget: cameraTarget,
        }}
        canvasProps={{
          gl: {
            toneMapping: 0,
            powerPreference: 'high-performance',
            alpha: false,
            antialias: true,
            stencil: false,
            autoClear: false,
            depth: true,
          },
          onPointerMissed: clearFocus,
        }}
        overlay={focusOverlay}
        fullscreenOverlay={fullscreenOverlay}
        fullscreenTopRightOverlay={fullscreenTopRightOverlay}
        toolbarExtras={toolbarExtras}
        onFullscreenChange={onFullscreenChange}
        onControllerReady={handleControllerReady}
      >
        <ambientLight intensity={2} />
        <directionalLight
          position={[0, 50, 10]}
          color={'#ffffff'}
          intensity={4}
        />
        <Suspense fallback={null}>
          <OutdoorWorkModelSimulation
            sceneInfo={sceneInfo}
            regionId={regionId}
            alarmsByCraneId={alarmsByCraneId}
            alarmHighlightMesh={alarmHighlightMesh}
            mode={mode}
            onMoveTo={handleMoveTo}
            onResetCamera={handleResetCamera}
          />
        </Suspense>
      </ThreeSceneViewer>
    </div>
  );
}
