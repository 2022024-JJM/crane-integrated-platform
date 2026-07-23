import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RepairWO } from '@crane/domain/maintenance';
import { Badge } from '@crane/ui/atoms/badge';
import {
  REPAIR_PRIORITY_VARIANT,
  REPAIR_STATUS_VARIANT,
} from '../../../shared/ui/status-variants';
import { formatRelativeDate } from '../../../shared/lib/relative-date';

// ── 탭: 정비 이력 — 수리 WO 목록 (상세 딥링크) ──
export function AssetMaintenanceTab({ repairs }: { repairs: RepairWO[] }) {
  const { t } = useTranslation('asset-management');
  const { t: tMaintenance } = useTranslation('maintenance');

  return (
    <div className="flex flex-col gap-2">
      {repairs.length === 0 ? (
        <div className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {t('detail.noMaintenanceHistory')}
        </div>
      ) : (
        repairs.map((wo) => (
          <Link
            key={wo.id}
            to={`/maintenance/${wo.id}`}
            className="group flex flex-col gap-1.5 rounded border border-border/90 bg-card/70 px-3.5 py-3 transition-all hover:border-primary/40 hover:bg-card"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{wo.woNumber}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant={REPAIR_PRIORITY_VARIANT[wo.priority]}>
                  {tMaintenance(`priority.${wo.priority}`).toUpperCase()}
                </Badge>
                <Badge variant={REPAIR_STATUS_VARIANT[wo.status]}>
                  {tMaintenance(`status.${wo.status}`)}
                </Badge>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
            </div>
            <p className="truncate text-xs text-muted-foreground">{wo.componentName}</p>
            <p className="line-clamp-1 text-xs text-muted-foreground">{wo.failureDescription}</p>
            <p className="text-xs text-muted-foreground">
              <span className="mr-1 font-semibold text-foreground">
                {formatRelativeDate(wo.scheduledStart).label}
              </span>
              {wo.scheduledStart.slice(0, 10)}
            </p>
          </Link>
        ))
      )}
    </div>
  );
}
