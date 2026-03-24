import { Suspense } from 'react';
import { ThreeSceneViewer } from '@/shared/ui/organisms/three-scene-viewer';
import type { Vector3Tuple } from '@/shared/types/math';
import { OutdoorWorkModelSimulation } from './outdoor-work-model-simulation';

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [-65, 20, -10];
const DEFAULT_CAMERA_TARGET: Vector3Tuple = [-65, 0, -35];

interface OutdoorWork3dViewProps {
  regionId: string;
  onLoadingChange?: (isLoading: boolean) => void;
}

export function OutdoorWork3dView({
  regionId,
  onLoadingChange,
}: OutdoorWork3dViewProps) {
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
      <ambientLight intensity={2} />
      <directionalLight
        position={[0, 50, 10]}
        color={'#ffffff'}
        intensity={5}
      />
      <Suspense fallback={null}>
        <OutdoorWorkModelSimulation
          regionId={regionId}
          onSceneDataLoadingChange={onLoadingChange}
        />
      </Suspense>
    </ThreeSceneViewer>
  );
}
