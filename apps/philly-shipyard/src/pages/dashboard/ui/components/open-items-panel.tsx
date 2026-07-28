import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ChevronDown, ListChecks, Wrench } from 'lucide-react';
import type { OpenRisk } from '@crane/features/risk';
import {
  isBatchEligible,
  planTicketForRisk,
  useIssueRiskTickets,
  type TicketPlanContext,
} from '@crane/features/risk';
import { getAllCraneAssets } from '@crane/domain/asset';
import { getAllInventoryItems } from '@crane/domain/inventory';
import { getTechnicians } from '@crane/domain/shared';
import { cn } from '@crane/core/lib/utils';
import { SectionCard } from './section-card';
import { MetricDonut } from './metric-donut';
import { MetricWithUnderline } from './metric-with-underline';
import { OpenRiskList } from './open-risk-list';
import { RiskBatchConfirmModal } from './risk-batch-confirm-modal';
import { KCC_FILL } from '../constants/konecranes-colors';
import { FOCUS_RING } from '../../../../shared/ui/controls';
import { toLocalDateString } from '../../../../shared/lib/relative-date';

interface OpenItemsPanelProps {
  risks: { risks: OpenRisk[]; safety: OpenRisk[]; production: OpenRisk[] };
}

export function OpenItemsPanel({ risks }: OpenItemsPanelProps) {
  const { t } = useTranslation('philly-dashboard');
  const [expanded, setExpanded] = useState(false);
  // 선택/모달은 새로고침·공유 시 의미 없는 일시 상태 — URL이 아닌 로컬 state가 맞다
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const issueTickets = useIssueRiskTickets();

  const safety = risks.safety.length;
  const production = risks.production.length;
  const totalOpen = risks.risks.length;

  // 티켓 계획 컨텍스트 — 담당자 폴백은 티켓 폼의 스마트 기본값과 동일 규칙
  const planCtx = useMemo<TicketPlanContext>(
    () => ({
      cranes: getAllCraneAssets(),
      inventoryItems: getAllInventoryItems(),
      defaultAssignee:
        getTechnicians().find((p) => p.performerType === 'internal')?.name ??
        getTechnicians()[0]?.name ??
        '',
      today: toLocalDateString(),
    }),
    // 발행 직후 risks가 재계산되며 새 배열이 내려오므로 이 의존으로 충분하다
    [risks],
  );

  const eligibleIds = useMemo(
    () => risks.risks.filter(isBatchEligible).map((r) => r.id),
    [risks],
  );
  const selectedRisks = risks.risks.filter((r) => selected.has(r.id));
  const selectedPlans = selectedRisks.map((r) => planTicketForRisk(r, planCtx));
  const repairCount = selectedPlans.filter((p) => p.kind === 'repair').length;
  const partsCount = selectedPlans.filter((p) => p.kind === 'parts').length;

  const resetSelection = () => {
    setSelectMode(false);
    setSelected(new Set());
    setConfirmOpen(false);
  };

  const announceIssued = (result: { repairCount: number; partsCount: number }) => {
    toast.success(
      t('openItems.toast.issued', { repair: result.repairCount, parts: result.partsCount }),
    );
  };

  const handleIssueOne = (risk: OpenRisk) => {
    announceIssued(issueTickets([planTicketForRisk(risk, planCtx)]));
  };

  const handleConfirmBatch = () => {
    announceIssued(issueTickets(selectedPlans));
    resetSelection();
  };

  const segments = [
    { key: 'safety', value: safety, color: KCC_FILL.safety },
    { key: 'production', value: production, color: KCC_FILL.production },
  ];

  const toolbarButton =
    'flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors';

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
          onClick={() => {
            setExpanded((v) => !v);
            if (expanded) resetSelection();
          }}
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
          <>
            {totalOpen > 0 && (
              <div className="flex items-center justify-between gap-2 px-1 pb-1">
                <button
                  type="button"
                  onClick={() => (selectMode ? resetSelection() : setSelectMode(true))}
                  className={cn(
                    toolbarButton,
                    'text-muted-foreground hover:bg-muted hover:text-foreground',
                    FOCUS_RING,
                  )}
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  {selectMode ? t('openItems.exitSelect') : t('openItems.selectMode')}
                </button>
                {selectMode && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelected(new Set(eligibleIds))}
                      className={cn(
                        toolbarButton,
                        'text-muted-foreground hover:bg-muted hover:text-foreground',
                        FOCUS_RING,
                      )}
                    >
                      {t('openItems.selectAll')}
                    </button>
                    <button
                      type="button"
                      disabled={selected.size === 0}
                      onClick={() => setConfirmOpen(true)}
                      className={cn(
                        toolbarButton,
                        'bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-default disabled:opacity-50',
                        FOCUS_RING,
                      )}
                    >
                      {t('openItems.issueSelected', { count: selected.size })}
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="max-h-64 overflow-y-auto">
              <OpenRiskList
                risks={risks.risks}
                actions={{
                  planFor: (risk) => planTicketForRisk(risk, planCtx),
                  onIssue: handleIssueOne,
                  selectMode,
                  selected,
                  onToggle: (riskId) =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(riskId)) next.delete(riskId);
                      else next.add(riskId);
                      return next;
                    }),
                }}
              />
            </div>
          </>
        )}
      </div>

      {confirmOpen && (
        <RiskBatchConfirmModal
          repairCount={repairCount}
          partsCount={partsCount}
          excludedCount={totalOpen - eligibleIds.length}
          onConfirm={handleConfirmBatch}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </SectionCard>
  );
}
