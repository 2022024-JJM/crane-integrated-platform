import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { getFormatLocale } from '@crane/core/config/i18n';
import { useSiteType } from '@crane/core/lib/site-type-context';
import { useTheme } from '@crane/core/lib/theme-context';
import { useDashboardSummary, type DashboardRegionStatusDatum } from '../model';
import { DashboardGoliathCraneStatus } from './dashboard-goliath-crane-status';
import { MetricCard } from './dashboard-parts';
import {
  getDashboardPreviewDefaultPosition,
  getDashboardPreviewDefaultSize,
  type DashboardPreviewPosition,
  type DashboardPreviewSize,
} from '@crane/core/lib/preview-helpers';
import { DashboardRegionPreviewModal } from './dashboard-region-preview-modal';
import {
  DashboardOverviewHeader,
  DashboardRecentAlarmsSection,
  DashboardRegionStatusSection,
  DashboardRiskCranesSection,
} from './dashboard-sections';
import { DashboardTrendSection } from './dashboard-trend-section';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { siteType } = useSiteType();
  const isGoliath = siteType === 'goliath-crane';
  const { summary, isLoading } = useDashboardSummary();
  const [selectedPreviewRegion, setSelectedPreviewRegion] =
    useState<DashboardRegionStatusDatum | null>(null);
  const [previewPosition, setPreviewPosition] =
    useState<DashboardPreviewPosition | null>(null);
  const [previewSize, setPreviewSize] = useState<DashboardPreviewSize | null>(
    null,
  );
  const locale = useMemo(
    () => getFormatLocale(i18n.resolvedLanguage ?? i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  );
  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short' }),
    [locale],
  );
  const weekFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    [locale],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  );
  const barChartTooltipCursor = useMemo(
    () => ({
      fill:
        theme === 'dark' ? 'oklch(0.34 0 0 / 82%)' : 'oklch(0.92 0 0 / 92%)',
      stroke: 'none',
    }),
    [theme],
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section
        aria-labelledby="dashboard-metrics-title"
        className="grid grid-cols-1 gap-4 xl:grid-cols-4"
      >
        <h2 id="dashboard-metrics-title" className="sr-only">
          {t('dashboard:sections.metrics.title', { defaultValue: 'Metrics' })}
        </h2>
        {summary.metrics.map((metric) => (
          <MetricCard
            key={metric.id}
            isLoading={isLoading}
            metric={metric}
            translate={t}
            locale={locale}
          />
        ))}
      </section>

      {isGoliath && <DashboardGoliathCraneStatus />}

      <section
        aria-labelledby="dashboard-overview-title"
        className="border-border/90 bg-card/60 rounded border p-4 shadow-sm backdrop-blur-sm md:p-6"
      >
        <DashboardOverviewHeader summary={summary} translate={t} />

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <DashboardTrendSection
            summary={summary}
            isLoading={isLoading}
            translate={t}
            locale={locale}
            monthFormatter={monthFormatter}
            weekFormatter={weekFormatter}
            barChartTooltipCursor={barChartTooltipCursor}
          />
          <DashboardRegionStatusSection
            summary={summary}
            isLoading={isLoading}
            translate={t}
            locale={locale}
            onRegionPreviewOpen={(regionStatus) => {
              setSelectedPreviewRegion(regionStatus);
              setPreviewPosition((currentPosition) => {
                return currentPosition ?? getDashboardPreviewDefaultPosition();
              });
              setPreviewSize((currentSize) => {
                return currentSize ?? getDashboardPreviewDefaultSize();
              });
            }}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <DashboardRiskCranesSection
            summary={summary}
            isLoading={isLoading}
            translate={t}
            locale={locale}
          />
          <DashboardRecentAlarmsSection
            summary={summary}
            isLoading={isLoading}
            translate={t}
            locale={locale}
            formatTimestamp={(value) =>
              dateTimeFormatter.format(new Date(value))
            }
          />
        </div>
      </section>

      {selectedPreviewRegion ? (
        <DashboardRegionPreviewModal
          open
          regionId={selectedPreviewRegion.regionId}
          title={t(selectedPreviewRegion.titleKey)}
          navigateTo={selectedPreviewRegion.navigateTo}
          position={previewPosition ?? getDashboardPreviewDefaultPosition()}
          size={previewSize ?? getDashboardPreviewDefaultSize()}
          onPositionChange={setPreviewPosition}
          onSizeChange={setPreviewSize}
          onClose={() => {
            setSelectedPreviewRegion(null);
          }}
        />
      ) : null}
    </div>
  );
}
