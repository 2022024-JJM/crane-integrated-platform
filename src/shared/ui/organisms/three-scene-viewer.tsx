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
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Button } from '@/shared/ui/atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/molecules/tooltip';
import type { Vector3Tuple } from '@/shared/types/math';

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
  showZoomIndicator?: boolean;
  onControllerReady?: (controller: SceneController | null) => void;
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
      applyCameraState(toVector3(position), toVector3(target), DEFAULT_CAMERA_UP);
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
  showZoomIndicator = true,
  onControllerReady,
}: ThreeSceneViewerProps) {
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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-0 w-full overflow-hidden"
    >
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
        <div className="pointer-events-none absolute inset-0 z-[2]">
          {overlay}
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
            <ToolbarButton
              label="확대"
              onClick={() => {
                controllerRef.current?.zoomIn();
              }}
            >
              <ZoomIn />
            </ToolbarButton>
            <ToolbarButton
              label="축소"
              onClick={() => {
                controllerRef.current?.zoomOut();
              }}
            >
              <ZoomOut />
            </ToolbarButton>
            <ToolbarButton
              label="원래 위치"
              onClick={() => {
                controllerRef.current?.reset();
              }}
            >
              <RotateCcw />
            </ToolbarButton>
            <ToolbarButton
              label="탑뷰"
              onClick={() => {
                controllerRef.current?.moveToTopView();
              }}
            >
              <Map />
            </ToolbarButton>
            <ToolbarButton
              label={isFullscreen ? '전체화면 복원' : '전체화면'}
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
