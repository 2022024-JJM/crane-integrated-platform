import { useCallback, useState } from 'react';
import type { MonitoringLiveCrane } from '@crane/domain/monitoring';
import { useGoliathCraneData } from '@crane/features/goliath-crane';
import { RealtimeMonitoringView as RealtimeMonitoringViewBase } from '@crane/widgets/monitoring';
import { GoliathMetricsCompact } from './goliath-metrics-compact';
import { GoliathVisionPip } from './goliath-vision-pip';
import { renderSensorFeed } from './sensor-feed-renderer';
import {
  CAMERA_CHANNELS,
  LIDAR_CHANNELS,
  type ExpandedView,
} from './vision/types';

const GOLIATH_BACKEND_REGION_ID = 'dock-1';
const GOLIATH_TABLE_REGION_ID = 'dock-2';
const GOLIATH_CRANE_ID = 'C_171';
const GOLIATH_TAG_DEFINITION_IDS = [7, 8];
const GOLIATH_CRANES: MonitoringLiveCrane[] = [
  {
    craneId: GOLIATH_CRANE_ID,
    craneNo: 'GC-04',
    craneName: 'GC-04',
  },
];

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  const [expanded, setExpanded] = useState<ExpandedView>(null);
  const { crane } = useGoliathCraneData();

  const handleSensorSelect = useCallback(
    (channelId: string, sensorType: 'camera' | 'lidar') => {
      if (sensorType === 'lidar') {
        const lidarChannel = LIDAR_CHANNELS.find((c) => c.id === channelId);
        setExpanded({
          type: 'lidar',
          sensor: lidarChannel?.mode ?? 'fusion',
        });
        return;
      }
      const channel = CAMERA_CHANNELS.find((c) => c.id === channelId);
      if (!channel) return;
      setExpanded({ type: 'camera', id: channel.id });
    },
    [],
  );

  const handleFullscreenChange = useCallback((next: boolean) => {
    if (!next) setExpanded(null);
  }, []);

  return (
    <RealtimeMonitoringViewBase
      regionId={regionId}
      alarmRegionId={
        regionId === 'goliath' ? GOLIATH_BACKEND_REGION_ID : regionId
      }
      tableRegionId={GOLIATH_TABLE_REGION_ID}
      cranes={GOLIATH_CRANES}
      tagDefinitionIds={GOLIATH_TAG_DEFINITION_IDS}
      layout="horizontal-with-side"
      disableAlarmFeatures
      disableCmmsFocus
      sideSlot={<GoliathMetricsCompact crane={crane} />}
      extraTopRightOverlay={
        <GoliathVisionPip
          expanded={expanded}
          channels={CAMERA_CHANNELS}
          onClose={() => setExpanded(null)}
        />
      }
      onSensorSelect={handleSensorSelect}
      renderSensorFeed={renderSensorFeed}
      onFullscreenChange={handleFullscreenChange}
    />
  );
}
