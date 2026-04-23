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
import { Switch } from '@crane/ui/atoms/switch';
import { CraneListSection } from '@crane/widgets/crane';

type StatusFilter = 'RUN' | 'FAULT' | 'STOP';

const FILTER_CONFIG: Record<
  StatusFilter,
  { label: string; color: string; bg: string; activeBg: string; activeText: string }
> = {
  RUN:   { label: 'RUN',   color: 'text-emerald-400', bg: 'bg-emerald-500/10', activeBg: 'bg-emerald-500', activeText: 'text-white' },
  FAULT: { label: 'FAULT', color: 'text-red-400',     bg: 'bg-red-500/10',     activeBg: 'bg-red-500',     activeText: 'text-white' },
  STOP:  { label: 'STOP',  color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  activeBg: 'bg-yellow-500',  activeText: 'text-black' },
};

export function RegionCmmsPage() {
  const { t } = useTranslation();
  const { siteType } = useSiteType();
  const { user } = useAuth();
  const regions = filterRegionsByRole(
    getRegionsBySiteType(siteType),
    user?.role ?? 'philly',
  );

  const [statusFilters, setStatusFilters] = useState<Set<StatusFilter>>(new Set());
  const [globalCollapsed, setGlobalCollapsed] = useState<boolean | null>(null);

  const allCollapsed = globalCollapsed === true;

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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-3 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('monitoring-overview:cmms.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('monitoring-overview:cmms.description')}
        </p>
      </div>

      <div className="flex items-center gap-3 px-6 py-3 border-y border-border bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
          {(['RUN', 'FAULT', 'STOP'] as StatusFilter[]).map((f) => {
            const cfg = FILTER_CONFIG[f];
            const isActive = statusFilters.has(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFilter(f)}
                className={[
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold tracking-wider transition-all cursor-pointer',
                  isActive
                    ? `${cfg.activeBg} ${cfg.activeText} shadow-sm`
                    : `${cfg.bg} ${cfg.color} hover:brightness-110`,
                ].join(' ')}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />
                {cfg.label}
                <span className={`tabular-nums font-mono ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {allCollapsed
            ? <ChevronsDownUp className="size-3.5 text-muted-foreground" />
            : <ChevronsUpDown className="size-3.5 text-muted-foreground" />
          }
          <span className="text-[11px] text-muted-foreground">
            {allCollapsed
              ? t('monitoring-overview:cmms.allCollapsed')
              : t('monitoring-overview:cmms.allExpanded')}
          </span>
          <Switch
            checked={allCollapsed}
            onCheckedChange={(checked) => setGlobalCollapsed(checked ? true : false)}
            aria-label={t('monitoring-overview:cmms.toggleAria')}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 p-6 overflow-auto flex-1">
        {regions.map((region) => (
          <CraneListSection
            key={region.id}
            regionId={region.id}
            title={t(getRegionTitleKey(region.id))}
            subtitle={t(getRegionSubtitleKey(region.id))}
            statusFilters={statusFilters}
            globalCollapsed={globalCollapsed}
            onLocalToggle={() => setGlobalCollapsed(null)}
          />
        ))}
      </div>
    </div>
  );
}
