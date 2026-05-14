import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonitoringLiveCrane } from '@crane/domain/monitoring';
import { useRegionActiveAlarmsByCraneId } from '@crane/features/alarm';
import { Monitoring3dView } from '@crane/features/3d';
import { useGoliathCraneData } from '@crane/features/goliath-crane';
import { Spinner } from '@crane/ui/atoms/spinner';
import { CraneStatusTable } from '@crane/widgets/crane';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@crane/ui/molecules/resizable';
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

function RealtimeMonitoringViewContent({ regionId }: { regionId: string }) {
  const { t } = useTranslation();
  const backendRegionId =
    regionId === 'goliath' ? GOLIATH_BACKEND_REGION_ID : regionId;
  const alarmsByCraneId = useRegionActiveAlarmsByCraneId(backendRegionId);
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);
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
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0">
      <ResizablePanel defaultSize={75} minSize={50}>
        <ResizablePanelGroup
          orientation="vertical"
          className="h-full min-h-0"
        >
          <ResizablePanel defaultSize={55} minSize={30}>
            <div className="relative h-full">
              {is3dViewLoading ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-xs">
                  <Spinner
                    className="size-6 text-orange-500"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-white">
                    {t('common:viewer3d.loading')}
                  </p>
                </div>
              ) : null}
              <Monitoring3dView
                regionId={regionId}
                alarmsByCraneId={alarmsByCraneId}
                onLoadingChange={setIs3dViewLoading}
                onFullscreenChange={handleFullscreenChange}
                onSensorSelect={handleSensorSelect}
                renderSensorFeed={renderSensorFeed}
                fullscreenTopRightOverlay={
                  <GoliathVisionPip
                    expanded={expanded}
                    channels={CAMERA_CHANNELS}
                    onClose={() => setExpanded(null)}
                  />
                }
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={45} minSize={25}>
            <CraneStatusTable
              cranes={GOLIATH_CRANES}
              tagDefinitionIds={GOLIATH_TAG_DEFINITION_IDS}
              regionId={GOLIATH_TABLE_REGION_ID}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={25} minSize={15}>
        <GoliathMetricsCompact crane={crane} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  return <RealtimeMonitoringViewContent key={regionId} regionId={regionId} />;
}
