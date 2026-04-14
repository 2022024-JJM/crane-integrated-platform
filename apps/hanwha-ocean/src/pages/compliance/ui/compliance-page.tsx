import { AlertTriangle, AlertCircle, FileDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useComplianceSummary } from '@crane/features/compliance';
import type { CertStatus } from '@crane/domain/compliance';
import { Badge } from '@crane/ui/atoms/badge';

const CERT_STATUS_VARIANT: Record<CertStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  valid: 'success',
  expiry_soon: 'warning',
  expired: 'destructive',
  renewing: 'secondary',
};

function formatRelativeDate(dateStr: string): { label: string; diff: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return { label: 'D-Day', diff };
  if (diff > 0) return { label: `D-${diff}`, diff };
  return { label: `D+${Math.abs(diff)}`, diff };
}

export function CompliancePage() {
  const { certifications, oshaReports, summary } = useComplianceSummary();
  const { t } = useTranslation('compliance');

  const expiredCerts = certifications.filter((c) => c.status === 'expired');
  const expirySoonCerts = certifications.filter((c) => c.status === 'expiry_soon');

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('description')}</p>
      </div>

      {/* 메트릭 */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: t('metrics.completionRateFrequent'),
            value: `${summary.frequentCompletionRate}%`,
            color: summary.frequentCompletionRate >= 80 ? 'text-emerald-500' : 'text-amber-500',
            card: summary.frequentCompletionRate < 80 ? 'border-amber-500/35 bg-amber-500/5' : '',
          },
          {
            label: t('metrics.completionRatePeriodic'),
            value: `${summary.periodicCompletionRate}%`,
            color: summary.periodicCompletionRate >= 80 ? 'text-emerald-500' : 'text-red-500',
            card: summary.periodicCompletionRate < 80 ? 'border-red-500/30 bg-red-500/5' : '',
          },
          {
            label: t('metrics.expiringCerts'),
            value: summary.expiringCerts,
            color: summary.expiringCerts > 0 ? 'text-amber-500' : 'text-emerald-500',
            card: summary.expiringCerts > 0 ? 'border-amber-500/35 bg-amber-500/5' : '',
          },
          {
            label: t('metrics.openReports'),
            value: summary.openFindings,
            color: summary.openFindings > 0 ? 'text-amber-500' : 'text-emerald-500',
            card: '',
          },
        ].map(({ label, value, color, card }) => (
          <div key={label} className={`rounded-2xl border border-border/90 bg-card/80 p-4 shadow-sm min-h-24 flex flex-col justify-between ${card}`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-[1.8rem] leading-none font-semibold tracking-tight tabular-nums mt-2 ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      {/* 만료된 인증서 배너 (red) */}
      {expiredCerts.length > 0 && (
        <div className="rounded-[1.75rem] border border-red-500/40 bg-red-500/5 p-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-bold text-red-500">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {t('certAlert.expiredTitle', {
              count: expiredCerts.length,
              defaultValue: `만료된 인증서 ${expiredCerts.length}건 — 즉각적인 갱신 필요`,
            })}
          </p>
          {expiredCerts.map((cert) => (
            <div key={cert.id} className="flex items-center gap-3 text-sm">
              <Badge variant="destructive" className="shrink-0">
                {t(`certifications.status.${cert.status}`)}
              </Badge>
              <span className="font-medium shrink-0">{cert.personName}</span>
              <span className="text-muted-foreground truncate flex-1">
                {t(`certifications.certType.${cert.certType}`)}
              </span>
              <span className="text-xs font-semibold text-red-500 shrink-0 tabular-nums">
                {t('certifications.expired')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 만료 임박 인증서 배너 (amber) */}
      {expirySoonCerts.length > 0 && (
        <div className="rounded-[1.75rem] border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-500">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {t('certAlert.title', {
              count: expirySoonCerts.length,
              defaultValue: `만료 임박 인증서 ${expirySoonCerts.length}건`,
            })}
          </p>
          {expirySoonCerts.map((cert) => {
            const { label: dateLabel, diff } = formatRelativeDate(cert.expiryDate);
            return (
              <div key={cert.id} className="flex items-center gap-3 text-sm">
                <Badge variant="warning" className="shrink-0">
                  {t(`certifications.status.${cert.status}`)}
                </Badge>
                <span className="font-medium shrink-0">{cert.personName}</span>
                <span className="text-muted-foreground truncate flex-1">
                  {t(`certifications.certType.${cert.certType}`)}
                </span>
                <span className={`text-xs font-semibold shrink-0 tabular-nums ${diff < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                  {dateLabel}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 인증서 목록 */}
        <div className="rounded-[1.75rem] border border-border/90 bg-card/60 p-5 shadow-sm backdrop-blur-sm space-y-3">
          <h2 className="text-base font-bold">{t('certifications.title')}</h2>
          <div className="space-y-1">
            {certifications.map((cert) => {
              const { label: dateLabel, diff } = formatRelativeDate(cert.expiryDate);
              const isExpired = cert.status === 'expired';
              return (
                <div key={cert.id} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {cert.personName}
                      <span className="text-xs text-muted-foreground font-normal ml-1">({cert.role})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{t(`certifications.certType.${cert.certType}`)}</p>
                    <p className="text-xs text-muted-foreground">#{cert.certNumber} · {cert.issuingBody}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={CERT_STATUS_VARIANT[cert.status]} className="mb-1">
                      {t(`certifications.status.${cert.status}`)}
                    </Badge>
                    <p className={`text-xs font-semibold tabular-nums ${isExpired ? 'text-red-500' : diff <= 30 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                      {isExpired ? t('certifications.expired') : dateLabel}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{cert.expiryDate}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* OSHA 보고서 목록 */}
        <div className="rounded-[1.75rem] border border-border/90 bg-card/60 p-5 shadow-sm backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">{t('oshaReports.title')}</h2>
            <span className="text-xs text-muted-foreground">{summary.reportsThisMonth} {t('metrics.thisMonth')}</span>
          </div>
          <div className="space-y-1">
            {oshaReports.map((report) => {
              const isConditional = report.result === 'conditional';
              return (
                <div
                  key={report.id}
                  className={`flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0 ${
                    isConditional ? 'border-l-2 border-l-amber-500/60 pl-3 -ml-3' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{report.reportNumber}</p>
                    <p className="text-xs text-muted-foreground">{report.craneName} · {report.siteName}</p>
                    <p className="text-xs text-muted-foreground">{report.inspectionDate} · {report.inspectorName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge
                      variant={report.result === 'pass' ? 'success' : report.result === 'fail' ? 'destructive' : 'warning'}
                    >
                      {t(`oshaReports.result.${report.result}`)}
                    </Badge>
                    <button
                      onClick={() => toast.info(`${report.reportNumber} — ${t('oshaReports.downloadStarted', { defaultValue: '보고서 다운로드가 시작되었습니다.' })}`)}
                      className="cursor-pointer flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      {t('oshaReports.download')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
