import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Wrench, ClipboardCheck, Warehouse } from 'lucide-react';
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
import type { RepairWO } from '@crane/domain/maintenance';
import type { InspectionWO } from '@crane/domain/inspection';
import type { InventoryItem } from '@crane/domain/inventory';

const priorityBadgeClass: Record<string, string> = {
  emergency: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  high: 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  normal: 'border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  low: 'border-border bg-muted/40 text-muted-foreground',
};

const inspectionStatusClass: Record<string, string> = {
  overdue: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  in_progress: 'border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400',
};

const inventoryStatusClass: Record<string, string> = {
  out_of_stock: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  low: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

interface Props {
  repairs: RepairWO[];
  inspections: InspectionWO[];
  parts: InventoryItem[];
}

export function TopListsStrip({ repairs, inspections, parts }: Props) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <TopRepairs items={repairs} />
      <TopInspections items={inspections} />
      <TopParts items={parts} />
    </section>
  );
}

function ListHeader({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  viewAllHref,
}: {
  icon: typeof Wrench;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  viewAllHref: string;
}) {
  const { t } = useTranslation('philly-dashboard');
  return (
    <CardHeader>
      <div className="flex items-center gap-2">
        <div className={cn('flex size-7 items-center justify-center rounded-lg', iconBg)}>
          <Icon className={cn('size-4', iconColor)} />
        </div>
        <div>
          <CardTitle className="text-sm">{title}</CardTitle>
          <CardDescription className="text-xs">{subtitle}</CardDescription>
        </div>
      </div>
      <CardAction>
        <Link to={viewAllHref}>
          <Badge className="cursor-pointer hover:bg-accent">
            {t('topLists.viewAll', { defaultValue: 'View all' })}
            <ArrowRight className="ml-1 size-3" />
          </Badge>
        </Link>
      </CardAction>
    </CardHeader>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="border-border/90 text-muted-foreground flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-xs">
      <CheckCircle2 className="size-4 text-emerald-500" />
      {message}
    </div>
  );
}

function TopRepairs({ items }: { items: RepairWO[] }) {
  const { t } = useTranslation('philly-dashboard');
  return (
    <Card className="h-full">
      <ListHeader
        icon={Wrench}
        iconColor="text-amber-500"
        iconBg="border border-amber-500/25 bg-amber-500/10"
        title={t('topLists.repairs.title', { defaultValue: 'Top Repairs' })}
        subtitle={t('topLists.repairs.subtitle', { defaultValue: 'By priority' })}
        viewAllHref="/maintenance"
      />
      <CardContent>
        {items.length === 0 ? (
          <EmptyRow message={t('topLists.repairs.empty', { defaultValue: 'No active repairs' })} />
        ) : (
          <ul className="space-y-1.5">
            {items.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/maintenance/${r.id}`}
                  className="block rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs transition hover:border-primary/30 hover:bg-accent/20"
                >
                  <div className="flex items-center gap-2">
                    <Badge className={cn('border shrink-0 text-[10px]', priorityBadgeClass[r.priority])}>
                      {t(`status.priority.${r.priority}`, { defaultValue: r.priority })}
                    </Badge>
                    <span className="truncate font-medium">{r.craneName}</span>
                    <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">
                      {r.woNumber}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 truncate">
                    {r.componentName} · {r.assignedTo}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TopInspections({ items }: { items: InspectionWO[] }) {
  const { t } = useTranslation('philly-dashboard');
  return (
    <Card className="h-full">
      <ListHeader
        icon={ClipboardCheck}
        iconColor="text-emerald-500"
        iconBg="border border-emerald-500/25 bg-emerald-500/10"
        title={t('topLists.inspections.title', { defaultValue: 'Top Inspections' })}
        subtitle={t('topLists.inspections.subtitle', { defaultValue: 'Overdue and active' })}
        viewAllHref="/inspection"
      />
      <CardContent>
        {items.length === 0 ? (
          <EmptyRow
            message={t('topLists.inspections.empty', { defaultValue: 'All inspections on track' })}
          />
        ) : (
          <ul className="space-y-1.5">
            {items.map((insp) => {
              const diffDays = Math.round(
                (Date.now() - new Date(insp.scheduledDate).getTime()) / 86_400_000,
              );
              return (
                <li key={insp.id}>
                  <Link
                    to={`/inspection/${insp.id}`}
                    className="block rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs transition hover:border-primary/30 hover:bg-accent/20"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn(
                          'border shrink-0 text-[10px]',
                          inspectionStatusClass[insp.status] ??
                            'border-border bg-muted/40 text-muted-foreground',
                        )}
                      >
                        {insp.status === 'overdue'
                          ? t('inspectionCard.statusOverdue')
                          : t('inspectionCard.statusInProgress')}
                      </Badge>
                      <span className="truncate font-medium">{insp.craneName}</span>
                      {insp.status === 'overdue' && (
                        <span className="ml-auto shrink-0 text-[10px] font-semibold text-red-500 tabular-nums">
                          D+{diffDays}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-1 truncate">
                      {insp.siteName} · {insp.assignedTo}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TopParts({ items }: { items: InventoryItem[] }) {
  const { t } = useTranslation('philly-dashboard');
  return (
    <Card className="h-full">
      <ListHeader
        icon={Warehouse}
        iconColor="text-orange-500"
        iconBg="border border-orange-500/25 bg-orange-500/10"
        title={t('topLists.parts.title', { defaultValue: 'Critical Parts' })}
        subtitle={t('topLists.parts.subtitle', { defaultValue: 'Below safety stock' })}
        viewAllHref="/inventory"
      />
      <CardContent>
        {items.length === 0 ? (
          <EmptyRow
            message={t('topLists.parts.empty', { defaultValue: 'All stock levels healthy' })}
          />
        ) : (
          <ul className="space-y-1.5">
            {items.map((part) => {
              const stockPct =
                part.minStockQty > 0
                  ? Math.round((part.availableQty / part.minStockQty) * 100)
                  : 100;
              return (
                <li key={part.id}>
                  <Link
                    to="/inventory"
                    className="block rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs transition hover:border-primary/30 hover:bg-accent/20"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn(
                          'border shrink-0 text-[10px]',
                          inventoryStatusClass[part.status] ??
                            'border-border bg-muted/40 text-muted-foreground',
                        )}
                      >
                        {t(`status.inventory.${part.status}`, { defaultValue: part.status })}
                      </Badge>
                      <span className="truncate font-medium">
                        {part.partName.split('—')[0].trim()}
                      </span>
                      <span
                        className={cn(
                          'ml-auto shrink-0 text-[10px] font-semibold tabular-nums',
                          stockPct === 0 ? 'text-red-500' : 'text-amber-500',
                        )}
                      >
                        {stockPct}%
                      </span>
                    </div>
                    <div className="bg-muted/40 mt-1.5 h-1 overflow-hidden rounded-full">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          stockPct === 0 ? 'bg-red-500' : 'bg-amber-500',
                        )}
                        style={{ width: `${Math.min(stockPct, 100)}%` }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
