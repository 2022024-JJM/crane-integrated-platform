import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ClipboardCheck,
  Clock,
  Layers,
  Package,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@crane/ui/molecules/card';

interface KpiStripProps {
  totalCranes: number;
  operatingCranes: number;
  downCranes: number;
  inspectionCompletionRate: number;
  overdue: number;
  activeRepairs: number;
  emergencyRepairs: number;
  waitingParts: number;
  avgMttrHours: number;
  lowStockCount: number;
  criticalLowStock: number;
  expiredCerts: number;
  expiringSoonCerts: number;
}

export function KpiStrip(props: KpiStripProps) {
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
  } = props;

  const activeRepairsMeta =
    activeRepairs === 0
      ? t('kpi.activeRepairs.noIssues')
      : emergencyRepairs > 0
        ? t('kpi.activeRepairs.emergency', { emergency: emergencyRepairs, waiting: waitingParts })
        : waitingParts > 0
          ? t('kpi.activeRepairs.waitingOnly', { waiting: waitingParts })
          : t('kpi.activeRepairs.noIssues');

  const certificationValue =
    expiredCerts > 0
      ? t('kpi.certifications.expired', { count: expiredCerts })
      : t('kpi.certifications.allValid');
  const certificationMeta =
    expiringSoonCerts > 0
      ? t('kpi.certifications.expiringSoon', { count: expiringSoonCerts })
      : t('kpi.certifications.noExpiry');

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
      <KpiCard
        icon={Layers}
        iconColorClass="text-blue-500"
        iconBgClass="border border-blue-500/25 bg-blue-500/10"
        label={t('kpi.totalCranes.label')}
        value={totalCranes}
        meta={t('kpi.totalCranes.meta', { operating: operatingCranes, down: downCranes })}
        metaColorClass={downCranes > 0 ? 'text-red-500' : undefined}
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
            : inspectionCompletionRate >= 50
              ? 'text-amber-500'
              : 'text-red-500'
        }
        meta={
          overdue > 0
            ? t('kpi.inspectionRate.overdue', { count: overdue })
            : t('kpi.inspectionRate.onSchedule')
        }
        metaColorClass={overdue > 0 ? 'text-amber-500' : undefined}
        href="/inspection"
        warning={overdue > 0}
      />
      <KpiCard
        icon={Wrench}
        iconColorClass="text-amber-500"
        iconBgClass="border border-amber-500/25 bg-amber-500/10"
        label={t('kpi.activeRepairs.label')}
        value={activeRepairs}
        valueColorClass={emergencyRepairs > 0 ? 'text-red-500' : undefined}
        meta={activeRepairsMeta}
        metaColorClass={emergencyRepairs > 0 ? 'text-red-500' : undefined}
        href="/maintenance"
        warning={emergencyRepairs > 0}
      />
      <KpiCard
        icon={Clock}
        iconColorClass="text-violet-500"
        iconBgClass="border border-violet-500/25 bg-violet-500/10"
        label={t('kpi.avgMttr.label')}
        value={`${avgMttrHours}h`}
        meta={t('kpi.avgMttr.meta')}
      />
      <KpiCard
        icon={Package}
        iconColorClass="text-orange-500"
        iconBgClass="border border-orange-500/25 bg-orange-500/10"
        label={t('kpi.lowStock.label')}
        value={lowStockCount}
        valueColorClass={criticalLowStock > 0 ? 'text-red-500' : undefined}
        meta={
          criticalLowStock > 0
            ? t('kpi.lowStock.criticalParts', { count: criticalLowStock })
            : t('kpi.lowStock.noShortage')
        }
        metaColorClass={criticalLowStock > 0 ? 'text-red-500' : undefined}
        href="/inventory"
        warning={criticalLowStock > 0}
      />
      <KpiCard
        icon={ShieldCheck}
        iconColorClass="text-cyan-500"
        iconBgClass="border border-cyan-500/25 bg-cyan-500/10"
        label={t('kpi.certifications.label')}
        value={certificationValue}
        valueColorClass={expiredCerts > 0 ? 'text-red-500' : undefined}
        meta={certificationMeta}
        metaColorClass={expiringSoonCerts > 0 ? 'text-amber-500' : undefined}
        href="/compliance"
        warning={expiredCerts > 0}
      />
    </section>
  );
}

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
        'border-border/90 bg-card/80 h-full min-h-28 justify-between border shadow-sm transition',
        warning && 'border-amber-500/35 bg-amber-500/5 shadow-amber-500/5',
      )}
    >
      <CardHeader className="gap-2 pb-1">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-lg',
              iconBgClass,
            )}
          >
            <Icon className={cn('size-4', iconColorClass)} />
          </div>
          <CardTitle className="text-[13px] leading-tight text-foreground">{label}</CardTitle>
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
            'ml-1 text-[1.5rem] leading-none font-semibold tracking-tight tabular-nums',
            valueColorClass ?? 'text-foreground',
          )}
        >
          {value}
        </p>
        {meta && (
          <p className={cn('text-[11px] leading-4', metaColorClass ?? 'text-muted-foreground')}>
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
