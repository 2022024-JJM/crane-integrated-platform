import { monitoringRegions } from '@/entities/monitoring/region';
import { MainHero } from '@/pages/main/ui/main-hero';
import { MainSummary } from '@/pages/main/ui/main-summary';

export function MainPageIntro() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <MainHero />
      <MainSummary regions={monitoringRegions} />
    </div>
  );
}
