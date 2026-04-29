import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import {
  Map,
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Button } from '../atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../molecules/tooltip';
import type { Vector3Tuple } from '@crane/core/types/math';

interface ThreeSceneViewerCameraPreset {
  defaultPosition: Vector3Tuple;
  defaultTarget: Vector3Tuple;
  topViewPosition?: Vector3Tuple;
  topViewTarget?: Vector3Tuple;
}

interface ThreeSceneViewerProps {
  cameraPreset: ThreeSceneViewerCameraPreset;
  canvasProps?: Omit<ComponentProps<typeof Canvas>, 'camera' | 'children'>;
  children: ReactNode;
  overlay?: ReactNode;
  fullscreenOverlay?: ReactNode;
  // 전체화면일 때 우측 상단(툴바 좌측 옆)에 떠있는 플로팅 슬롯. 도메인 무관.
  fullscreenTopRightOverlay?: ReactNode;
  // 우측 툴바 상단에 외부 버튼을 주입하는 슬롯. 도메인 무관.
  toolbarExtras?: ReactNode;
  showZoomIndicator?: boolean;
  onControllerReady?: (controller: SceneController | null) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export interface SceneController {
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  moveToTopView: () => void;
  moveTo: (position: Vector3Tuple, target: Vector3Tuple) => void;
}

interface SceneControlsBridgeProps {
  cameraPreset: ThreeSceneViewerCameraPreset;
  onControllerChange: (controller: SceneController | null) => void;
  onZoomPercentChange: (zoomPercent: number) => void;
}

const ZOOM_STEP = 1.2;
const MIN_CAMERA_DISTANCE = 1;
const DEFAULT_CAMERA_UP = new Vector3(0, 1, 0);
const TOP_VIEW_CAMERA_UP = new Vector3(0, 0, -1);

/**
 * 브라우저가 WebGL을 지원하는지 검사. 모듈 스코프에서 1회만 평가하고
 * 결과를 캐시하여 매 렌더 시 비용 없음.
 */
let cachedWebGLSupport: boolean | null = null;
function isWebGLSupported(): boolean {
  if (cachedWebGLSupport !== null) return cachedWebGLSupport;
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    cachedWebGLSupport = Boolean(gl);
  } catch {
    cachedWebGLSupport = false;
  }
  return cachedWebGLSupport;
}

function toVector3([x, y, z]: Vector3Tuple) {
  return new Vector3(x, y, z);
}

