import { ArrowLeft } from 'lucide-react';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AlarmSeverity } from '@/entities/alarm';
import type { SavedCameraInfo } from '@/entities/3d';
import { Button } from '@/shared/ui/atoms/button';
import { ThreeSceneViewer } from '@/shared/ui/organisms/three-scene-viewer';
import type { Vector3Tuple } from '@/shared/types/math';
import { useObjectFocusStore } from '../model/use-object-focus-store';
import type { MonitoringHoveredModel } from '../model/types';
import { MonitoringObjectHoverCard } from './monitoring-object-hover-card';
import { OutdoorWorkModelSimulation } from './outdoor-work-model-simulation';

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [-65, 20, -10];
const DEFAULT_CAMERA_TARGET: Vector3Tuple = [-65, 0, -35];

interface Monitoring3dViewProps {
  regionId: string;
  alarmsByCraneId?: Record<string, AlarmSeverity>;
  alarmHighlightMesh?: boolean;
  onLoadingChange?: (isLoading: boolean) => void;
}

const EMPTY_ALARMS: Record<string, AlarmSeverity> = {};

export function Monitoring3dView({
  regionId,
  alarmsByCraneId = EMPTY_ALARMS,
  alarmHighlightMesh = false,
  onLoadingChange,
}: Monitoring3dViewProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [hoveredModel, setHoveredModel] =
    useState<MonitoringHoveredModel | null>(null);
  const [savedCamera, setSavedCamera] = useState<SavedCameraInfo | null>(null);
  const focusedModelId = useObjectFocusStore((s) => s.focusedModelId);
  const clearFocus = useObjectFocusStore((s) => s.clearFocus);

  const handleCameraInfoChange = useCallback(
    (camera: SavedCameraInfo | null) => {
      setSavedCamera(camera);
    },
    [],
  );

  const cameraPosition = savedCamera?.position ?? DEFAULT_CAMERA_POSITION;
  const cameraTarget = savedCamera?.target ?? DEFAULT_CAMERA_TARGET;
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
            alarmsByCraneId={alarmsByCraneId}
            alarmHighlightMesh={alarmHighlightMesh}
            onSceneDataLoadingChange={onLoadingChange}
            onHoveredModelChange={setHoveredModel}
            onCameraInfoChange={handleCameraInfoChange}
          />
        </Suspense>
      </ThreeSceneViewer>

      {focusedModelId ? (
        <Button
          variant="outline"
          size="sm"
          className="bg-background/85 border-border/70 absolute top-3 left-3 z-1 gap-1.5 shadow-sm backdrop-blur-sm"
          onClick={clearFocus}
        >
          <ArrowLeft className="size-4" />
          {t('monitoring:focus.back')}
        </Button>
      ) : null}
    </div>
  );
}
