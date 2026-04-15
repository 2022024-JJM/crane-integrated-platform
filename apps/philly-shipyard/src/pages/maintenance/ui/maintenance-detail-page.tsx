import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMaintenanceDetail } from '@crane/features/maintenance';
import { Badge } from '@crane/ui/atoms/badge';

export function MaintenanceDetailPage() {
  const { repairId } = useParams<{ repairId: string }>();
  const { repair } = useMaintenanceDetail(repairId ?? '');
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
              {repair.craneName} · {repair.siteName}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={repair.priority === 'emergency' ? 'destructive' : repair.priority === 'high' ? 'warning' : 'secondary'}>
              {t(`priority.${repair.priority}`).toUpperCase()}
            </Badge>
            <Badge variant={repair.status === 'completed' ? 'success' : repair.status === 'waiting_parts' ? 'warning' : 'secondary'}>
              {t(`status.${repair.status}`).toUpperCase()}
            </Badge>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
          {[
            { label: t('detail.fields.component'), value: repair.componentName },
            { label: t('detail.fields.failureType'), value: repair.failureType },
            { label: t('detail.fields.repairLevel'), value: repair.repairLevel },
            { label: t('detail.fields.performer'), value: repair.performerType === 'internal' ? t('detail.fields.performerInternal') : t('detail.fields.performerExternal') },
            { label: t('detail.fields.assignedTo'), value: repair.assignedTo },
            { label: t('detail.fields.source'), value: repair.sourceType },
            { label: t('detail.fields.scheduledStart'), value: repair.scheduledStart.slice(0, 10) },
            { label: t('detail.fields.scheduledEnd'), value: repair.scheduledEnd.slice(0, 10) },
            { label: t('detail.fields.actualStart'), value: repair.actualStart?.slice(0, 10) ?? '—' },
            { label: t('detail.fields.actualEnd'), value: repair.actualEnd?.slice(0, 10) ?? '—' },
            { label: t('detail.fields.downtime'), value: repair.downtimeHours != null ? `${repair.downtimeHours} h` : '—' },
            { label: t('detail.fields.reInspection'), value: repair.reInspectionResult ?? '—' },
          ].map(({ label, value }) => (
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
            <div className="space-y-2">
              {repair.partsUsed.map((p) => (
                <div key={p.partId} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{p.partName}</span>
                  <span className="text-muted-foreground tabular-nums ml-4">×{p.qty}</span>
                  <span className="font-medium tabular-nums ml-4">${(p.qty * p.unitCost).toLocaleString()}</span>
                </div>
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
