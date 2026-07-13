import type { ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMaintenanceDetail } from '@crane/features/maintenance';
import { Badge } from '@crane/ui/atoms/badge';
import {
  REPAIR_PRIORITY_VARIANT as PRIORITY_VARIANT,
  REPAIR_STATUS_VARIANT as STATUS_VARIANT,
} from '../../../shared/ui/status-variants';

export function MaintenanceDetailPage() {
  const { repairId } = useParams<{ repairId: string }>();
  const { repair, sourceInspectionId } = useMaintenanceDetail(repairId ?? '');
  const { t } = useTranslation('maintenance');

  if (!repair) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-muted-foreground">{t('detail.notFound')}</p>
      </div>
    );
  }

  const totalCost =
    (repair.laborCost ?? 0) + (repair.partsCost ?? 0);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Link
          to="/maintenance"
          className="cursor-pointer flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('detail.backLink')}
        </Link>
      </div>

      {/* W/O 헤더 */}
      <div className="rounded border border-border/90 bg-card/60 p-5 shadow-sm backdrop-blur-sm space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold">{repair.woNumber}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              <Link
                to={`/asset-management/${repair.craneId}`}
                className="text-primary hover:underline"
              >
                {repair.craneName}
              </Link>
              {' · '}
              {repair.siteName}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={PRIORITY_VARIANT[repair.priority]}>
              {t(`priority.${repair.priority}`).toUpperCase()}
            </Badge>
            <Badge variant={STATUS_VARIANT[repair.status]}>
              {t(`status.${repair.status}`)}
            </Badge>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
          {([
            { label: t('detail.fields.component'), value: repair.componentName },
            { label: t('detail.fields.failureType'), value: repair.failureType },
            { label: t('detail.fields.repairLevel'), value: repair.repairLevel },
            { label: t('detail.fields.performer'), value: repair.performerType === 'internal' ? t('detail.fields.performerInternal') : t('detail.fields.performerExternal') },
            { label: t('detail.fields.assignedTo'), value: repair.assignedTo },
            {
              label: t('detail.fields.source'),
              value:
                sourceInspectionId && repair.sourceWoNumber ? (
                  <Link
                    to={`/inspection/${sourceInspectionId}`}
                    className="inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    {repair.sourceWoNumber}
                    <ChevronRight className="size-3" />
                  </Link>
                ) : (
                  repair.sourceType
                ),
            },
            { label: t('detail.fields.scheduledStart'), value: repair.scheduledStart.slice(0, 10) },
            { label: t('detail.fields.scheduledEnd'), value: repair.scheduledEnd.slice(0, 10) },
            { label: t('detail.fields.actualStart'), value: repair.actualStart?.slice(0, 10) ?? '—' },
            { label: t('detail.fields.actualEnd'), value: repair.actualEnd?.slice(0, 10) ?? '—' },
            { label: t('detail.fields.downtime'), value: repair.downtimeHours != null ? `${repair.downtimeHours} h` : '—' },
            { label: t('detail.fields.reInspection'), value: repair.reInspectionResult ?? '—' },
          ] as { label: string; value: ReactNode }[]).map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium mt-0.5 capitalize">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="rounded bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">{t('detail.failureDescription')}</p>
          <p className="text-sm">{repair.failureDescription}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 사용 부품 */}
        <div className="rounded border border-border/90 bg-card/60 p-5 shadow-sm backdrop-blur-sm space-y-3">
          <h2 className="text-base font-bold">{t('detail.partsUsed')}</h2>
          {repair.partsUsed.length === 0 ? (
            <div className="rounded border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              {t('detail.noParts')}
            </div>
          ) : (
            <div className="space-y-1">
              {repair.partsUsed.map((p) => (
                <Link
                  key={p.partId}
                  to={`/inventory?part=${encodeURIComponent(p.partId)}`}
                  className="group flex items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
                  title={t('detail.viewPart')}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <Package className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                    <span className="truncate">{p.partName}</span>
                  </span>
                  <span className="ml-4 text-muted-foreground tabular-nums">×{p.qty}</span>
                  <span className="ml-4 font-medium tabular-nums">${(p.qty * p.unitCost).toLocaleString()}</span>
                </Link>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-border pt-2 mt-2">
                <span>{t('detail.partsCost')}</span>
                <span>${repair.partsCost?.toLocaleString() ?? '—'}</span>
              </div>
              {repair.laborCost != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('detail.laborCost', { hours: repair.laborHours })}</span>
                  <span>${repair.laborCost.toLocaleString()}</span>
                </div>
              )}
              {totalCost > 0 && (
                <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
                  <span>{t('detail.totalCost')}</span>
                  <span>${totalCost.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RCA / 조치사항 */}
        <div className="rounded border border-border/90 bg-card/60 p-5 shadow-sm backdrop-blur-sm space-y-3">
          <h2 className="text-base font-bold">{t('detail.analysisActions')}</h2>
          {[
            { label: t('detail.rootCause'), value: repair.rootCause },
            { label: t('detail.correctiveAction'), value: repair.correctiveAction },
            { label: t('detail.preventiveAction'), value: repair.preventiveAction },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="text-sm mt-0.5">{value ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