function SceneControlsBridge({
  cameraPreset,
  onControllerChange,
  onZoomPercentChange,
}: SceneControlsBridgeProps) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const defaultPosition = useMemo(
    () => toVector3(cameraPreset.defaultPosition),
    [cameraPreset.defaultPosition],
  );
  const defaultTarget = useMemo(
    () => toVector3(cameraPreset.defaultTarget),
    [cameraPreset.defaultTarget],
  );
  const defaultDistance = useMemo(() => {
    const distance = defaultPosition.distanceTo(defaultTarget);
    return distance > 0 ? distance : 1;
  }, [defaultPosition, defaultTarget]);
  const topViewTarget = useMemo(
    () => toVector3(cameraPreset.topViewTarget ?? cameraPreset.defaultTarget),
    [cameraPreset.defaultTarget, cameraPreset.topViewTarget],
  );
  const topViewPosition = useMemo(() => {
    if (cameraPreset.topViewPosition) {
      return toVector3(cameraPreset.topViewPosition);
    }

    return new Vector3(
      topViewTarget.x,
      topViewTarget.y + defaultDistance,
      topViewTarget.z,
    );
  }, [cameraPreset.topViewPosition, defaultDistance, topViewTarget]);

  const syncZoomPercent = useCallback(() => {
    const controls = controlsRef.current;

    if (!controls) {
      return;
    }

    const currentDistance = camera.position.distanceTo(controls.target);
    const zoomPercent = Math.max(
      1,
      Math.round((defaultDistance / Math.max(currentDistance, 0.0001)) * 100),
    );

    onZoomPercentChange(zoomPercent);
  }, [camera.position, defaultDistance, onZoomPercentChange]);

  const applyCameraState = useCallback(
    (position: Vector3, target: Vector3, up: Vector3) => {
      const controls = controlsRef.current;

      if (!controls) {
        return;
      }

      camera.position.copy(position);
      camera.up.copy(up);
      controls.target.copy(target);
      camera.lookAt(target);
      controls.update();
      invalidate();
      syncZoomPercent();
    },
    [camera, invalidate, syncZoomPercent],
  );

  const reset = useCallback(() => {
    applyCameraState(defaultPosition, defaultTarget, DEFAULT_CAMERA_UP);
  }, [applyCameraState, defaultPosition, defaultTarget]);

  const moveToTopView = useCallback(() => {
    applyCameraState(topViewPosition, topViewTarget, TOP_VIEW_CAMERA_UP);
  }, [applyCameraState, topViewPosition, topViewTarget]);

  const zoomByFactor = useCallback(
    (factor: number) => {
      const controls = controlsRef.current;

      if (!controls) {
        return;
      }

      const nextOffset = camera.position.clone().sub(controls.target);
      const nextDistance = Math.max(
        MIN_CAMERA_DISTANCE,
        nextOffset.length() * factor,
      );

      nextOffset.setLength(nextDistance);
      camera.position.copy(controls.target).add(nextOffset);
      controls.update();
      invalidate();
      syncZoomPercent();
    },
    [camera.position, invalidate, syncZoomPercent],
  );

  const zoomIn = useCallback(() => {
    zoomByFactor(1 / ZOOM_STEP);
  }, [zoomByFactor]);

  const zoomOut = useCallback(() => {
    zoomByFactor(ZOOM_STEP);
  }, [zoomByFactor]);

  const moveTo = useCallback(
    (position: Vector3Tuple, target: Vector3Tuple) => {
      applyCameraState(
        toVector3(position),
        toVector3(target),
        DEFAULT_CAMERA_UP,
      );
    },
    [applyCameraState],
  );

  useEffect(() => {
    const controls = controlsRef.current;

    if (!controls) {
      return;
    }

    const handleChange = () => {
      syncZoomPercent();
    };

    controls.addEventListener('change', handleChange);

    onControllerChange({
      reset,
      zoomIn,
      zoomOut,
      moveToTopView,
      moveTo,
    });

    reset();

    return () => {
      controls.removeEventListener('change', handleChange);
      onControllerChange(null);
    };
  }, [
    onControllerChange,
    reset,
    syncZoomPercent,
    zoomIn,
    zoomOut,
    moveToTopView,
    moveTo,
  ]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping={false}
      target={cameraPreset.defaultTarget}
    />
  );
}

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
}

