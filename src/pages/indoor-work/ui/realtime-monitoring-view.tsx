import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/shared/ui/molecules/resizable';
import { getCranesByRegion } from '@/entities/crane';
import { getAlarmsByRegion, getAlarmStatsByRegion } from '@/entities/alarm';
import { CraneStatusTable } from '@/widgets/crane';
import { AlarmPanel } from '@/widgets/alarm';
import { Preparing3dView } from '@/widgets/3d';

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  const cranes = getCranesByRegion(regionId);
  const alarms = getAlarmsByRegion(regionId);
  const alarmStats = getAlarmStatsByRegion(regionId);

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0">
      <ResizablePanel defaultSize={75} minSize={50}>
        <ResizablePanelGroup orientation="vertical" className="min-h-0">
          <ResizablePanel defaultSize={60}>
            <Preparing3dView regionId={regionId} />
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
