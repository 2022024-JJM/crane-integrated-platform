import { RealtimeMonitoringView as RealtimeMonitoringViewBase } from '@crane/widgets/monitoring';

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  return <RealtimeMonitoringViewBase regionId={regionId} alarmHighlightMesh />;
}
