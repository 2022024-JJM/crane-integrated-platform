import { OrbitControls, useProgress } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import {
  Suspense,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Vector3 } from 'three';
import type { Viewer3dHandle } from '@/features/3d-model/viewer';
import { OutdoorWorkModelSimulation } from '@/features/3d-model/simulation';

const DEFAULT_CAMERA_POSITION = new Vector3(-65, 20, -10);
const DEFAULT_TARGET = new Vector3(-65, 0, -35);
const TOP_VIEW_CAMERA_POSITION = new Vector3(-65, 92, -35);
const DEFAULT_CAMERA_DISTANCE =
  DEFAULT_CAMERA_POSITION.distanceTo(DEFAULT_TARGET);

interface ViewportControllerProps {
  onReady: (controls: OrbitControlsImpl) => void;
  onZoomChange?: (zoomPercent: number) => void;
}

interface OutdoorWork3dViewProps {
  onLoadingChange?: (isLoading: boolean) => void;
  onZoomChange?: (zoomPercent: number) => void;
}

function getZoomPercent(controls: OrbitControlsImpl) {
  const distance = controls.object.position.distanceTo(controls.target);
  const percent = Math.round((DEFAULT_CAMERA_DISTANCE / distance) * 100);

  return Math.max(40, Math.min(300, percent));
}

function ViewportController({
  onReady,
  onZoomChange,
}: ViewportControllerProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const onReadyRef = useRef(onReady);
  const onZoomChangeRef = useRef(onZoomChange);
  const { camera } = useThree();

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  useEffect(() => {
    const controls = controlsRef.current;

    if (!controls) {
      return;
    }

    camera.position.copy(DEFAULT_CAMERA_POSITION);
    controls.target.copy(DEFAULT_TARGET);
    controls.update();
    onReadyRef.current(controls);
    onZoomChangeRef.current?.(getZoomPercent(controls));

    const handleChange = () => {
      onZoomChangeRef.current?.(getZoomPercent(controls));
    };

    controls.addEventListener('change', handleChange);

    return () => {
      controls.removeEventListener('change', handleChange);
    };
  }, [camera]);

  return <OrbitControls ref={controlsRef} enableDamping={false} />;
}

interface LoadingStateBridgeProps {
  isSceneContentReady: boolean;
  isSceneDataLoading: boolean;
  onLoadingChange?: (isLoading: boolean) => void;
}

function LoadingStateBridge({
  isSceneContentReady,
  isSceneDataLoading,
  onLoadingChange,
}: LoadingStateBridgeProps) {
  const { active } = useProgress();

  useEffect(() => {
    onLoadingChange?.(isSceneDataLoading || active || !isSceneContentReady);
  }, [active, isSceneContentReady, isSceneDataLoading, onLoadingChange]);

  return null;
}

function SceneContentReadyBridge({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return null;
}

export const OutdoorWork3dView = forwardRef<
  Viewer3dHandle,
  OutdoorWork3dViewProps
>(function OutdoorWork3dView({ onLoadingChange, onZoomChange }, ref) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [, setIsTopView] = useState(false);
  const [isSceneDataLoading, setIsSceneDataLoading] = useState(true);
  const [isSceneContentReady, setIsSceneContentReady] = useState(false);

  useImperativeHandle(ref, () => ({
    resetView: () => {
      const controls = controlsRef.current;

      if (!controls) {
        return;
      }

      controls.object.position.copy(DEFAULT_CAMERA_POSITION);
      controls.target.copy(DEFAULT_TARGET);
      controls.update();
      onZoomChange?.(getZoomPercent(controls));
      setIsTopView(false);
    },
    zoomIn: () => {
      const controls = controlsRef.current;

      if (!controls) {
        return;
      }

      const direction = new Vector3()
        .subVectors(controls.target, controls.object.position)
        .normalize()
        .multiplyScalar(8);

      controls.object.position.add(direction);
      controls.update();
      onZoomChange?.(getZoomPercent(controls));
    },
    zoomOut: () => {
      const controls = controlsRef.current;

      if (!controls) {
        return;
      }

      const direction = new Vector3()
        .subVectors(controls.object.position, controls.target)
        .normalize()
        .multiplyScalar(8);

      controls.object.position.add(direction);
      controls.update();
      onZoomChange?.(getZoomPercent(controls));
    },
    toggleTopView: () => {
      const controls = controlsRef.current;

      if (!controls) {
        return;
      }

      setIsTopView((prev) => {
        const next = !prev;

        controls.object.position.copy(
          next ? TOP_VIEW_CAMERA_POSITION : DEFAULT_CAMERA_POSITION,
        );
        controls.target.copy(DEFAULT_TARGET);
        controls.update();
        onZoomChange?.(getZoomPercent(controls));

        return next;
      });
    },
  }));

  return (
    <Canvas
      camera={{ position: DEFAULT_CAMERA_POSITION.toArray() }}
      gl={{
        toneMapping: 0,
        powerPreference: 'high-performance',
        alpha: false,
        antialias: true,
        stencil: false,
        autoClear: false,
        depth: true,
      }}
    >
      <LoadingStateBridge
        isSceneContentReady={isSceneContentReady}
        isSceneDataLoading={isSceneDataLoading}
        onLoadingChange={onLoadingChange}
      />
      <ambientLight intensity={2} />
      <directionalLight
        position={[0, 50, 10]}
        color={'#ffffff'}
        intensity={5}
      />
      <ViewportController
        onReady={(controls) => {
          controlsRef.current = controls;
        }}
        onZoomChange={onZoomChange}
      />
      <Suspense fallback={null}>
        <OutdoorWorkModelSimulation
          onSceneDataLoadingChange={(isLoading) => {
            setIsSceneDataLoading(isLoading);

            if (isLoading) {
              setIsSceneContentReady(false);
            }
          }}
        />
        {!isSceneDataLoading ? (
          <SceneContentReadyBridge
            onReady={() => {
              setIsSceneContentReady(true);
            }}
          />
        ) : null}
      </Suspense>
    </Canvas>
  );
});
