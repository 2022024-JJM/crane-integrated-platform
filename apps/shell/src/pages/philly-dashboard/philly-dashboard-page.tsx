import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Layers,
  Package,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  Warehouse,
  Activity,
} from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crane/ui/molecules/card';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { usePhillyDashboard } from './use-philly-dashboard';

// ── 우선순위 배지 색상 ──────────────────────────────────────────
const priorityBadgeClass: Record<string, string> = {
  emergency:
    'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  high: 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  normal:
    'border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  low: 'border-border bg-muted/40 text-muted-foreground',
};

const repairStatusClass: Record<string, string> = {
  received: 'border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-400',
  waiting_parts: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  in_progress: 'border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  re_inspection: 'border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-400',
  on_hold: 'border-slate-500/25 bg-slate-500/10 text-slate-400',
};

const inspectionStatusClass: Record<string, string> = {
  overdue: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  in_progress: 'border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400',
};

const inventoryStatusClass: Record<string, string> = {
  out_of_stock: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  low: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

// ── KPI 카드 ──────────────────────────────────────────────────
function KpiCard({
  icon: Icon,
  iconColorClass,
  iconBgClass,
  label,
  value,
  valueColorClass,
  meta,
  metaColorClass,
  href,
  warning,
}: {
  icon: LucideIcon;
  iconColorClass: string;
  iconBgClass: string;
  label: string;
  value: string | number;
  valueColorClass?: string;
  meta?: string;
  metaColorClass?: string;
  href?: string;
  warning?: boolean;
}) {
  const inner = (
    <Card
      size="sm"
      className={cn(
        'border-border/90 bg-card/80 h-full min-h-32 justify-between border shadow-sm transition',
        warning && 'border-amber-500/35 bg-amber-500/5 shadow-amber-500/5',
      )}
    >
      <CardHeader className="gap-2 pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-lg',
                iconBgClass,
              )}
            >
              <Icon className={cn('size-4', iconColorClass)} />
            </div>
            <CardTitle className="text-[14px] leading-tight text-foreground">
              {label}
            </CardTitle>
          </div>
        </div>
        {href && (
          <CardAction>
            <ArrowRight className="text-primary size-3.5" />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="mt-auto space-y-1 pt-0">
        <p
          className={cn(
            'ml-1 text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums',
            valueColorClass ?? 'text-foreground',
          )}
        >
          {value}
        </p>
        {meta && (
          <p className={cn('text-xs leading-4', metaColorClass ?? 'text-muted-foreground')}>
            {meta}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link to={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

// ── 사이트 현황 카드 ──────────────────────────────────────────
function SiteCard({
  siteKey,
  total,
  operating,
  repair,
  activeRepairs,
  overdueInspections,
  icon,
  t,
}: {
  siteKey: string;
  total: number;
  operating: number;
  repair: number;
  activeRepairs: number;
  overdueInspections: number;
  icon: 'outdoor' | 'indoor';
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const hasIssue = overdueInspections > 0 || activeRepairs > 0;
  return (
    <div
      className={cn(
        'rounded-2xl border p-3',
        hasIssue
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-border/90 bg-card/70',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex size-7 items-center justify-center rounded-lg',
              icon === 'outdoor'
                ? 'border border-blue-500/25 bg-blue-500/10'
                : 'border border-violet-500/25 bg-violet-500/10',
            )}
          >
            <Building2
              className={cn(
                'size-3.5',
                icon === 'outdoor' ? 'text-blue-500' : 'text-violet-500',
              )}
            />
          </div>
          <p className="text-sm font-semibold">{t(`siteCard.sites.${siteKey}`, { defaultValue: siteKey })}</p>
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">
          {t('siteCard.cranes', { count: total })}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        <div className="rounded-lg bg-emerald-500/10 px-2 py-1.5 text-center">
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            {t('siteCard.operating')}
          </p>
          <p className="mt-0.5 text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {operating}
          </p>
        </div>
        <div
          className={cn(
            'rounded-lg px-2 py-1.5 text-center',
            repair > 0 ? 'bg-red-500/10' : 'bg-muted/40',
          )}
        >
          <p
            className={cn(
              'text-[10px] font-medium',
              repair > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground',
            )}
          >
            {t('siteCard.repair')}
          </p>
          <p
            className={cn(
              'mt-0.5 text-sm font-bold tabular-nums',
              repair > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground',
            )}
          >
            {repair}
          </p>
        </div>
        <div
          className={cn(
            'rounded-lg px-2 py-1.5 text-center',
            overdueInspections > 0 ? 'bg-amber-500/10' : 'bg-muted/40',
          )}
        >
          <p
            className={cn(
              'text-[10px] font-medium',
              overdueInspections > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground',
            )}
          >
            {t('siteCard.overdue')}
          </p>
          <p
            className={cn(
              'mt-0.5 text-sm font-bold tabular-nums',
              overdueInspections > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground',
            )}
          >
            {overdueInspections}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────
export function PhillyDashboardPage() {
  const { t } = useTranslation('philly-dashboard');
  const {
    totalCranes,
    operatingCranes,
    downCranes,
    inspectionCompletionRate,
    overdue,
    activeRepairs,
    emergencyRepairs,
    waitingParts,
    avgMttrHours,
    lowStockCount,
    criticalLowStock,
    expiredCerts,
    expiringSoonCerts,
    recentRepairs,
    urgentInspections,
    criticalParts,
    siteBreakdown,
  } = usePhillyDashboard();

  const hasAlerts = emergencyRepairs > 0 || overdue > 0 || expiredCerts > 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ── 헤더 ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('header.title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('header.subtitle')}
          </p>
        </div>
        <Link
          to="/ticket/create"
          className="shrink-0 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('createButton', { ns: 'ticket', defaultValue: 'New Ticket' })}
        </Link>
      </div>

      {/* ── 긴급 알림 배너 ── */}
      {hasAlerts && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-red-500" />
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              {t('alert.actionRequired')}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {emergencyRepairs > 0 && (
              <Link to="/maintenance">
                <Badge className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 cursor-pointer hover:bg-red-500/20">
                  {t('alert.emergencyRepair', { count: emergencyRepairs })}
                </Badge>
              </Link>
            )}
            {overdue > 0 && (
              <Link to="/inspection">
                <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-amber-500/20">
                  {t('alert.overdueInspection', { count: overdue })}
                </Badge>
              </Link>
            )}
            {expiredCerts > 0 && (
              <Link to="/compliance">
                <Badge className="border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400 cursor-pointer hover:bg-orange-500/20">
                  {t('alert.expiredCert', { count: expiredCerts })}
                </Badge>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── KPI 메트릭 카드 (8개) ── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <KpiCard
          icon={Layers}
          iconColorClass="text-blue-500"
          iconBgClass="border border-blue-500/25 bg-blue-500/10"
          label={t('kpi.totalCranes.label')}
          value={totalCranes}
          meta={t('kpi.totalCranes.meta', { operating: operatingCranes, down: downCranes })}
          metaColorClass={downCranes > 0 ? 'text-red-500' : 'text-muted-foreground'}
          href="/asset-management"
        />
        <KpiCard
          icon={ClipboardCheck}
          iconColorClass="text-emerald-500"
          iconBgClass="border border-emerald-500/25 bg-emerald-500/10"
          label={t('kpi.inspectionRate.label')}
          value={`${inspectionCompletionRate}%`}
          valueColorClass={
            inspectionCompletionRate >= 80
              ? 'text-emerald-500'
              : inspectionCompletionRate >= 60
                ? 'text-amber-500'
                : 'text-red-500'
          }
          meta={overdue > 0 ? t('kpi.inspectionRate.overdue', { count: overdue }) : t('kpi.inspectionRate.onSchedule')}
          metaColorClass={overdue > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}
          href="/inspection"
          warning={overdue > 0}
        />
        <KpiCard
          icon={Wrench}
          iconColorClass="text-amber-500"
          iconBgClass="border border-amber-500/25 bg-amber-500/10"
          label={t('kpi.activeRepairs.label')}
          value={activeRepairs}
          valueColorClass={activeRepairs > 0 ? 'text-amber-500' : 'text-foreground'}
          meta={
            emergencyRepairs > 0
              ? t('kpi.activeRepairs.emergency', { emergency: emergencyRepairs, waiting: waitingParts })
              : waitingParts > 0
                ? t('kpi.activeRepairs.waitingOnly', { waiting: waitingParts })
                : t('kpi.activeRepairs.noIssues')
          }
          metaColorClass={emergencyRepairs > 0 ? 'text-red-500' : 'text-muted-foreground'}
          href="/maintenance"
          warning={emergencyRepairs > 0}
        />
        <KpiCard
          icon={Clock}
          iconColorClass="text-violet-500"
          iconBgClass="border border-violet-500/25 bg-violet-500/10"
          label={t('kpi.avgMttr.label')}
          value={`${avgMttrHours}h`}
          valueColorClass="text-foreground"
          meta={t('kpi.avgMttr.meta')}
        />
        <KpiCard
          icon={Package}
          iconColorClass={lowStockCount > 0 ? 'text-amber-500' : 'text-teal-500'}
          iconBgClass={
            lowStockCount > 0
              ? 'border border-amber-500/25 bg-amber-500/10'
              : 'border border-teal-500/25 bg-teal-500/10'
          }
          label={t('kpi.lowStock.label')}
          value={lowStockCount}
          valueColorClass={lowStockCount > 0 ? 'text-amber-500' : 'text-foreground'}
          meta={
            criticalLowStock > 0
              ? t('kpi.lowStock.criticalParts', { count: criticalLowStock })
              : t('kpi.lowStock.noShortage')
          }
          metaColorClass={criticalLowStock > 0 ? 'text-red-500' : 'text-muted-foreground'}
          href="/inventory"
          warning={criticalLowStock > 0}
        />
        <KpiCard
          icon={ShieldCheck}
          iconColorClass={expiredCerts > 0 ? 'text-red-500' : 'text-emerald-500'}
          iconBgClass={
            expiredCerts > 0
              ? 'border border-red-500/25 bg-red-500/10'
              : 'border border-emerald-500/25 bg-emerald-500/10'
          }
          label={t('kpi.certifications.label')}
          value={expiredCerts > 0 ? t('kpi.certifications.expired', { count: expiredCerts }) : t('kpi.certifications.allValid')}
          valueColorClass={expiredCerts > 0 ? 'text-red-500 text-xl' : 'text-emerald-500 text-xl'}
          meta={expiringSoonCerts > 0 ? t('kpi.certifications.expiringSoon', { count: expiringSoonCerts }) : t('kpi.certifications.noExpiry')}
          metaColorClass={
            expiringSoonCerts > 0 ? 'text-amber-500' : 'text-muted-foreground'
          }
          href="/compliance"
          warning={expiredCerts > 0}
        />
        <KpiCard
          icon={Activity}
          iconColorClass="text-cyan-500"
          iconBgClass="border border-cyan-500/25 bg-cyan-500/10"
          label={t('kpi.operatingRate.label')}
          value={`${Math.round((operatingCranes / totalCranes) * 100)}%`}
          valueColorClass={
            operatingCranes / totalCranes >= 0.9
              ? 'text-emerald-500'
              : 'text-amber-500'
          }
          meta={t('kpi.operatingRate.meta', { operating: operatingCranes, total: totalCranes })}
        />
        <KpiCard
          icon={ShieldAlert}
          iconColorClass={emergencyRepairs > 0 ? 'text-red-500' : 'text-slate-400'}
          iconBgClass={
            emergencyRepairs > 0
              ? 'border border-red-500/25 bg-red-500/10'
              : 'border border-border bg-muted/30'
          }
          label={t('kpi.emergencyWO.label')}
          value={emergencyRepairs}
          valueColorClass={emergencyRepairs > 0 ? 'text-red-500' : 'text-foreground'}
          meta={emergencyRepairs > 0 ? t('kpi.emergencyWO.action') : t('kpi.emergencyWO.noEmergency')}
          metaColorClass={emergencyRepairs > 0 ? 'text-red-500' : 'text-muted-foreground'}
          href="/maintenance"
          warning={emergencyRepairs > 0}
        />
      </section>

      {/* ── 메인 콘텐츠 섹션 ── */}
      <section className="border-border/90 bg-card/60 rounded-xl border p-4 shadow-sm backdrop-blur-sm md:p-5">
        {/* 섹션 헤더 */}
        <div className="border-border/90 mb-4 flex items-center gap-3 border-b pb-4">
          <div className="flex size-8 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
            <Activity className="size-4 text-amber-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{t('overview.title')}</h2>
            <p className="text-muted-foreground text-xs">
              {t('overview.subtitle')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* 좌측: 수리 W/O + 점검 현황 */}
          <div className="grid grid-rows-2 gap-4">
            {/* 수리 W/O 현황 */}
            <Card className="border-border/90 bg-background/60 flex flex-col border shadow-none">
              <CardHeader>
                <div>
                  <CardTitle>{t('repairCard.title')}</CardTitle>
                  <CardDescription>
                    {t('repairCard.subtitle')}
                  </CardDescription>
                </div>
                <CardAction>
                  <Link to="/maintenance">
                    <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300 cursor-pointer hover:bg-amber-500/20">
                      {t('repairCard.active', { count: activeRepairs })}
                    </Badge>
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                {recentRepairs.length === 0 ? (
                  <div className="border-border/90 text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
                    {t('repairCard.empty')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentRepairs.map((repair) => (
                      <Link
                        key={repair.id}
                        to={`/maintenance/${repair.id}`}
                        className="border-border/90 bg-card/70 hover:border-primary/30 hover:bg-accent/20 block rounded-2xl border p-3 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                className={cn(
                                  'border shrink-0',
                                  priorityBadgeClass[repair.priority],
                                )}
                              >
                                {t(`status.priority.${repair.priority}`, { defaultValue: repair.priority.toUpperCase() })}
                              </Badge>
                              <span className="truncate text-sm font-medium">
                                {repair.craneName}
                              </span>
                            </div>
                            <p className="text-muted-foreground mt-1 truncate text-xs">
                              {repair.componentName} · {repair.failureDescription.slice(0, 60)}
                              {repair.failureDescription.length > 60 ? '…' : ''}
                            </p>
                          </div>
                          <Badge
                            className={cn(
                              'border shrink-0',
                              repairStatusClass[repair.status] ??
                                'border-border bg-muted/40 text-muted-foreground',
                            )}
                          >
                            {t(`status.repair.${repair.status}`, { defaultValue: repair.status })}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
                          <span>{repair.woNumber}</span>
                          <span>·</span>
                          <span>{repair.siteName}</span>
                          <span>·</span>
                          <span>{repair.assignedTo}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 점검 현황 */}
            <Card className="border-border/90 bg-background/60 flex flex-col border shadow-none">
              <CardHeader>
                <div>
                  <CardTitle>{t('inspectionCard.title')}</CardTitle>
                  <CardDescription>
                    {t('inspectionCard.subtitle')}
                  </CardDescription>
                </div>
                <CardAction>
                  <Link to="/inspection">
                    <Badge
                      className={cn(
                        'border cursor-pointer',
                        overdue > 0
                          ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                          : 'border-border bg-muted/40 text-muted-foreground',
                      )}
                    >
                      {t('inspectionCard.overdue', { count: overdue })}
                    </Badge>
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                {urgentInspections.length === 0 ? (
                  <div className="border-border/90 text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
                    <CheckCircle2 className="mx-auto mb-2 size-5 text-emerald-500" />
                    {t('inspectionCard.empty')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {urgentInspections.map((insp) => {
                      const scheduledDate = new Date(insp.scheduledDate);
                      const today = new Date();
                      const diffDays = Math.round(
                        (today.getTime() - scheduledDate.getTime()) /
                          (1000 * 60 * 60 * 24),
                      );

                      return (
                        <Link
                          key={insp.id}
                          to={`/inspection/${insp.id}`}
                          className="border-border/90 bg-card/70 hover:border-primary/30 hover:bg-accent/20 block rounded-2xl border p-3 transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={cn(
                                    'border shrink-0',
                                    inspectionStatusClass[insp.status] ??
                                      'border-border bg-muted/40 text-muted-foreground',
                                  )}
                                >
                                  {insp.status === 'overdue'
                                    ? t('inspectionCard.statusOverdue')
                                    : t('inspectionCard.statusInProgress')}
                                </Badge>
                                <span className="truncate text-sm font-medium">
                                  {insp.craneName}
                                </span>
                              </div>
                              <p className="text-muted-foreground mt-1 text-xs">
                                {insp.woType === 'frequent'
                                  ? t('inspectionCard.typeFrequent')
                                  : t('inspectionCard.typePeriodic')}{' '}
                                · {insp.siteName} · {insp.assignedTo}
                              </p>
                            </div>
                            {insp.status === 'overdue' && (
                              <span className="shrink-0 text-xs font-semibold text-red-500 tabular-nums">
                                D+{diffDays}
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                            <span>{insp.woNumber}</span>
                            <span>·</span>
                            <span>
                              {t('inspectionCard.scheduled')} {insp.scheduledDate}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 우측: 사이트 현황 + 부품 알림 */}
          <div className="grid grid-rows-2 gap-4">
            {/* 사이트별 현황 */}
            <Card className="border-border/90 bg-background/60 flex flex-col border shadow-none">
              <CardHeader>
                <div>
                  <CardTitle>{t('siteCard.title')}</CardTitle>
                  <CardDescription>{t('siteCard.subtitle')}</CardDescription>
                </div>
                <CardAction>
                  <Badge className="border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300">
                    {t('siteCard.live')}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="space-y-2">
                    {siteBreakdown.map((site) => (
                      <SiteCard key={site.siteId} {...site} t={t} />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* 부품 재고 알림 */}
            <Card className="border-border/90 bg-background/60 flex flex-col border shadow-none">
              <CardHeader>
                <div>
                  <CardTitle>{t('partsCard.title')}</CardTitle>
                  <CardDescription>
                    {t('partsCard.subtitle')}
                  </CardDescription>
                </div>
                <CardAction>
                  <Link to="/inventory">
                    <Badge
                      className={cn(
                        'border cursor-pointer',
                        criticalLowStock > 0
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20'
                          : 'border-border bg-muted/40 text-muted-foreground',
                      )}
                    >
                      {t('partsCard.low', { count: lowStockCount })}
                    </Badge>
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                {criticalParts.length === 0 ? (
                  <div className="border-border/90 text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
                    <CheckCircle2 className="mx-auto mb-2 size-5 text-emerald-500" />
                    {t('partsCard.empty')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {criticalParts.map((part) => {
                      const stockPct =
                        part.minStockQty > 0
                          ? Math.round((part.availableQty / part.minStockQty) * 100)
                          : 100;
                      return (
                        <Link
                          key={part.id}
                          to="/inventory"
                          className="border-border/90 bg-card/70 hover:border-primary/30 hover:bg-accent/20 block rounded-2xl border p-3 transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Warehouse className="text-muted-foreground size-3.5 shrink-0" />
                                <p className="truncate text-xs font-medium">
                                  {part.partName.split('—')[0].trim()}
                                </p>
                              </div>
                              <p className="text-muted-foreground mt-0.5 text-xs">
                                {part.partNumber} · {t('partsCard.lead', { days: part.leadTimeDays })}
                              </p>
                            </div>
                            <Badge
                              className={cn(
                                'border shrink-0',
                                inventoryStatusClass[part.status] ??
                                  'border-border bg-muted/40 text-muted-foreground',
                              )}
                            >
                              {t(`status.inventory.${part.status}`, { defaultValue: part.status })}
                            </Badge>
                          </div>
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {t('partsCard.stock', { available: part.availableQty, min: part.minStockQty })}
                              </span>
                              <span
                                className={cn(
                                  'font-medium tabular-nums',
                                  stockPct === 0
                                    ? 'text-red-500'
                                    : 'text-amber-500',
                                )}
                              >
                                {stockPct}%
                              </span>
                            </div>
                            <div className="bg-muted/40 mt-1 h-1.5 overflow-hidden rounded-full">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  stockPct === 0 ? 'bg-red-500' : 'bg-amber-500',
                                )}
                                style={{ width: `${Math.min(stockPct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </section>
    </div>
  );
}
