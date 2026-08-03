import { AlertTriangle, FileDown, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useComplianceSummary, useRequestCertRenewal } from '@crane/features/compliance';
import { Badge } from '@crane/ui/atoms/badge';
import { cn } from '@crane/core/lib/utils';
import { PAGE_TITLE, PAGE_SUBTITLE, PAGE_CONTAINER } from '../../../shared/ui/page';
import { TONE_BORDER_ACCENT, TONE_TEXT, type Tone } from '../../../shared/ui/tone';
import { SURFACE_CARD } from '../../../shared/ui/surface';
import { CERT_STATUS_VARIANT } from '../../../shared/ui/status-variants';
import { MetricCard } from '../../../shared/ui/metric-card';
import { AlertBanner } from '../../../shared/ui/alert-banner';
import { formatRelativeDate } from '../../../shared/lib/relative-date';
import { formatDateLabel } from '../../../shared/lib/format-date';
import { FOCUS_RING } from '../../../shared/ui/controls';

/** 만료 임박 강조 기준 일수 */
const EXPIRY_SOON_DAYS = 30;

export function CompliancePage() {
  const { certifications, oshaReports, summary } = useComplianceSummary();
  const { t, i18n } = useTranslation('compliance');
  const requestRenewal = useRequestCertRenewal();

  const expiredCerts = certifications.filter((c) => c.status === 'expired');
  const expirySoonCerts = certifications.filter((c) => c.status === 'expiry_soon');

  // 만료·임박 인증서를 본 자리에서 바로 갱신 착수 — 상태를 'renewing'으로 전환(+Undo)
  const handleRequestRenewal = (certId: string, personName: string) => {
    const undo = requestRenewal(certId);
    if (!undo) return;
    toast.success(t('toast.renewalRequested', { name: personName, defaultValue: `Renewal requested for ${personName}` }), {
      action: { label: t('undo', { ns: 'common', defaultValue: 'Undo' }), onClick: undo },
    });
  };

  return (
    <div className={PAGE_CONTAINER}>
      <div>
        <h1 className={PAGE_TITLE}>{t('title')}</h1>
        <p className={cn(PAGE_SUBTITLE, 'mt-0.5')}>{t('description')}</p>
      </div>

      {/* 메트릭 */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: t('metrics.completionRateFrequent'),
            value: `${summary.frequentCompletionRate}%`,
            tone: summary.frequentCompletionRate < 80 ? 'warning' : 'neutral',
            to: '/inspection?type=frequent',
          },
          {
            label: t('metrics.completionRatePeriodic'),
            value: `${summary.periodicCompletionRate}%`,
            tone: summary.periodicCompletionRate < 80 ? 'critical' : 'neutral',
            to: '/inspection?type=periodic',
          },
          {
            // 만료(더 심각)가 임박에 가려지지 않게 합산 카드로 — 내역은 sub에 분리
            label: t('metrics.certAlerts', { defaultValue: 'Cert Alerts' }),
            value: summary.expiredCerts + summary.expiringCerts,
            sub: t('metrics.certAlertsSub', {
              expired: summary.expiredCerts,
              soon: summary.expiringCerts,
              defaultValue: '{{expired}} expired · {{soon}} expiring',
            }),
            tone:
              summary.expiredCerts > 0
                ? 'critical'
                : summary.expiringCerts > 0
                  ? 'warning'
                  : 'neutral',
          },
          {
            label: t('metrics.openReports'),
            value: summary.openFindings,
            tone: summary.openFindings > 0 ? 'warning' : 'neutral',
          },
        ].map(({ label, value, tone, to, sub }) => (
          <MetricCard key={label} label={label} value={value} sub={sub} tone={tone as Tone} to={to} />
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
        <div className={cn(SURFACE_CARD, 'p-5 space-y-3')}>
          <h2 className="text-base font-bold">{t('certifications.title')}</h2>
          <div className="space-y-1">
            {certifications.map((cert) => {
              const { label: dateLabel, diff } = formatRelativeDate(cert.expiryDate);
              const isExpired = cert.status === 'expired';
              // 만료·임박이면서 아직 갱신 요청 전인 경우에만 조치 버튼 노출
              const canRenew = cert.status === 'expired' || cert.status === 'expiry_soon';
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
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={CERT_STATUS_VARIANT[cert.status]}>
                      {t(`certifications.status.${cert.status}`)}
                    </Badge>
                    <p className={cn('text-xs font-semibold tabular-nums', isExpired ? TONE_TEXT.critical : diff <= EXPIRY_SOON_DAYS ? TONE_TEXT.warning : 'text-muted-foreground')}>
                      {isExpired ? t('certifications.expired') : dateLabel}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatDateLabel(cert.expiryDate, i18n.language)}</p>
                    {canRenew && (
                      <button
                        type="button"
                        onClick={() => handleRequestRenewal(cert.id, cert.personName)}
                        className={cn('mt-0.5 flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        {t('certifications.requestRenewal', { defaultValue: 'Request renewal' })}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* OSHA 보고서 목록 */}
        <div className={cn(SURFACE_CARD, 'p-5 space-y-3')}>
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
                    <p className="text-xs text-muted-foreground">{formatDateLabel(report.inspectionDate, i18n.language)} · {report.inspectorName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge
                      variant={report.result === 'pass' ? 'success' : report.result === 'fail' ? 'destructive' : 'warning'}
                    >
                      {t(`oshaReports.result.${report.result}`)}
                    </Badge>
                    <button
                      onClick={() => toast.info(`${report.reportNumber} — ${t('oshaReports.downloadStarted')}`)}
                      className={cn('cursor-pointer flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors', FOCUS_RING)}
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
