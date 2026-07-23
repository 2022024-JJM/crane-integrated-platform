import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { InspectionWO } from '@crane/domain/inspection';
import { Badge } from '@crane/ui/atoms/badge';
import { cn } from '@crane/core/lib/utils';
import { TONE_TEXT } from '../../../shared/ui/tone';
import {
  INSPECTION_RESULT_VARIANT,
  INSPECTION_STATUS_VARIANT,
} from '../../../shared/ui/status-variants';
import { formatRelativeDate } from '../../../shared/lib/relative-date';

// ── 탭: 점검 이력 — 점검 WO 목록 (상세 딥링크) ──
export function AssetInspectionTab({ inspections }: { inspections: InspectionWO[] }) {
  const { t } = useTranslation('asset-management');
  const { t: tInspection } = useTranslation('inspection');

  return (
    <div className="flex flex-col gap-2">
      {inspections.length === 0 ? (
        <div className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {t('detail.noInspectionHistory')}
        </div>
      ) : (
        inspections.map((wo) => {
          const rel = formatRelativeDate(wo.scheduledDate);
          return (
            <Link
              key={wo.id}
              to={`/inspection/${wo.id}`}
              className="group flex items-center gap-3 rounded border border-border/90 bg-card/70 px-3.5 py-3 transition-all hover:border-primary/40 hover:bg-card"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{wo.woNumber}</p>
                <p className="text-xs text-muted-foreground">
                  <span className={cn('mr-1 font-semibold', rel.overdue ? TONE_TEXT.critical : 'text-foreground')}>
                    {rel.label}
                  </span>
                  {wo.scheduledDate}
                </p>
              </div>
              <Badge variant={wo.woType === 'frequent' ? 'secondary' : 'warning'} className="shrink-0">
                {tInspection(`type.${wo.woType}`)}
              </Badge>
              <Badge variant={INSPECTION_STATUS_VARIANT[wo.status]} className="shrink-0">
                {tInspection(`status.${wo.status}`)}
              </Badge>
              {wo.result ? (
                <Badge variant={INSPECTION_RESULT_VARIANT[wo.result]} className="shrink-0">
                  {tInspection(`result.${wo.result}`)}
                </Badge>
              ) : (
                <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">—</span>
              )}
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            </Link>
          );
        })
      )}
    </div>
  );
}
