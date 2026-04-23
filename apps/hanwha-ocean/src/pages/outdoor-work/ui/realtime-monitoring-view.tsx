import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCraneById, getCraneIdsByRegion } from '@crane/domain/crane';
import type { MonitoringLiveCrane } from '@crane/domain/monitoring';
import { useRegionActiveAlarmsByCraneId } from '@crane/features/alarm';
import {
  Monitoring3dView,
  useCraneIdFromFocusedModel,
  useObjectFocusStore,
} from '@crane/features/3d';
import { Spinner } from '@crane/ui/atoms/spinner';
import { CraneStatusTable } from '@crane/widgets/crane';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@crane/ui/molecules/resizable';
import { CraneCmmsDetailPanel } from '@crane/widgets/crane';

function RealtimeMonitoringViewContent({ regionId }: { regionId: string }) {
  const { t } = useTranslation();
  const alarmsByCraneId = useRegionActiveAlarmsByCraneId(regionId);
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);
  const { craneId, craneName } = useCraneIdFromFocusedModel(regionId);
  const clearFocus = useObjectFocusStore((state) => state.clearFocus);
  const isCmmsOpen = craneId !== null;
  const cranes = useMemo<MonitoringLiveCrane[]>(
    () =>
      getCraneIdsByRegion(regionId).map((currentCraneId) => {
        const crane = getCraneById(currentCraneId);

        return {
          craneId: currentCraneId,
          craneNo: crane?.craneNo ?? currentCraneId,
          craneName: crane?.craneName,
        };
      }),
    [regionId],
  );
  const fullscreenCmmsOverlay = isCmmsOpen ? (
    <CraneCmmsDetailPanel
      key={craneId}
      craneId={craneId}
      craneName={craneName ?? craneId}
      onClose={clearFocus}
    />
  ) : null;

  return (
    <ResizablePanelGroup orientation="vertical" className="h-full min-h-0">
      <ResizablePanel defaultSize={60}>
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
            mode="realtime"
            onLoadingChange={setIs3dViewLoading}
            fullscreenOverlay={fullscreenCmmsOverlay}
          />
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={40}>
        <CraneStatusTable cranes={cranes} regionId={regionId} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  return <RealtimeMonitoringViewContent key={regionId} regionId={regionId} />;
}
