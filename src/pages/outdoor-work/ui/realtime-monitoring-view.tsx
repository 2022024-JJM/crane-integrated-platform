import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/shared/ui/molecules/resizable';
import { getCranesByRegion } from '@/entities/crane';
import { getAlarmsByRegion, getAlarmStatsByRegion } from '@/entities/alarm';
import { CraneStatusTable } from '@/shared/ui/organisms/crane-status-table';
import { AlarmPanel } from '@/shared/ui/organisms/alarm-panel';
import { OutdoorWork3dView } from '@/features/3d-model/view/ui/outdoor-work-3d-view';
import { useState } from 'react';
import { Spinner } from '@/shared/ui/atoms/spinner';

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  const cranes = getCranesByRegion(regionId);
  const alarms = getAlarmsByRegion(regionId);
  const alarmStats = getAlarmStatsByRegion(regionId);
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize={75} minSize={50}>
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize={60}>
            <div className="relative h-full bg-[rgba(43,43,43)]">
              {is3dViewLoading ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-xs">
                  <Spinner
                    className="size-6 text-orange-500"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium">3D 화면 불러오는 중</p>
                </div>
              ) : null}
              <OutdoorWork3dView onLoadingChange={setIs3dViewLoading} />
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
