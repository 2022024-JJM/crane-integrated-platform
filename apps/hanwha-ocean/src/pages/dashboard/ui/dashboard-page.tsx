import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { getFormatLocale } from '@crane/core/config/i18n';
import { useSiteType } from '@crane/core/lib/site-type-context';
import { useTheme } from '@crane/core/lib/theme-context';
import { useCollisionDashboard, type DashboardRegionStatusDatum } from '../model';
import { DashboardGoliathCraneStatus } from './dashboard-goliath-crane-status';
import { MetricCard } from './dashboard-parts';
import {
  getDashboardPreviewDefaultPosition,
  getDashboardPreviewDefaultSize,
  type DashboardPreviewPosition,
  type DashboardPreviewSize,
} from '@crane/core/lib/preview-helpers';
import { DashboardRegionPreviewModal } from './dashboard-region-preview-modal';
import { DashboardCollisionBanner } from './dashboard-collision-banner';
import { DashboardEquipmentLiveSection } from './dashboard-equipment-live';
import {
  DashboardCollisionHistorySection,
  DashboardOverviewHeader,
  DashboardRecentAlarmsSection,
  DashboardRegionStatusSection,
} from './dashboard-sections';
import { DashboardTrendSection } from './dashboard-trend-section';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { siteType } = useSiteType();
  const isGoliath = siteType === 'goliath-crane';
  const { summary, equipment } = useCollisionDashboard();
  const [selectedPreviewRegion, setSelectedPreviewRegion] =
    useState<DashboardRegionStatusDatum | null>(null);
  const [previewPosition, setPreviewPosition] =
    useState<DashboardPreviewPosition | null>(null);
  const [previewSize, setPreviewSize] = useState<DashboardPreviewSize | null>(
    null,
  );
  // 배너를 닫은 충돌 key — 같은 충돌은 다시 안 뜨고 새 충돌이 오면 뜬다.
  const [dismissedCollisionKey, setDismissedCollisionKey] = useState<
    string | null
  >(null);
  const locale = useMemo(
    () => getFormatLocale(i18n.resolvedLanguage ?? i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  );
  const weekFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    [locale],
  );
  const dayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
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
  // 심각도 램프(critical→medium, 진할수록 위험) + info 파랑. 다크 모드는
  // 자동 반전이 아니라 어두운 표면 대비로 고른 밝은 단계다.
  const severityFills = useMemo(
    () =>
      theme === 'dark'
        ? ['#dc2626', '#f87171', '#fecaca', '#60a5fa']
        : ['#991b1b', '#ef4444', '#fca5a5', '#3b82f6'],
    [theme],
  );

  const attentionCollision =
    summary.attentionCollision &&
    summary.attentionCollision.key !== dismissedCollisionKey
      ? summary.attentionCollision
      : null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {attentionCollision ? (
        <DashboardCollisionBanner
          collision={attentionCollision}
          translate={t}
          formatTime={(at) => dateTimeFormatter.format(new Date(at))}
          onDismiss={() => {
            setDismissedCollisionKey(attentionCollision.key);
          }}
        />
      ) : null}
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
        <DashboardOverviewHeader
          summary={summary}
          translate={t}
          dayFormatter={dayFormatter}
        />

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <DashboardTrendSection
            summary={summary}
            translate={t}
            locale={locale}
            weekFormatter={weekFormatter}
            barChartTooltipCursor={barChartTooltipCursor}
            severityFills={severityFills}
          />
          <DashboardRegionStatusSection
            summary={summary}
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
          <DashboardCollisionHistorySection
            summary={summary}
            translate={t}
            formatTime={(at) => dateTimeFormatter.format(new Date(at))}
          />
          <DashboardRecentAlarmsSection
            summary={summary}
            translate={t}
            locale={locale}
            formatTimestamp={(value) =>
              dateTimeFormatter.format(new Date(value))
            }
          />
        </div>

        <div className="mt-4">
          <DashboardEquipmentLiveSection equipment={equipment} translate={t} />
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
