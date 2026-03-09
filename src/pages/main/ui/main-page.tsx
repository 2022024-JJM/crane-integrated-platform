import { monitoringRegions } from '@/entities/monitoring-region';
import { useMainPageClock } from '@/pages/main/model/use-main-page-clock';
import { MainFooter } from '@/widgets/main-footer';
import { MainHeader } from '@/widgets/main-header';
import { MainHero } from '@/widgets/main-hero';
import { MainRegionOverview } from '@/widgets/main-region-overview';
import { MainSummary } from '@/widgets/main-summary';

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
