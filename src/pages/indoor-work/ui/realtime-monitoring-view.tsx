import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/shared/ui/molecules/resizable';
import { useState } from 'react';
import { useRegionRealtimeAlarms } from '@/features/alarm';
import { useMonitoringReplay } from '@/features/monitoring';
import { Monitoring3dView } from '@/features/3d';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { CraneStatusTable } from '@/widgets/crane';
import { AlarmPanel } from '@/widgets/alarm';

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  const { alarms, stats: alarmStats } = useRegionRealtimeAlarms(regionId);
  const { rows, latestFrameTimestamp, isLoading, isError, errorMessage, isEmpty } =
    useMonitoringReplay(regionId);
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
                onLoadingChange={setIs3dViewLoading}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40}>
            <CraneStatusTable
              rows={rows}
              latestFrameTimestamp={latestFrameTimestamp}
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
