import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/shared/ui/molecules/resizable';
import { useState } from 'react';
import {
  useRegionRealtimeAlarms,
  useRegionActiveAlarmsByCraneId,
} from '@/features/alarm';
import {
  useMonitoringReplay,
  useMonitoringReplaySearch,
} from '@/features/monitoring';
import { Monitoring3dView } from '@/features/3d';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { CraneStatusTable } from '@/widgets/crane';
import { AlarmPanel } from '@/widgets/alarm';

function RealtimeMonitoringViewContent({ regionId }: { regionId: string }) {
  const { alarms, stats: alarmStats } = useRegionRealtimeAlarms(regionId);
  const alarmsByCraneId = useRegionActiveAlarmsByCraneId(regionId);
  const {
    draftFrom,
    draftTo,
    setDraftFrom,
    setDraftTo,
    submitSearch,
    canSearch,
    validationReason,
    viewingFrom,
    viewingTo,
    query,
  } = useMonitoringReplaySearch(regionId);
  const { rows, isLoading, isError, errorMessage, isEmpty } =
    useMonitoringReplay({
      regionId,
      from: query.from,
      to: query.to,
      interval: query.interval,
    });
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0">
      <ResizablePanel defaultSize={75} minSize={50}>
        <ResizablePanelGroup orientation="vertical" className="min-h-0">
          <ResizablePanel defaultSize={60}>
            <div className="relative h-full bg-[rgba(43,43,43)]">
              {is3dViewLoading ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-xs">
                  <Spinner
                    className="size-6 text-orange-500"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-white">
                    3D 화면 불러오는 중
                  </p>
                </div>
              ) : null}
              <Monitoring3dView
                regionId={regionId}
                alarmsByCraneId={alarmsByCraneId}
                alarmHighlightMesh
                onLoadingChange={setIs3dViewLoading}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40}>
            <CraneStatusTable
              rows={rows}
              searchFrom={draftFrom}
              searchTo={draftTo}
              viewingFrom={viewingFrom}
              viewingTo={viewingTo}
              isSearchDisabled={!canSearch || isLoading}
              validationReason={validationReason}
              onSearchFromChange={setDraftFrom}
              onSearchToChange={setDraftTo}
              onSearch={submitSearch}
              isLoading={isLoading}
              isError={isError}
              errorMessage={errorMessage}
              isEmpty={isEmpty}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={25} minSize={15}>
        <AlarmPanel stats={alarmStats} alarms={alarms} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  return <RealtimeMonitoringViewContent key={regionId} regionId={regionId} />;
}
