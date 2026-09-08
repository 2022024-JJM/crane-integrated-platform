import { useMemo, useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  filterRegionsByRole,
  getRegionsBySiteType,
  getRegionTitleKey,
  getRegionSubtitleKey,
} from '@crane/domain/region';
import {
  getCraneIdsByRegion,
  getCraneById,
  getCmmsMockData,
} from '@crane/domain/crane';
import { useAuth } from '@crane/features/auth';
import { useSiteType } from '@crane/core/lib/site-type-context';
import { useSectionCollapseGroup } from '@crane/core/lib/use-section-collapse-group';
import { Switch } from '@crane/ui/atoms/switch';
import { CraneListSection } from '@crane/widgets/crane';

type StatusFilter = 'RUN' | 'FAULT' | 'STOP';

const FILTER_CONFIG: Record<
  StatusFilter,
  {
    label: string;
    color: string;
    bg: string;
    activeBg: string;
    activeText: string;
  }
> = {
  RUN: {
    label: 'RUN',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    activeBg: 'bg-emerald-500',
    activeText: 'text-white',
  },
  FAULT: {
    label: 'FAULT',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    activeBg: 'bg-red-500',
    activeText: 'text-white',
  },
  STOP: {
    label: 'STOP',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    activeBg: 'bg-yellow-500',
    activeText: 'text-black',
  },
};

export function RegionCmmsPage() {
  const { t } = useTranslation();
  const { siteType } = useSiteType();
  const { user } = useAuth();
  const regions = filterRegionsByRole(
    getRegionsBySiteType(siteType),
    user?.role ?? 'philly',
  );

  const [statusFilters, setStatusFilters] = useState<Set<StatusFilter>>(
    new Set(),
  );
  const regionIds = useMemo(() => regions.map((r) => r.id), [regions]);
  const collapseGroup = useSectionCollapseGroup({
    storagePrefix: 'crane-section-collapsed',
    keys: regionIds,
  });
  const allCollapsed = collapseGroup.allCollapsed;

  const toggleFilter = (f: StatusFilter) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const counts = useMemo(() => {
    const tally = { RUN: 0, FAULT: 0, STOP: 0 };
    for (const region of regions) {
      const craneIds = getCraneIdsByRegion(region.id);
      for (const id of craneIds) {
        const crane = getCraneById(id);
        if (!crane) continue;
        const mock = getCmmsMockData(crane.craneId);
        const status = mock.overview.machines[0].runFault as StatusFilter;
        if (status in tally) tally[status]++;
      }
    }
    return tally;
  }, [regions]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-6 pb-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('monitoring-overview:cmms.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('monitoring-overview:cmms.description')}
        </p>
      </div>

      <div className="border-border bg-background/80 flex shrink-0 items-center gap-3 border-y px-6 py-3 backdrop-blur-sm">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {(['RUN', 'FAULT', 'STOP'] as StatusFilter[]).map((f) => {
            const cfg = FILTER_CONFIG[f];
            const isActive = statusFilters.has(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFilter(f)}
                className={[
                  'inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1 text-[11px] font-bold tracking-wider transition-all',
                  isActive
                    ? `${cfg.activeBg} ${cfg.activeText} shadow-sm`
                    : `${cfg.bg} ${cfg.color} hover:brightness-110`,
                ].join(' ')}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: 'currentColor' }}
                />
                {cfg.label}
                <span
                  className={`font-mono tabular-nums ${isActive ? 'opacity-80' : 'opacity-60'}`}
                >
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {allCollapsed ? (
            <ChevronsDownUp className="text-muted-foreground size-3.5" />
          ) : (
            <ChevronsUpDown className="text-muted-foreground size-3.5" />
          )}
          <span className="text-muted-foreground text-[11px]">
            {allCollapsed
              ? t('monitoring-overview:cmms.allCollapsed')
              : t('monitoring-overview:cmms.allExpanded')}
          </span>
          <Switch
            checked={allCollapsed}
            onCheckedChange={(checked) => collapseGroup.setAll(checked)}
            aria-label={t('monitoring-overview:cmms.toggleAria')}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
        {regions.map((region) => (
          <CraneListSection
            key={region.id}
            regionId={region.id}
            title={t(getRegionTitleKey(region.id))}
            subtitle={t(getRegionSubtitleKey(region.id))}
            statusFilters={statusFilters}
            collapsed={collapseGroup.isCollapsed(region.id)}
            onToggle={() => collapseGroup.toggle(region.id)}
          />
        ))}
      </div>
    </div>
  );
}
