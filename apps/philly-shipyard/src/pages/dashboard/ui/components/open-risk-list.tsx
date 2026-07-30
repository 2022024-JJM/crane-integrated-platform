import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TicketPlus } from 'lucide-react';
import type { OpenRisk, RiskTicketPlan } from '@crane/features/risk';
import { isBatchEligible } from '@crane/features/risk';
import { cn } from '@crane/core/lib/utils';
import { TONE_DOT, TONE_CHIP, type Tone } from '../../../../shared/ui/tone';
import { FOCUS_RING } from '../../../../shared/ui/controls';
import { formatRelativeDate } from '../../../../shared/lib/relative-date';

function riskTone(risk: OpenRisk): Tone {
  return risk.severity === 'critical' ? 'critical' : 'warning';
}

/** 티켓 발행 액션 — 없으면(생략) 기존처럼 딥링크 목록으로만 동작 */
export interface RiskTicketActions {
  planFor: (risk: OpenRisk) => RiskTicketPlan;
  /** repair/parts 계획의 원클릭 즉시 발행 */
  onIssue: (risk: OpenRisk) => void;
  selectMode: boolean;
  selected: Set<string>;
  onToggle: (riskId: string) => void;
}

/** 오픈 리스크 드릴다운 목록 — 각 행이 원천 화면(점검/정비/재고)으로 딥링크된다. */
export function OpenRiskList({
  risks,
  actions,
}: {
  risks: OpenRisk[];
  actions?: RiskTicketActions;
}) {
  const { t, i18n } = useTranslation('philly-dashboard');
  const isKo = i18n.language === 'ko';

  if (risks.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">{t('openItems.empty')}</p>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {risks.map((risk) => {
        const tone = riskTone(risk);
        const title = (isKo ? risk.title_ko : undefined) ?? risk.title;
        const { label: dateLabel } = formatRelativeDate(risk.date);
        const plan = actions?.planFor(risk);
        const eligible = isBatchEligible(risk);
        const selectMode = actions?.selectMode ?? false;

        const body = (
          <>
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[tone])} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium group-hover:text-primary">
                {title}
              </span>
              {risk.assetName && (
                <span className="block truncate text-[11px] text-muted-foreground">
                  {risk.assetName}
                </span>
              )}
            </span>
            <span
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                TONE_CHIP.neutral,
              )}
            >
              {t(`openItems.source.${risk.source}`)}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {dateLabel}
            </span>
          </>
        );

        return (
          <li key={risk.id} className="flex items-center gap-1.5">
            {selectMode && (
              <input
                type="checkbox"
                aria-label={title}
                checked={actions?.selected.has(risk.id) ?? false}
                disabled={!eligible}
                onChange={() => actions?.onToggle(risk.id)}
                className={cn('h-3.5 w-3.5 shrink-0 accent-primary disabled:opacity-30', FOCUS_RING)}
              />
            )}
            <Link
              to={risk.detailPath}
              className="group flex min-w-0 flex-1 items-center gap-2.5 px-1 py-2 transition-colors hover:bg-muted/40"
            >
              {body}
            </Link>
            {actions && risk.ticketIssued && (
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                  TONE_CHIP.info,
                )}
              >
                {t('openItems.issued')}
              </span>
            )}
            {actions && !risk.ticketIssued && (plan?.kind === 'repair' || plan?.kind === 'parts') && (
              <button
                type="button"
                title={t('openItems.issueTicket')}
                aria-label={t('openItems.issueTicket')}
                onClick={() => actions.onIssue(risk)}
                className={cn(
                  'shrink-0 cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                <TicketPlus className="h-3.5 w-3.5" />
              </button>
            )}
            {actions && !risk.ticketIssued && plan?.kind === 'parts_form' && (
              <Link
                to={plan.path}
                title={t('openItems.issueTicket')}
                aria-label={t('openItems.issueTicket')}
                className={cn(
                  'shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                <TicketPlus className="h-3.5 w-3.5" />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
