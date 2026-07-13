import { AlertTriangle, FileDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useComplianceSummary } from '@crane/features/compliance';
import { Badge } from '@crane/ui/atoms/badge';
import { cn } from '@crane/core/lib/utils';
import { TONE_BORDER_ACCENT, TONE_DOT, TONE_TEXT } from '../../../shared/ui/tone';
import { CERT_STATUS_VARIANT } from '../../../shared/ui/status-variants';
import { MetricCard } from '../../../shared/ui/metric-card';
import { AlertBanner } from '../../../shared/ui/alert-banner';
import { formatRelativeDate } from '../../../shared/lib/relative-date';

/** 만료 임박 강조 기준 일수 */
const EXPIRY_SOON_DAYS = 30;

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
            dot: summary.frequentCompletionRate < 80 ? TONE_DOT.warning : '',
          },
          {
            label: t('metrics.completionRatePeriodic'),
            value: `${summary.periodicCompletionRate}%`,
            dot: summary.periodicCompletionRate < 80 ? TONE_DOT.critical : '',
          },
          {
            label: t('metrics.expiringCerts'),
            value: summary.expiringCerts,
            dot: summary.expiringCerts > 0 ? TONE_DOT.warning : '',
          },
          {
            label: t('metrics.openReports'),
            value: summary.openFindings,
            dot: summary.openFindings > 0 ? TONE_DOT.warning : '',
          },
        ].map(({ label, value, dot }) => (
          <MetricCard key={label} label={label} value={value} dot={dot} />
        ))}
      </section>

      {/* 만료된 인증서 배너 (red) */}
      {expiredCerts.length > 0 && (
        <AlertBanner tone="critical" title={t('certAlert.expiredTitle', { count: expiredCerts.length })}>
          {expiredCerts.map((cert) => (
            <div key={cert.id} className="flex items-center gap-3 text-sm">
              <Badge variant="destructive" className="shrink-0">
                {t(`certifications.status.${cert.status}`)}
              </Badge>
              <span className="font-medium shrink-0">{cert.personName}</span>
              <span className="text-muted-foreground truncate flex-1">
                {t(`certifications.certType.${cert.certType}`)}
              </span>
              <span className={cn('text-xs font-semibold shrink-0 tabular-nums', TONE_TEXT.critical)}>
                {t('certifications.expired')}
              </span>
            </div>
          ))}
        </AlertBanner>
      )}

      {/* 만료 임박 인증서 배너 (amber) */}
      {expirySoonCerts.length > 0 && (
        <AlertBanner
          tone="warning"
          icon={AlertTriangle}
          title={t('certAlert.title', { count: expirySoonCerts.length })}
        >
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
                <span className={cn('text-xs font-semibold shrink-0 tabular-nums', diff < 0 ? TONE_TEXT.critical : TONE_TEXT.warning)}>
                  {dateLabel}
                </span>
              </div>
            );
          })}
        </AlertBanner>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 인증서 목록 */}
        <div className="rounded border border-border/90 bg-card/60 p-5 shadow-sm backdrop-blur-sm space-y-3">
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
                    <p className={cn('text-xs font-semibold tabular-nums', isExpired ? TONE_TEXT.critical : diff <= EXPIRY_SOON_DAYS ? TONE_TEXT.warning : 'text-muted-foreground')}>
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
        <div className="rounded border border-border/90 bg-card/60 p-5 shadow-sm backdrop-blur-sm space-y-3">
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
                  className={cn(
                    'flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0',
                    isConditional && cn('border-l-2 pl-3 -ml-3', TONE_BORDER_ACCENT.warning),
                  )}
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
                      onClick={() => toast.info(`${report.reportNumber} — ${t('oshaReports.downloadStarted')}`)}
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
