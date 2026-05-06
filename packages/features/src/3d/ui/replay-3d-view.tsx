import { ArrowLeft, CalendarRange, ChevronDown } from 'lucide-react';
import { Suspense, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@crane/ui/atoms/button';
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from '@crane/ui/molecules/popover';
import {
  ThreeSceneViewer,
  type SceneController,
} from '@crane/ui/organisms/three-scene-viewer';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  formatReplayTimestamp,
  type MonitoringReplayUiState,
} from '@crane/domain/monitoring';
import { useObjectFocusStore } from '../model/use-object-focus-store';
import { OutdoorWorkModelSimulation, useSceneData } from './outdoor-work-model-simulation';
import { ReplayPlayerControls } from './replay-player-controls';
import { ReplaySearchForm } from './replay-search-form';

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [-65, 20, -10];
const DEFAULT_CAMERA_TARGET: Vector3Tuple = [-65, 0, -35];

const EMPTY_ALARMS: Record<string, never> = {};

interface Replay3dViewProps {
  regionId: string;
  onLoadingChange?: (isLoading: boolean) => void;
  search?: MonitoringReplayUiState;
}

function formatRangeButtonLabel(
  viewingFrom: string,
  viewingTo: string,
): string {
  const from = formatReplayTimestamp(viewingFrom, 'datetime');
  const to = formatReplayTimestamp(viewingTo, 'time');
  if (from && to) return `${from} ~ ${to}`;
  return viewingFrom && viewingTo ? `${viewingFrom} ~ ${viewingTo}` : '';
}

export function Replay3dView({
  regionId,
  onLoadingChange,
  search,
}: Replay3dViewProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sceneControllerRef = useRef<SceneController | null>(null);
  const { sceneInfo, isLoading } = useSceneData(regionId, 'replay');
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
        className="bg-background/85 border-border/70 pointer-events-auto absolute top-16 left-3 gap-1.5 shadow-sm backdrop-blur-sm"
        onClick={popFocus}
      >
        <ArrowLeft className="size-4" />
        {t('monitoring:focus.back')}
      </Button>
    ) : null;

  const searchSlot = search ? (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5"
          >
            <CalendarRange className="size-4" />
            <span className="font-mono text-xs">
              {formatRangeButtonLabel(search.viewingFrom, search.viewingTo)}
            </span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        }
      />
      <PopoverPopup align="start" className="w-72 p-3">
        <ReplaySearchForm
          bare
          draftFrom={search.draftFrom}
          draftTo={search.draftTo}
          onDraftFromChange={search.setDraftFrom}
          onDraftToChange={search.setDraftTo}
          onSearch={search.submitSearch}
          canSearch={search.canSearch}
          validationReason={search.validationReason}
          isLoading={search.isLoading}
          isError={search.isError}
          errorMessage={search.errorMessage}
        />
      </PopoverPopup>
    </Popover>
  ) : null;

  const replayControlsOverlay = (
    <ReplayPlayerControls
      className="pointer-events-auto absolute inset-x-0 top-0 z-30"
      searchSlot={searchSlot}
    />
  );

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
        overlay={
          <>
            {focusOverlay}
            {replayControlsOverlay}
          </>
        }
        toolbarClassName="top-28"
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
            alarmsByCraneId={EMPTY_ALARMS}
            alarmHighlightMesh={false}
            mode="replay"
            onMoveTo={handleMoveTo}
            onResetCamera={handleResetCamera}
          />
        </Suspense>
      </ThreeSceneViewer>
    </div>
  );
}