function ToolbarButton({ label, onClick, children }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            className="bg-background/85 border-border/70 shadow-sm backdrop-blur-sm"
            aria-label={label}
          />
        }
        onClick={onClick}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ThreeSceneViewer({
  cameraPreset,
  canvasProps,
  children,
  overlay,
  fullscreenOverlay,
  fullscreenTopRightOverlay,
  toolbarExtras,
  showZoomIndicator = true,
  onControllerReady,
  onFullscreenChange,
}: ThreeSceneViewerProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const setController = useCallback(
    (controller: SceneController | null) => {
      controllerRef.current = controller;
      onControllerReady?.(controller);
    },
    [onControllerReady],
  );

  const toggleFullscreen = useCallback(async () => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    if (document.fullscreenElement === root) {
      await document.exitFullscreen();
      return;
    }

    await root.requestFullscreen();
  }, []);

  const onFullscreenChangeRef = useRef(onFullscreenChange);
  onFullscreenChangeRef.current = onFullscreenChange;

  useEffect(() => {
    const handleFullscreenChange = () => {
      const next = document.fullscreenElement === rootRef.current;
      setIsFullscreen(next);
      onFullscreenChangeRef.current?.(next);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const showSplitPanel = isFullscreen && fullscreenOverlay;
  const webglSupported = isWebGLSupported();

  if (!webglSupported) {
    return (
      <div
        ref={rootRef}
        role="alert"
        className="relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 overflow-hidden bg-muted/40 p-6 text-center"
      >
        <p className="text-sm font-semibold">
          {t('common:viewer3d.webglUnsupportedTitle', {
            defaultValue: '3D viewer is unavailable',
          })}
        </p>
        <p className="text-muted-foreground max-w-md text-xs">
          {t('common:viewer3d.webglUnsupportedDescription', {
            defaultValue:
              'WebGL is disabled or unsupported in this browser. Enable hardware acceleration or use a recent Chromium-based browser.',
          })}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-0 w-full overflow-hidden"
    >
      {/* 전체화면 + CMMS 패널 동시 표시 시 좌우 분할 레이아웃 */}
      <div className={showSplitPanel ? 'flex h-full w-full' : 'h-full w-full'}>
        {/* 3D 캔버스 영역 */}
        <div className={`relative ${showSplitPanel ? 'w-1/2 shrink-0' : 'h-full w-full'}`}>
          <Canvas
            {...canvasProps}
            camera={{ position: cameraPreset.defaultPosition }}
          >
            <SceneControlsBridge
              cameraPreset={cameraPreset}
              onControllerChange={setController}
              onZoomPercentChange={setZoomPercent}
            />
            {children}
          </Canvas>

          {overlay ? (
            <div className="pointer-events-none absolute inset-0 z-2">
              {overlay}
            </div>
          ) : null}
        </div>

        {/* CMMS 패널 (전체화면 시에만) */}
        {showSplitPanel ? (
          <div className="relative h-full w-1/2 shrink-0 overflow-hidden">
            {fullscreenOverlay}
          </div>
        ) : null}
      </div>

      {isFullscreen && fullscreenTopRightOverlay ? (
        <div className="pointer-events-auto absolute top-3 right-14 z-50">
          {fullscreenTopRightOverlay}
        </div>
      ) : null}

      <TooltipProvider delay={150}>
        <div className="pointer-events-none absolute top-3 right-3 z-[1] flex flex-col items-end gap-2">
          {showZoomIndicator ? (
            <div className="bg-background/85 text-foreground border-border/70 pointer-events-auto rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm">
              {zoomPercent}%
            </div>
          ) : null}

          <div className="pointer-events-auto flex flex-col gap-2">
            {toolbarExtras}
            <ToolbarButton
              label={t('common:viewer3d.zoomIn')}
              onClick={() => {
                controllerRef.current?.zoomIn();
              }}
            >
              <ZoomIn />
            </ToolbarButton>
            <ToolbarButton
              label={t('common:viewer3d.zoomOut')}
              onClick={() => {
                controllerRef.current?.zoomOut();
              }}
            >
              <ZoomOut />
            </ToolbarButton>
            <ToolbarButton
              label={t('common:viewer3d.resetView')}
              onClick={() => {
                controllerRef.current?.reset();
              }}
            >
              <RotateCcw />
            </ToolbarButton>
            <ToolbarButton
              label={t('common:viewer3d.topView')}
              onClick={() => {
                controllerRef.current?.moveToTopView();
              }}
            >
              <Map />
            </ToolbarButton>
            <ToolbarButton
              label={
                isFullscreen
                  ? t('common:viewer3d.exitFullscreen')
                  : t('common:viewer3d.fullscreen')
              }
              onClick={() => {
                void toggleFullscreen();
              }}
            >
              {isFullscreen ? <Minimize2 /> : <Maximize2 />}
            </ToolbarButton>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
