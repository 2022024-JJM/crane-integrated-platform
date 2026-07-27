import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { OpenRisk } from '@crane/features/risk';
import { cn } from '@crane/core/lib/utils';
import { TONE_DOT, TONE_CHIP, type Tone } from '../../../../shared/ui/tone';
import { formatRelativeDate } from '../../../../shared/lib/relative-date';

function riskTone(risk: OpenRisk): Tone {
  return risk.severity === 'critical' ? 'critical' : 'warning';
}

/** 오픈 리스크 드릴다운 목록 — 각 행이 원천 화면(점검/정비/재고)으로 딥링크된다. */
export function OpenRiskList({ risks }: { risks: OpenRisk[] }) {
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
        return (
          <li key={risk.id}>
            <Link
              to={risk.detailPath}
              className="group flex items-center gap-2.5 px-1 py-2 transition-colors hover:bg-muted/40"
            >
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
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
