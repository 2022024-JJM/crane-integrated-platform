import { useProgress } from '@react-three/drei';
import { Suspense, useEffect, useState } from 'react';
import { ThreeSceneViewer } from '@/shared/ui/organisms/three-scene-viewer';
import type { Vector3Tuple } from '@/shared/types/math';
import { OutdoorWorkModelSimulation } from './outdoor-work-model-simulation';

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [-65, 20, -10];
const DEFAULT_CAMERA_TARGET: Vector3Tuple = [-65, 0, -35];

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

interface OutdoorWork3dViewProps {
  onLoadingChange?: (isLoading: boolean) => void;
}

export function OutdoorWork3dView({ onLoadingChange }: OutdoorWork3dViewProps) {
  const [isSceneDataLoading, setIsSceneDataLoading] = useState(true);
  const [isSceneContentReady, setIsSceneContentReady] = useState(false);

  return (
    <ThreeSceneViewer
      cameraPreset={{
        defaultPosition: DEFAULT_CAMERA_POSITION,
        defaultTarget: DEFAULT_CAMERA_TARGET,
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
    </ThreeSceneViewer>
  );
}
