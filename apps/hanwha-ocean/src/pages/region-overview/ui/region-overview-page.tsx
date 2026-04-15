import { useState, useMemo } from 'react';
import { LayoutGrid, Map, MonitorCheck, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { getRegionsBySiteType, filterRegionsByRole, getRegionTitleKey, getRegionSubtitleKey, type Region } from '@crane/domain/region';
import { getCraneIdsByRegion, getCraneById } from '@crane/domain/crane';
import { getCmmsMockData } from '../../crane-detail/model/mock-data';
import { useAuth } from '@crane/features/auth';
import { useSiteType } from '@crane/core/lib/site-type-context';
import { Switch } from '@crane/ui/atoms/switch';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import { CraneListSection } from '../../crane-detail/ui/crane-list-section';
import { RegionCard } from './region-card';
import { RegionMap } from './region-map';

type RegionOverviewView = 'card' | 'map' | 'cmms';
type StatusFilter = 'RUN' | 'FAULT' | 'STOP';

const FILTER_CONFIG: Record<StatusFilter, { label: string; color: string; bg: string; activeBg: string; activeText: string }> = {
  RUN:   { label: 'RUN',   color: 'text-emerald-400',      bg: 'bg-emerald-500/10', activeBg: 'bg-emerald-500', activeText: 'text-white' },
  FAULT: { label: 'FAULT', color: 'text-red-400',          bg: 'bg-red-500/10',     activeBg: 'bg-red-500',     activeText: 'text-white' },
  STOP:  { label: 'STOP',  color: 'text-yellow-400',       bg: 'bg-yellow-500/10',  activeBg: 'bg-yellow-500',  activeText: 'text-black' },
};

function RegionCmmsView({ regions }: { regions: Region[] }) {
  const { t } = useTranslation();
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
    <div className="flex flex-col h-full overflow-hidden -mx-6 -mb-6">
      {/* 필터 헤더 */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
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
            {allCollapsed ? '전체 접힘' : '전체 펼침'}
          </span>
          <Switch
            checked={allCollapsed}
            onCheckedChange={(checked) => setGlobalCollapsed(checked ? true : false)}
            aria-label="전체 접기 / 펼치기"
          />
        </div>
      </div>

      {/* 섹션 목록 */}
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

export function RegionOverviewPage() {
  const { t } = useTranslation();
  const { siteType } = useSiteType();
  const { user } = useAuth();
  const filteredRegions = filterRegionsByRole(
    getRegionsBySiteType(siteType),
    user?.role ?? 'philly',
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const view = useMemo<RegionOverviewView>(() => {
    const requestedView = searchParams.get('view');
    if (requestedView === 'map') return 'map';
    if (requestedView === 'cmms') return 'cmms';
    return 'card';
  }, [searchParams]);

  const handleViewChange = (values: string[]) => {
    if (values.length === 0) return;
    const nextView = values[values.length - 1];
    if (nextView !== 'card' && nextView !== 'map' && nextView !== 'cmms') return;

    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      if (nextView === 'card') {
        nextParams.delete('view');
      } else {
        nextParams.set('view', nextView);
      }
      return nextParams;
    });
  };

  return (
    <div className="flex flex-col h-full space-y-6 p-6 overflow-hidden">
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('region-overview:title')}
          </h1>
          <p className="text-muted-foreground">
            {t('region-overview:description')}
          </p>
        </div>

        <ToggleGroup
          value={[view]}
          onValueChange={handleViewChange}
          className="bg-muted rounded-lg border"
        >
          <ToggleGroupItem
            value="card"
            aria-label={t('region-overview:cardView')}
            className="text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground text-sm aria-pressed:shadow-sm"
          >
            <LayoutGrid className="mr-1.5 size-4" />
            {t('region-overview:cardView')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="map"
            aria-label={t('region-overview:mapView')}
            className="text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground text-sm aria-pressed:shadow-sm"
          >
            <Map className="mr-1.5 size-4" />
            {t('region-overview:mapView')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="cmms"
            aria-label="CMMS"
            className="text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground text-sm aria-pressed:shadow-sm"
          >
            <MonitorCheck className="mr-1.5 size-4" />
            CMMS
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {view === 'card' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 lg:grid-cols-6">
          {filteredRegions.map((region) => (
            <RegionCard key={region.id} region={region} />
          ))}
        </div>
      )}

      {view === 'map' && <RegionMap />}

      {view === 'cmms' && (
        <div className="flex-1 overflow-hidden min-h-0">
          <RegionCmmsView regions={filteredRegions} />
        </div>
      )}
    </div>
  );
}
