import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, TriangleAlert, OctagonAlert } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { useAllSitesRealtimeSummary } from '../model/use-all-sites-realtime-summary';
import { RegionMap } from './region-map';

type KpiVariant = 'neutral' | 'warning' | 'critical';

export function RegionMapPage() {
  const { t } = useTranslation();
  const summary = useAllSitesRealtimeSummary();

  return (
    <div className="relative flex h-full flex-col overflow-hidden p-6">
      <RegionMap />

      <div className="pointer-events-none absolute bottom-7 left-28 z-40 flex items-center gap-2">
        <KpiChip
          icon={<MapPin className="size-3.5" />}
          label={t('monitoring-overview:map.kpi.sites', {
            defaultValue: 'Sites',
          })}
          value={summary.sitesCount}
          variant="neutral"
        />
        <KpiChip
          icon={<TriangleAlert className="size-3.5" />}
          label={t('monitoring-overview:map.kpi.warning', {
            defaultValue: 'Warning',
          })}
          value={summary.warning}
          variant="warning"
        />
        <KpiChip
          icon={<OctagonAlert className="size-3.5" />}
          label={t('monitoring-overview:map.kpi.critical', {
            defaultValue: 'Critical',
          })}
          value={summary.critical}
          variant="critical"
        />
      </div>
    </div>
  );
}

function KpiChip({
  icon,
  label,
  value,
  variant,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  variant: KpiVariant;
}) {
  const active = variant !== 'neutral' && value > 0;

  return (
    <div
      className={cn(
        'border-border bg-background/60 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide shadow-sm backdrop-blur-sm',
        variant === 'neutral' && 'text-foreground',
        variant === 'warning' &&
          (active
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300'
            : 'text-muted-foreground'),
        variant === 'critical' &&
          (active
            ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300'
            : 'text-muted-foreground'),
      )}
    >
      <span aria-hidden className="shrink-0 opacity-80">
        {icon}
      </span>
      <span className="text-[10px] tracking-[0.14em] uppercase opacity-70">
        {label}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
