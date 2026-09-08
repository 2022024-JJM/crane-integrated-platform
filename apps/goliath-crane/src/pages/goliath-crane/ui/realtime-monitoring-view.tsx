import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegionActiveAlarmsByCraneId } from '@crane/features/alarm';
import { Monitoring3dView } from '@crane/features/3d';
import { useGoliathCraneData } from '@crane/features/goliath-crane';
import { Spinner } from '@crane/ui/atoms/spinner';
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

const GOLIATH_BACKEND_REGION_ID = 'dock-1';

function RealtimeMonitoringViewContent({ regionId }: { regionId: string }) {
  const { t } = useTranslation();
  const backendRegionId =
    regionId === 'goliath' ? GOLIATH_BACKEND_REGION_ID : regionId;
  const alarmsByCraneId = useRegionActiveAlarmsByCraneId(backendRegionId);
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);
  const { crane } = useGoliathCraneData();
  // DPR 클램프는 ThreeSceneViewer 기본값([1, 1.5])으로 일원화됐다 — 예전엔
  // 충돌 감지 ON일 때만 이 화면에서 [1, 1.5]로 조였었다.

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0">
      <ResizablePanel defaultSize={75} minSize={50}>
        <div className="relative h-full min-h-0">
          {is3dViewLoading ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-xs">
              <Spinner className="size-6 text-orange-500" aria-hidden="true" />
              <p className="text-sm font-medium text-white">
                {t('common:viewer3d.loading')}
              </p>
            </div>
          ) : null}
          <Monitoring3dView
            regionId={regionId}
            alarmsByCraneId={alarmsByCraneId}
            onLoadingChange={setIs3dViewLoading}
            sceneExtras={<GoliathCollisionGuardScene />}
            toolbarExtras={<GoliathCollisionGuardToggle />}
            overlayExtras={
              <>
                <GoliathCollisionGuardHud />
                <GoliathCollisionHelp />
              </>
            }
            toolbarLayout="dock"
          />
        </div>
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
