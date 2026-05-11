import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import { GoliathVisionPip } from './goliath-vision-pip';
import { LidarTile } from './vision/lidar-tile';
import { NoSignalSlot } from './vision/no-signal-slot';
import {
  CAMERA_CHANNELS,
  LIDAR_CHANNELS,
  type CameraChannel,
  type ExpandedView,
  type LidarSensorKey,
  type VisionSourceFilter,
} from './vision/types';
import { VisionTile } from './vision/vision-tile';
import {
  VisionGridControls,
  VisionSourceFilterControls,
  type GridSize,
} from './vision/vision-grid-controls';

const GRID_CLASS: Record<GridSize, string> = {
  1: 'grid-cols-1 grid-rows-1',
  2: 'grid-cols-2 grid-rows-2',
  3: 'grid-cols-3 grid-rows-3',
  4: 'grid-cols-4 grid-rows-4',
};

type VisionSlot =
  | { kind: 'camera'; channel: CameraChannel }
  | { kind: 'lidar'; sensor: LidarSensorKey; label: string };

function VisionMonitoringViewContent() {
  const { t } = useTranslation('goliath-crane');
  const [gridSize, setGridSize] = useState<GridSize>(2);
  const [expanded, setExpanded] = useState<ExpandedView>(null);
  const [sourceFilter, setSourceFilter] = useState<VisionSourceFilter>('all');

  const isFusionOnly = sourceFilter === 'lidar-fusion';

  const slots = useMemo<VisionSlot[]>(() => {
    const cameraSlots = CAMERA_CHANNELS.map(
      (channel) => ({ kind: 'camera', channel }) satisfies VisionSlot,
    );
    const individualLidarSlots = LIDAR_CHANNELS.filter(
      (ch) => ch.sensorKey !== 'fusion',
    ).map(
      (ch) =>
        ({
          kind: 'lidar',
          sensor: ch.sensorKey,
          label: ch.label,
        }) satisfies VisionSlot,
    );
    const fusionSlot: VisionSlot = {
      kind: 'lidar',
      sensor: 'fusion',
      label: 'Fusion',
    };
    if (sourceFilter === 'camera') return cameraSlots;
    if (sourceFilter === 'lidar') return individualLidarSlots;
    if (sourceFilter === 'lidar-fusion') return [fusionSlot];
    return [...cameraSlots, ...individualLidarSlots];
  }, [sourceFilter]);

  useEffect(() => {
    if (!expanded) return;
    if (sourceFilter === 'camera' && expanded.type === 'lidar') {
      setExpanded(null);
      return;
    }
    if (
      (sourceFilter === 'lidar' || sourceFilter === 'lidar-fusion') &&
      expanded.type === 'camera'
    ) {
      setExpanded(null);
    }
  }, [sourceFilter, expanded]);

  const effectiveGridSize: GridSize = isFusionOnly ? 1 : gridSize;
  const totalSlots = effectiveGridSize * effectiveGridSize;
  const cameraConnected = CAMERA_CHANNELS.filter((c) => c.connected).length;

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-border bg-card/50 relative z-20 flex shrink-0 items-center gap-3 border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <Camera className="size-4 text-orange-500" />
            <span className="text-foreground text-sm font-semibold">
              {t('vision.title')}
            </span>
            <span className="rounded-full bg-orange-500/15 px-1.5 py-px text-[9px] font-bold text-orange-500">
              BETA
            </span>
          </div>
          {sourceFilter !== 'lidar' && sourceFilter !== 'lidar-fusion' && (
            <span className="text-muted-foreground/70 text-[10px]">
              {t('vision.connectedCount', {
                connected: cameraConnected,
                total: CAMERA_CHANNELS.length,
              })}
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            <VisionSourceFilterControls
              value={sourceFilter}
              onChange={setSourceFilter}
            />
            {!isFusionOnly && (
              <VisionGridControls value={gridSize} onChange={setGridSize} />
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 p-3">
          <div
            className={`grid h-full w-full gap-2 ${GRID_CLASS[effectiveGridSize]}`}
          >
            {Array.from({ length: totalSlots }).map((_, index) => {
              const slot = slots[index];
              if (!slot) {
                return <NoSignalSlot key={`empty-${index}`} />;
              }
              if (slot.kind === 'lidar') {
                const isFusion = slot.sensor === 'fusion';
                const isActive =
                  !isFusion &&
                  expanded?.type === 'lidar' &&
                  expanded.sensor === slot.sensor;
                return (
                  <LidarTile
                    key={`lidar-${slot.sensor}`}
                    sensor={slot.sensor}
                    label={slot.label}
                    isActive={isActive}
                    fullView={isFusion && isFusionOnly}
                    onExpand={
                      isFusion
                        ? undefined
                        : () =>
                            setExpanded(
                              isActive
                                ? null
                                : { type: 'lidar', sensor: slot.sensor },
                            )
                    }
                  />
                );
              }
              const { channel } = slot;
              const isActive =
                expanded?.type === 'camera' && expanded.id === channel.id;
              return (
                <VisionTile
                  key={channel.id}
                  channel={channel}
                  isActive={isActive}
                  onExpand={() =>
                    setExpanded(
                      isActive ? null : { type: 'camera', id: channel.id },
                    )
                  }
                />
              );
            })}
          </div>
        </div>
      </div>

      <GoliathVisionPip
        expanded={expanded}
        channels={CAMERA_CHANNELS}
        onClose={() => setExpanded(null)}
      />
    </>
  );
}

export function VisionMonitoringView({ regionId }: { regionId: string }) {
  // regionId is used as key to remount when switching regions; future
  // per-region channel fetching will hook into this prop.
  return <VisionMonitoringViewContent key={regionId} />;
}
