import { ArrowRight, ShieldAlert } from 'lucide-react';
import { useRegionRealtimeAlarms } from '@crane/features/alarm';

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
import type { DashboardRegionStatusDatum } from '../model';
import {
  formatDateKey,
  type DashboardSectionSharedProps,
  type DashboardTranslate,
} from './dashboard-helpers';
import {
  AlarmJournalRow,
  CollisionHistoryRow,
  DockAlarmStats,
  EmptyStateBox,
} from './dashboard-parts';

export function DashboardOverviewHeader({
  summary,
  translate,
  dayFormatter,
}: Pick<DashboardSectionSharedProps, 'summary' | 'translate'> & {
  dayFormatter: Intl.DateTimeFormat;
}) {
  return (
    <div className="border-border/90 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
            <ShieldAlert className="size-4 text-amber-500" />
          </div>
          <div>
            <h2 id="dashboard-overview-title" className="text-xl font-semibold">
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
            from: formatDateKey(
              summary.collisionTrend[0]?.dateKey,
              dayFormatter,
            ),
            to: formatDateKey(
              summary.collisionTrend[summary.collisionTrend.length - 1]
                ?.dateKey,
              dayFormatter,
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
            {regionStatus.equipmentCount === null
              ? translate('dashboard:charts.regionStatus.sceneUnavailable')
              : translate('dashboard:charts.regionStatus.equipmentCount', {
                  count: regionStatus.equipmentCount,
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
      </CardContent>
    </Card>
  );
}

export function DashboardCollisionHistorySection({
  summary,
  translate,
  formatTime,
}: DashboardSectionSharedProps & {
  formatTime: (at: number) => string;
}) {
  return (
    <Card className="border-border/90 bg-background/60 border shadow-none xl:h-full">
      <CardHeader>
        <div>
          <CardTitle>
            {translate('dashboard:collisionHistory.title')}
          </CardTitle>
          <CardDescription>
            {translate('dashboard:collisionHistory.description')}
          </CardDescription>
        </div>
        <CardAction>
          <Badge className="border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300">
            {summary.recentCollisions.length}
            {translate('dashboard:units.count')}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {summary.recentCollisions.length > 0 ? (
          <ScrollArea className="pr-3">
            <div className="space-y-2">
              {summary.recentCollisions.map((row) => (
                <CollisionHistoryRow
                  key={row.key}
                  row={row}
                  translate={translate}
                  formatTime={formatTime}
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <EmptyStateBox
            message={translate('dashboard:collisionHistory.empty')}
          />
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
}: DashboardSectionSharedProps & {
  formatTimestamp: (value: string) => string;
  locale: string;
}) {
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
            {summary.recentAlarms.map((entry) => (
              <AlarmJournalRow
                key={entry.id}
                entry={entry}
                formatTimestamp={formatTimestamp}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <EmptyStateBox
            message={translate('dashboard:sections.recentAlarms.empty')}
          />
        )}
      </CardContent>
    </Card>
  );
}
