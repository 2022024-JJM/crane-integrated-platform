import { useMemo, useState } from 'react';
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
import {
  GoliathCollisionGuardScene,
  GoliathCollisionGuardToggle,
} from './goliath-collision-guard';
import { GoliathCollisionGuardHud } from './goliath-collision-hud';
import { GoliathCollisionHelp } from './goliath-collision-help';
import { GoliathMetricsCompact } from './goliath-metrics-compact';

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
  const { crane } = useGoliathCraneData();
  // DPR 클램프는 ThreeSceneViewer 기본값([1, 1.5])으로 일원화됐다 — 예전엔
  // 충돌 감지 ON일 때만 이 화면에서 [1, 1.5]로 조였었다.

  // 크레인 실시간 상태 테이블은 3D 뷰의 하단 독 탭으로 — 전체화면 루트 안에
  // 있어야 전체화면에서도 보인다. 오른쪽 게이지 레일은 이번 개편 범위 밖이라
  // 기존 가로 분할을 유지한다 (후속에 독 탭으로 흡수할 수 있다).
  const dockPanels = useMemo(
    () => [
      {
        id: 'crane-status',
        label: t('common:craneStatus.title'),
        content: (
          <CraneStatusTable
            cranes={GOLIATH_CRANES}
            tagDefinitionIds={GOLIATH_TAG_DEFINITION_IDS}
            regionId={GOLIATH_TABLE_REGION_ID}
            hideTitle
          />
        ),
      },
    ],
    [t],
  );

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
            dockPanels={dockPanels}
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
