import { monitoringRegions } from '@/entities/monitoring-region';
import { useMainPageClock } from '@/pages/main/model/use-main-page-clock';
import { MainFooter } from '@/pages/main/ui/main-footer';
import { MainHeader } from '@/pages/main/ui/main-header';
import { MainHero } from '@/pages/main/ui/main-hero';
import { MainRegionOverview } from '@/pages/main/ui/main-region-overview';
import { MainSummary } from '@/pages/main/ui/main-summary';

import './main-page.css';

export function MainPage() {
  const { dateTime, clockLabel, footerLabel } = useMainPageClock();

  return (
    <main className="main-page">
      <div className="main-page__shell">
        <MainHeader dateTime={dateTime} clockLabel={clockLabel} />
        <MainHero />
        <MainSummary regions={monitoringRegions} />
        <MainRegionOverview regions={monitoringRegions} />
        <MainFooter dateTime={dateTime} footerLabel={footerLabel} />
      </div>
    </main>
  );
}
