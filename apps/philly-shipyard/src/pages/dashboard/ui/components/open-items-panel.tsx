import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Wrench } from 'lucide-react';
import type { OpenRisk } from '@crane/features/risk';
import { cn } from '@crane/core/lib/utils';
import { SectionCard } from './section-card';
import { MetricDonut } from './metric-donut';
import { MetricWithUnderline } from './metric-with-underline';
import { OpenRiskList } from './open-risk-list';
import { KCC_FILL } from '../constants/konecranes-colors';
import { FOCUS_RING } from '../../../../shared/ui/controls';

interface OpenItemsPanelProps {
  risks: { risks: OpenRisk[]; safety: OpenRisk[]; production: OpenRisk[] };
}

export function OpenItemsPanel({ risks }: OpenItemsPanelProps) {
  const { t } = useTranslation('philly-dashboard');
  const [expanded, setExpanded] = useState(false);

  const safety = risks.safety.length;
  const production = risks.production.length;
  const totalOpen = risks.risks.length;

  const segments = [
    { key: 'safety', value: safety, color: KCC_FILL.safety },
    { key: 'production', value: production, color: KCC_FILL.production },
  ];

  return (
    <SectionCard
      title={t('openItems.title')}
      variant="panel"
      accent="safety"
      icon={Wrench}
      href="/maintenance"
    >
      <div className="flex items-center justify-around gap-6">
        <div className="flex flex-col items-center gap-2">
          <MetricDonut segments={segments} centerNumber={totalOpen} size="lg" />
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            {t('openItems.openRisks')}
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border/80">
          <div className="px-8">
            <MetricWithUnderline
              value={safety}
              label={t('openItems.safety')}
              accent="safety"
              align="center"
              size="lg"
            />
          </div>
          <div className="px-8">
            <MetricWithUnderline
              value={production}
              label={t('openItems.production')}
              accent="production"
              align="center"
              size="lg"
            />
          </div>
        </div>
      </div>

      {/* 리스크 드릴다운 — 소견 단위 목록 (Konecranes: 수리 완료 전까지 열린 상태) */}
      <div className="mt-3 border-t border-border/60 pt-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={cn(
            'flex w-full cursor-pointer items-center justify-center gap-1 rounded py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
            FOCUS_RING,
          )}
        >
          {expanded ? t('openItems.hideRisks') : t('openItems.showRisks', { count: totalOpen })}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>
        {expanded && (
          <div className="max-h-64 overflow-y-auto">
            <OpenRiskList risks={risks.risks} />
          </div>
        )}
      </div>
    </SectionCard>
  );
}
