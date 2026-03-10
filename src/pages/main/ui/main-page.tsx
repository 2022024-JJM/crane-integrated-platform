import type { CSSProperties } from 'react';

import { monitoringRegions } from '@/entities/monitoring-region';
import { useMainPageClock } from '@/pages/main/model/use-main-page-clock';
import { MainFooter } from '@/pages/main/ui/main-footer';
import { MainHeader } from '@/pages/main/ui/main-header';
import { MainHero } from '@/pages/main/ui/main-hero';
import { MainSummary } from '@/pages/main/ui/main-summary';
import { MainRegionOverview } from '@/features/main-region-overview';

const MAIN_PAGE_STYLE: CSSProperties = {
  '--main-page-bg': '#111214',
  '--main-page-surface': '#18191d',
  '--main-page-card': '#1c1e23',
  '--main-page-border': '#2a2c32',
  '--main-page-accent': '#f5a623',
  '--main-page-steel': '#A1ACB7',
  '--main-page-text': '#d4dae0',
  '--main-page-text-dim': '#d4dae0',
  '--main-page-ok': '#3dd68c',
  '--main-page-warn': '#f5a623',
  '--main-page-error': '#f04747',
  backgroundImage:
    'radial-gradient(circle at top right, rgb(245 166 35 / 0.12), transparent 26%), linear-gradient(180deg, #15161a 0%, var(--main-page-bg) 100%)',
  backgroundSize: 'auto',
  backgroundRepeat: 'no-repeat',
} as CSSProperties;

export function MainPage() {
  const { dateTime, clockLabel, footerLabel } = useMainPageClock();

  return (
    <main
      className="relative overflow-hidden isolate min-h-screen text-(--main-page-text) font-['Noto_Sans_KR',sans-serif]"
      style={MAIN_PAGE_STYLE}
    >
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(-45deg, transparent 0, transparent 18px, rgb(255 255 255 / 0.012) 18px, rgb(255 255 255 / 0.012) 19px)',
        }}
      />
      <div className="relative z-10 min-h-screen flex flex-col">
        <MainHeader dateTime={dateTime} clockLabel={clockLabel} />
        <MainHero />
        <MainSummary regions={monitoringRegions} />
        <MainRegionOverview regions={monitoringRegions} />
        <MainFooter dateTime={dateTime} footerLabel={footerLabel} />
      </div>
    </main>
  );
}
