import { monitoringRegions } from '@/entities/monitoring/region';
import { MonitoringRegionOverview } from '@/features/monitoring/region';
import { MainFooter } from '@/pages/main/ui/main-footer';

export function MainPageRegionOverview() {
  return (
    <div className="flex min-h-full flex-1 flex-col pt-8">
      <MonitoringRegionOverview regions={monitoringRegions} />
      <MainFooter />
    </div>
  );
}
