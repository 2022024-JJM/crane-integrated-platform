import { Activity, ArrowRight } from 'lucide-react';
import { useRegionRealtimeAlarms } from '@/features/alarm';

import { Badge } from '@/shared/ui/atoms/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/molecules/card';
import { ScrollArea } from '@/shared/ui/molecules/scroll-area';
import type { DashboardRegionStatusDatum } from '../model';
import {
  DashboardRegionStatusSkeleton,
  DashboardRiskCranesSkeleton,
} from './dashboard-skeletons';
import {
  formatYearMonth,
  type DashboardSectionSharedProps,
  type DashboardTranslate,
} from './dashboard-helpers';
import {
  DockAlarmStats,
  RecentAlarmRow,
  RiskCraneRow,
} from './dashboard-parts';

interface DashboardRecentAlarmsSectionProps extends DashboardSectionSharedProps {
  formatTimestamp: (value: string) => string;
  locale: string;
}

export function DashboardOverviewHeader({
  summary,
  translate,
}: Pick<DashboardSectionSharedProps, 'summary' | 'translate'>) {
  return (
    <div className="border-border/90 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
            <Activity className="size-4 text-amber-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              {translate('dashboard:sections.trend.title')}
            </h2>
            <p className="text-muted-foreground text-sm">
              {translate('dashboard:sections.trend.description')}
            </p>
          </div>
        </div>
      </div>
      <div className="flex w-fit items-center gap-2 text-sm md:self-end">
        <span className="text-muted-foreground">
          {translate('dashboard:sections.trend.rangeLabel')}
        </span>
        <span className="text-foreground font-semibold tracking-tight tabular-nums">
          {translate('dashboard:sections.trend.range', {
            from: formatYearMonth(summary.monthlyTrend[0]?.dateKey),
            to: formatYearMonth(
              summary.monthlyTrend[summary.monthlyTrend.length - 1]?.dateKey,
            ),
          })}
        </span>
      </div>
    </div>
  );
}

function DockCard({
  regionStatus,
  translate,
  locale,
  onOpen,
}: {
  regionStatus: DashboardRegionStatusDatum;
  translate: DashboardTranslate;
  locale: string;
  onOpen: (regionStatus: DashboardRegionStatusDatum) => void;
}) {
  const { stats } = useRegionRealtimeAlarms(regionStatus.regionId);

  return (
    <button
      type="button"
      className="group border-border/90 bg-card/70 hover:border-primary/30 hover:bg-accent/20 block w-full cursor-pointer rounded-2xl border p-3 text-left transition"
      onClick={() => onOpen(regionStatus)}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <div>
          <p className="font-medium">{translate(regionStatus.titleKey)}</p>
          <p className="text-muted-foreground text-xs">
            {translate('dashboard:charts.regionStatus.totalCranes', {
              count: regionStatus.total,
            })}
          </p>
        </div>
        <ArrowRight className="text-muted-foreground group-hover:text-foreground size-4 transition" />
      </div>
      <DockAlarmStats stats={stats} locale={locale} />
    </button>
  );
}

export function DashboardRegionStatusSection({
  summary,
  isLoading,
  translate,
  locale,
  onRegionPreviewOpen,
}: DashboardSectionSharedProps & {
  locale: string;
  onRegionPreviewOpen: (regionStatus: DashboardRegionStatusDatum) => void;
}) {
  return (
    <Card className="border-border/90 bg-background/60 border shadow-none xl:h-full">
      <CardHeader>
        <div>
          <CardTitle>
            {translate('dashboard:charts.regionStatus.title')}
          </CardTitle>
          <CardDescription>
            {translate('dashboard:charts.regionStatus.description')}
          </CardDescription>
        </div>
        <CardAction>
          <Badge className="border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300">
            {translate('dashboard:badges.now')}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4 xl:flex-1">
        {isLoading ? (
          <DashboardRegionStatusSkeleton />
        ) : (
          <>
            <div className="space-y-3">
              {summary.regionStatuses.map((regionStatus) => (
                <DockCard
                  key={regionStatus.regionId}
                  regionStatus={regionStatus}
                  translate={translate}
                  locale={locale}
                  onOpen={onRegionPreviewOpen}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardRiskCranesSection({
  summary,
  isLoading,
  translate,
  locale,
}: DashboardSectionSharedProps & {
  locale: string;
}) {
  return (
    <Card className="border-border/90 bg-background/60 border shadow-none xl:h-full">
      <CardHeader>
        <div>
          <CardTitle>
            {translate('dashboard:charts.riskCranes.title')}
          </CardTitle>
          <CardDescription>
            {translate('dashboard:charts.riskCranes.description')}
          </CardDescription>
        </div>
        <CardAction>
          <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300">
            {translate('dashboard:badges.priority')}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <DashboardRiskCranesSkeleton />
        ) : (
          <ScrollArea className="pr-3">
            <div className="space-y-2">
              {summary.riskCranes.map((crane) => (
                <RiskCraneRow
                  key={crane.craneId}
                  crane={crane}
                  locale={locale}
                  translate={translate}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardRecentAlarmsSection({
  summary,
  translate,
  formatTimestamp,
  locale,
}: DashboardRecentAlarmsSectionProps) {
  return (
    <Card className="border-border/90 bg-background/60 border shadow-none xl:h-full">
      <CardHeader>
        <div>
          <CardTitle>
            {translate('dashboard:sections.recentAlarms.title')}
          </CardTitle>
          <CardDescription>
            {translate('dashboard:sections.recentAlarms.description')}
          </CardDescription>
        </div>
        <CardAction>
          <Badge className="border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300">
            {summary.recentAlarms.length}
            {translate('dashboard:units.count')}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {summary.recentAlarms.length > 0 ? (
          <div className="space-y-2">
            {summary.recentAlarms.map((alarm) => (
              <RecentAlarmRow
                key={alarm.id}
                alarm={alarm}
                formatTimestamp={formatTimestamp}
                locale={locale}
                translate={translate}
              />
            ))}
          </div>
        ) : (
          <div className="border-border/90 text-muted-foreground rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
            {translate('dashboard:sections.recentAlarms.empty')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
