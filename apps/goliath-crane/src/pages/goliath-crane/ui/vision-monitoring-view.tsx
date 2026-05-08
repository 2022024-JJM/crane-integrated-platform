import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import { GoliathVisionPip } from './goliath-vision-pip';
import { LidarTile } from './vision/lidar-tile';
import { NoSignalSlot } from './vision/no-signal-slot';
import {
  CAMERA_CHANNELS,
  type CameraChannel,
  type ExpandedView,
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
  | { kind: 'lidar' };

function VisionMonitoringViewContent() {
  const { t } = useTranslation('goliath-crane');
  const [gridSize, setGridSize] = useState<GridSize>(2);
  const [expanded, setExpanded] = useState<ExpandedView>(null);
  const [sourceFilter, setSourceFilter] = useState<VisionSourceFilter>('all');

  const slots = useMemo<VisionSlot[]>(() => {
    const cameraSlots = CAMERA_CHANNELS.map(
      (channel) => ({ kind: 'camera', channel }) satisfies VisionSlot,
    );
    const lidarSlot: VisionSlot = { kind: 'lidar' };
    if (sourceFilter === 'camera') return cameraSlots;
    if (sourceFilter === 'lidar') return [lidarSlot];
    return [...cameraSlots, lidarSlot];
  }, [sourceFilter]);

  useEffect(() => {
    if (!expanded) return;
    if (sourceFilter === 'camera' && expanded.type === 'lidar') {
      setExpanded(null);
    } else if (sourceFilter === 'lidar' && expanded.type === 'camera') {
      setExpanded(null);
    }
  }, [sourceFilter, expanded]);

  const totalSlots = gridSize * gridSize;
  const cameraConnected = CAMERA_CHANNELS.filter((c) => c.connected).length;

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-border bg-card/50 flex shrink-0 items-center gap-3 border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <Camera className="size-4 text-orange-500" />
            <span className="text-foreground text-sm font-semibold">
              {t('vision.title')}
            </span>
            <span className="rounded-full bg-orange-500/15 px-1.5 py-px text-[9px] font-bold text-orange-500">
              BETA
            </span>
          </div>
          {sourceFilter !== 'lidar' && (
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
            <VisionGridControls value={gridSize} onChange={setGridSize} />
          </div>
        </div>

        <div className="min-h-0 flex-1 p-3">
          <div className={`grid h-full w-full gap-2 ${GRID_CLASS[gridSize]}`}>
            {Array.from({ length: totalSlots }).map((_, index) => {
              const slot = slots[index];
              if (!slot) {
                return <NoSignalSlot key={`empty-${index}`} />;
              }
              if (slot.kind === 'lidar') {
                const isActive = expanded?.type === 'lidar';
                return (
                  <LidarTile
                    key="lidar"
                    isActive={isActive}
                    onExpand={() =>
                      setExpanded(isActive ? null : { type: 'lidar' })
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
