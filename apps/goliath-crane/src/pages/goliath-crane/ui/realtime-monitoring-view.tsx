import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonitoringLiveCrane } from '@crane/domain/monitoring';
import { useRegionActiveAlarmsByCraneId } from '@crane/features/alarm';
import { Monitoring3dView, useCollisionGuardStore } from '@crane/features/3d';
import { useGoliathCraneData } from '@crane/features/goliath-crane';
import { Spinner } from '@crane/ui/atoms/spinner';
import { CraneStatusTable } from '@crane/widgets/crane';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@crane/ui/molecules/resizable';
import {
  GoliathCollisionGuardScene,
  GoliathCollisionGuardToggle,
} from './goliath-collision-guard';
import { GoliathCollisionGuardHud } from './goliath-collision-hud';
import { GoliathCollisionHelp } from './goliath-collision-help';
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
  // 성능 거버닝: 충돌 감지 ON 동안 DPR을 1.5로 클램프 — Retina에서
  // 프래그먼트 부하 ~44% 감소(발열 대책). 다크 스테이지라 체감 없음.
  const collisionGuardEnabled = useCollisionGuardStore((s) => s.enabled);

  const handleSensorSelect = useCallback(
    (channelId: string, sensorType: 'camera' | 'lidar') => {
      if (sensorType === 'lidar') {
        const lidarChannel = LIDAR_CHANNELS.find((c) => c.id === channelId);
        setExpanded({
          type: 'lidar',
          sensor: lidarChannel?.sensorKey ?? 'fusion',
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
                sceneExtras={<GoliathCollisionGuardScene />}
                toolbarExtras={<GoliathCollisionGuardToggle />}
                overlayExtras={
                  <>
                    <GoliathCollisionGuardHud />
                    <GoliathCollisionHelp />
                  </>
                }
                // OFF일 때 [1, 4] = 기기 네이티브 DPR 그대로 (최대 4 클램프)
                canvasDpr={collisionGuardEnabled ? [1, 1.5] : [1, 4]}
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
