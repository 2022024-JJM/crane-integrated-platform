import { useState, useMemo } from 'react';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useSiteType } from '@crane/core/lib/site-type-context';
import { useSectionCollapseGroup } from '@crane/core/lib/use-section-collapse-group';
import { getCraneIdsByRegion, getCraneById, getCmmsMockData } from '@crane/domain/crane';
import { Switch } from '@crane/ui/atoms/switch';
import { CraneListSection } from '@crane/widgets/crane';

type StatusFilter = 'RUN' | 'FAULT' | 'STOP';

const HANWHA_OCEAN_SECTIONS = [
  { regionId: 'dock-1',  titleKey: 'regions.dock1.title',  subtitle: '타워갠트리 크레인 9기' },
  { regionId: 'dock-2',  titleKey: 'regions.dock2.title',  subtitle: '타워갠트리 크레인 6기' },
  { regionId: 'dock-in', titleKey: 'regions.dockin.title', subtitle: '오버헤드 크레인 5기' },
] as const;

const GOLIATH_SECTIONS = [
  { regionId: 'goliath', titleKey: 'regions.goliath.title', subtitle: '골리앗 크레인 1기' },
] as const;

const FILTER_CONFIG: Record<StatusFilter, { label: string; color: string; bg: string; activeBg: string; activeText: string }> = {
  RUN:   { label: 'RUN',   color: 'text-emerald-400',      bg: 'bg-emerald-500/10',    activeBg: 'bg-emerald-500',     activeText: 'text-white'         },
  FAULT: { label: 'FAULT', color: 'text-red-400',          bg: 'bg-red-500/10',        activeBg: 'bg-red-500',         activeText: 'text-white'         },
  STOP:  { label: 'STOP',  color: 'text-yellow-400',       bg: 'bg-yellow-500/10',     activeBg: 'bg-yellow-500',      activeText: 'text-black'         },
};

export function CraneDetailListPage() {
  const { t } = useTranslation('common');
  const { siteType } = useSiteType();
  const sections = siteType === 'goliath-crane' ? GOLIATH_SECTIONS : HANWHA_OCEAN_SECTIONS;

  const [statusFilters, setStatusFilters] = useState<Set<StatusFilter>>(new Set());
  const regionIds = useMemo(() => sections.map((s) => s.regionId), [sections]);
  const collapseGroup = useSectionCollapseGroup({
    storagePrefix: 'crane-section-collapsed',
    keys: regionIds,
  });

  const toggleFilter = (f: StatusFilter) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  // 전체 크레인 상태 집계
  const counts = useMemo(() => {
    const tally = { RUN: 0, FAULT: 0, STOP: 0 };
    for (const section of sections) {
      const craneIds = getCraneIdsByRegion(section.regionId);
      for (const id of craneIds) {
        const crane = getCraneById(id);
        if (!crane) continue;
        const mock = getCmmsMockData(crane.craneId);
        const status = mock.overview.machines[0].runFault as StatusFilter;
        if (status in tally) tally[status]++;
      }
    }
    return tally;
  }, [sections]);

  const allCollapsed = collapseGroup.allCollapsed;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── 필터 헤더 ── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
        {/* 필터 칩 */}
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
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: 'currentColor' }}
                />
                {cfg.label}
                <span className={`tabular-nums font-mono ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>

        {/* 전체 접기 / 펼치기 */}
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
            onCheckedChange={(checked) => collapseGroup.setAll(checked)}
            aria-label="전체 접기 / 펼치기"
          />
        </div>
      </div>

      {/* ── 섹션 목록 ── */}
      <div className="flex flex-col gap-6 p-6 overflow-auto flex-1">
        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <CraneListSection
              key={section.regionId}
              regionId={section.regionId}
              title={t(section.titleKey)}
              subtitle={section.subtitle}
              statusFilters={statusFilters}
              collapsed={collapseGroup.isCollapsed(section.regionId)}
              onToggle={() => collapseGroup.toggle(section.regionId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
