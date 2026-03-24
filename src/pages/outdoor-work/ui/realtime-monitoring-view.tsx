import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/shared/ui/molecules/resizable';
import { useState } from 'react';
import { OutdoorWork3dView } from '@/features/3d';
import { getCranesByRegion } from '@/entities/crane';
import { getAlarmsByRegion, getAlarmStatsByRegion } from '@/entities/alarm';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { CraneStatusTable } from '@/widgets/crane';
import { AlarmPanel } from '@/widgets/alarm';

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  const cranes = getCranesByRegion(regionId);
  const alarms = getAlarmsByRegion(regionId);
  const alarmStats = getAlarmStatsByRegion(regionId);
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
              <OutdoorWork3dView
                regionId={regionId}
                onLoadingChange={setIs3dViewLoading}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40}>
            <CraneStatusTable cranes={cranes} />
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
