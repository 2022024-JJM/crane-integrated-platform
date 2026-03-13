import '@/pages/main/ui/main-page.css';

import { monitoringRegions } from '@/entities/monitoring/region';
import { MainFooter } from '@/pages/main/ui/main-footer';
import { MainHeader } from '@/pages/main/ui/main-header';
import { MainHero } from '@/pages/main/ui/main-hero';
import { MainSummary } from '@/pages/main/ui/main-summary';
import { MainRegionOverview } from '@/features/main-region-overview';

export function MainPage() {
  return (
    <main className="main-page min-h-screen">
      <div className="main-page-overlay" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <MainHeader />
        <MainHero />
        <MainSummary regions={monitoringRegions} />
        <MainRegionOverview regions={monitoringRegions} />
        <MainFooter />
      </div>
    </main>
  );
}
