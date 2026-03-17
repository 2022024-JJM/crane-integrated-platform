import { useProgress } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useState } from 'react';
import { Vector3 } from 'three';
import { OutdoorWorkModelSimulation } from '../../simulation';

const DEFAULT_CAMERA_POSITION = new Vector3(-65, 20, -10);

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
}
