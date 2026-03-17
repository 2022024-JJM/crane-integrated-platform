import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/shared/ui/molecules/resizable';
import { getCranesByRegion } from '@/entities/crane';
import { getAlarmsByRegion, getAlarmStatsByRegion } from '@/entities/alarm';
import { MonitoringViewer } from '@/shared/ui/organisms/monitoring-viewer';
import { CraneStatusTable } from '@/shared/ui/organisms/crane-status-table';
import { AlarmPanel } from '@/shared/ui/organisms/alarm-panel';

export function Monitoring3dView({ regionId }: { regionId: string }) {
  const cranes = getCranesByRegion(regionId);
  const alarms = getAlarmsByRegion(regionId);
  const alarmStats = getAlarmStatsByRegion(regionId);

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize={75} minSize={50}>
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize={60}>
            <MonitoringViewer regionId={regionId} />
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
