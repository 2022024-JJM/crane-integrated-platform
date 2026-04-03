import { useGoliathCraneData } from '@crane/features/goliath-crane';
import {
  CraneIdentityHeader,
  GoliathDiagramPanel,
  Goliath3dViewer,
  MetricsDashboardGrid,
  SensorChartsPanel,
  AlarmSafetyPanel,
  OperationLogPanel,
} from '@crane/widgets/goliath-crane';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';

export function GoliathCraneMonitoringPage() {
  const {
    crane,
    sensorHistory,
    safetyParams,
    operationLog,
    timeRange,
    setTimeRange,
  } = useGoliathCraneData();

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4 md:p-6">
        {/* Section 1: Identity Header */}
        <CraneIdentityHeader crane={crane} />

        {/* Section 2: 3D Viewer + 2D Diagram side by side */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Goliath3dViewer />
          <GoliathDiagramPanel crane={crane} />
        </div>

        {/* Section 3: Key Metrics */}
        <MetricsDashboardGrid crane={crane} />

        {/* Section 4: Sensor Charts */}
        <SensorChartsPanel
          data={sensorHistory}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />

        {/* Section 5 + 6: Alarm/Safety + Operation Log */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AlarmSafetyPanel crane={crane} safetyParams={safetyParams} />
          <OperationLogPanel log={operationLog} />
        </div>
      </div>
    </ScrollArea>
  );
}
