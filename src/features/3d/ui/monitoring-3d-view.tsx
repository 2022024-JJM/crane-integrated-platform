import { Suspense, useMemo, useRef, useState } from 'react';
import { ThreeSceneViewer } from '@/shared/ui/organisms/three-scene-viewer';
import type { Vector3Tuple } from '@/shared/types/math';
import type { MonitoringHoveredModel } from '../model/types';
import { MonitoringObjectHoverCard } from './monitoring-object-hover-card';
import { OutdoorWorkModelSimulation } from './outdoor-work-model-simulation';

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [-65, 20, -10];
const DEFAULT_CAMERA_TARGET: Vector3Tuple = [-65, 0, -35];

interface Monitoring3dViewProps {
  regionId: string;
  onLoadingChange?: (isLoading: boolean) => void;
}

export function Monitoring3dView({
  regionId,
  onLoadingChange,
}: Monitoring3dViewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [hoveredModel, setHoveredModel] =
    useState<MonitoringHoveredModel | null>(null);
  const overlay = useMemo(() => {
    if (!hoveredModel || !rootRef.current) {
      return null;
    }

    const rect = rootRef.current.getBoundingClientRect();

    return (
      <MonitoringObjectHoverCard
        model={hoveredModel.model}
        position={{
          x: hoveredModel.position.x - rect.left,
          y: hoveredModel.position.y - rect.top,
        }}
        containerSize={{
          width: rect.width,
          height: rect.height,
        }}
      />
    );
  }, [hoveredModel]);

  return (
    <div ref={rootRef} className="relative h-full min-h-0 w-full">
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
        overlay={overlay}
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
            onHoveredModelChange={setHoveredModel}
          />
        </Suspense>
      </ThreeSceneViewer>
    </div>
  );
}
