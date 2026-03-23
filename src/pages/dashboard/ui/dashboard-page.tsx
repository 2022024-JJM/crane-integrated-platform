import { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import { getFormatLocale } from '@/shared/config/i18n';
import { useTheme } from '@/shared/lib/theme-context';
import { useDashboardSummary } from '../model';
import { MetricCard } from './dashboard-parts';
import {
  DashboardOverviewHeader,
  DashboardRecentAlarmsSection,
  DashboardRegionStatusSection,
  DashboardRiskCranesSection,
  DashboardTrendSection,
} from './dashboard-sections';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { summary, isLoading } = useDashboardSummary();
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
        theme === 'dark'
          ? 'oklch(0.34 0 0 / 82%)'
          : 'oklch(0.92 0 0 / 92%)',
      stroke: 'none',
    }),
    [theme],
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
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

      <section className="border-border/70 bg-card/60 rounded-[1.75rem] border p-4 shadow-sm backdrop-blur-sm md:p-6">
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
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <DashboardRiskCranesSection
            summary={summary}
            isLoading={isLoading}
            translate={t}
            locale={locale}
            barChartTooltipCursor={barChartTooltipCursor}
          />
          <DashboardRecentAlarmsSection
            summary={summary}
            isLoading={isLoading}
            translate={t}
            formatTimestamp={(value) =>
              dateTimeFormatter.format(new Date(value))
            }
          />
        </div>
      </section>
    </div>
  );
}
