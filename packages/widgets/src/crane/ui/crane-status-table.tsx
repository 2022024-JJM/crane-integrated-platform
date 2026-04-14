import { useMemo } from 'react';
import { Badge } from '@crane/ui/atoms/badge';
import { useMonitoringLiveTable } from '@crane/features/monitoring';
import { cn } from '@crane/core/lib/utils';
import { useTranslation } from 'react-i18next';
import type {
  MonitoringLiveCell,
  MonitoringLiveCrane,
  MonitoringLiveTableDisplayColumn,
} from '@crane/domain/monitoring';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crane/ui/molecules/table';
import {
  CRANE_INFO_COLUMN_WIDTH,
  DETAIL_HEADER_HEIGHT,
  GROUP_HEADER_HEIGHT,
  formatCellValue,
  formatTimestamp,
  getAlignmentClassName,
  getColumnWidth,
  getConnectionClassName,
  getConnectionLabel,
  getStatusDotClassName,
  getStatusDotTone,
} from './crane-status-table-helpers';

interface CraneStatusTableProps {
  cranes: MonitoringLiveCrane[];
  tagDefinitionIds?: number[];
  regionId: string;
}

interface ColumnGroup {
  key: string;
  labelKey: string;
  defaultLabel: string;
  columns: MonitoringLiveTableDisplayColumn[];
}

function StatusState({
  title,
  description,
  tone = 'muted',
}: {
  title: string;
  description?: string | null;
  tone?: 'muted' | 'error';
}) {
  return (
    <div className="border-border/60 bg-muted/30 m-4 rounded-xl border p-5">
      <p
        className={cn(
          'text-sm font-medium',
          tone === 'error' ? 'text-destructive' : 'text-foreground',
        )}
      >
        {title}
      </p>
      {description ? (
        <p className="text-muted-foreground mt-1 text-xs leading-5">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function StatusDotCell({
  value,
  timestamp,
  statusBehavior,
}: {
  value: MonitoringLiveCell['value'] | undefined;
  timestamp?: string | null;
  statusBehavior: MonitoringLiveTableDisplayColumn['statusBehavior'];
}) {
  const tone = getStatusDotTone(value, statusBehavior);

  return (
    <div
      className="flex items-center justify-center"
      title={
        timestamp
          ? `${formatCellValue(value)} | ${formatTimestamp(timestamp)}`
          : formatCellValue(value)
      }
    >
      <span
        className={cn(
          'border-background/80 inline-flex size-2.5 rounded-full border',
          getStatusDotClassName(tone),
        )}
      />
    </div>
  );
}

function buildColumnGroups(columns: MonitoringLiveTableDisplayColumn[]) {
  return columns.reduce<ColumnGroup[]>((groups, column) => {
    const lastGroup = groups[groups.length - 1];

    if (lastGroup?.key === column.groupKey) {
      lastGroup.columns.push(column);
      return groups;
    }

    groups.push({
      key: column.groupKey,
      labelKey: column.groupLabelKey,
      defaultLabel: column.groupDefaultLabel,
      columns: [column],
    });

    return groups;
  }, []);
}

export function CraneStatusTable({
  cranes,
  tagDefinitionIds,
  regionId,
}: CraneStatusTableProps) {
  const { t } = useTranslation();
  const {
    columns,
    rows,
    realtimeBadgeState,
    isMetaLoading,
    isError,
    errorMessage,
    isEmpty,
  } = useMonitoringLiveTable({
    cranes,
    tagDefinitionIds,
    regionId,
  });

  const columnGroups = useMemo(() => buildColumnGroups(columns), [columns]);
  const latestUpdatedAt = useMemo(
    () =>
      rows.reduce<string | null>((latest, row) => {
        if (!row.lastUpdated) {
          return latest;
        }

        if (!latest || latest.localeCompare(row.lastUpdated) < 0) {
          return row.lastUpdated;
        }

        return latest;
      }, null),
    [rows],
  );

  const connectionLabels = {
    connected: t('common:craneStatus.connection.open'),
    connecting: t('common:craneStatus.connection.connecting'),
    closed: t('common:craneStatus.connection.closed'),
  } as const;

  return (
    <div className="bg-background flex h-full min-h-0 flex-col">
      <div className="border-b px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">
              {t('common:craneStatus.title')}
            </h3>
          </div>
          <div className="ml-auto flex items-center justify-end gap-2">
            <span className="text-muted-foreground text-[10px] tabular-nums">
              {t('common:craneStatus.table.updatedAt')}
              {' | '}
              {formatTimestamp(latestUpdatedAt)}
            </span>
            <Badge
              variant="outline"
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                getConnectionClassName(realtimeBadgeState),
              )}
            >
              {getConnectionLabel(realtimeBadgeState, connectionLabels)}
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="flex-1 overflow-auto">
          {isMetaLoading ? (
            <StatusState
              title={t('common:craneStatus.loadingTitle')}
              description={t('common:craneStatus.loadingDescription')}
            />
          ) : isError ? (
            <StatusState
              title={t('common:craneStatus.errorTitle')}
              description={errorMessage}
              tone="error"
            />
          ) : isEmpty ? (
            <StatusState
              title={t('common:craneStatus.emptyTitle')}
              description={t('common:craneStatus.emptyDescription')}
            />
          ) : (
            <div className="relative min-w-max">
              <table className="w-full border-separate border-spacing-0 text-xs">
                <TableHeader>
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead
                      rowSpan={2}
                      className="border-border bg-muted text-foreground sticky left-0 z-40 border-r border-b px-2 py-1.5 text-center text-[10px] font-semibold tracking-[0.08em] whitespace-nowrap uppercase"
                      style={{
                        top: 0,
                        minWidth: CRANE_INFO_COLUMN_WIDTH,
                      }}
                    >
                      {t('common:craneStatus.columns.crane')}
                    </TableHead>
                    {columnGroups.map((group) => (
                      <TableHead
                        key={group.key}
                        colSpan={group.columns.length}
                        className="border-border bg-muted text-foreground sticky z-30 border-r px-1.5 py-1 text-center text-[9px] font-semibold tracking-[0.08em] whitespace-nowrap uppercase last:border-r-0"
                        style={{
                          top: 0,
                          height: GROUP_HEADER_HEIGHT,
                        }}
                      >
                        {t(group.labelKey, group.defaultLabel)}
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="[&>th]:border-border hover:bg-transparent [&>th]:border-b">
                    {columns.map((column) => (
                      <TableHead
                        key={column.tagDefinitionId}
                        className={cn(
                          'border-border bg-background text-foreground sticky z-20 border-r px-1 py-1 text-[9px] font-medium whitespace-nowrap last:border-r-0',
                          getAlignmentClassName(column.align),
                        )}
                        style={{
                          top: GROUP_HEADER_HEIGHT,
                          minWidth: getColumnWidth(column),
                          height: DETAIL_HEADER_HEIGHT,
                        }}
                        title={column.description ?? undefined}
                      >
                        <div className="flex min-w-0 flex-col gap-px">
                          <span className="truncate leading-none">
                            {column.headerLabelKey
                              ? t(
                                  column.headerLabelKey,
                                  column.shortLabel ?? column.displayName,
                                )
                              : (column.shortLabel ?? column.displayName)}
                          </span>
                          <span className="text-muted-foreground truncate font-mono text-[8px] leading-none">
                            {column.cellKind === 'statusDot'
                              ? t('common:craneStatus.table.statusLabel')
                              : (column.unit ?? '-')}
                          </span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.craneId}
                      className="hover:bg-muted/30 [&>td]:border-border/60 border-0 [&>td]:border-b last:[&>td]:border-b-0"
                    >
                      <TableCell
                        className="border-border bg-background sticky left-0 z-20 border-r px-2 py-1.5 text-center"
                        style={{
                          minWidth: CRANE_INFO_COLUMN_WIDTH,
                        }}
                      >
                        <div className="flex min-w-0 items-center justify-center">
                          <span className="text-[11px] font-semibold tracking-wide text-[#f5a623]">
                            {row.craneNo}
                          </span>
                        </div>
                      </TableCell>
                      {columns.map((column) => {
                        const cell = row.values[column.tagCode];

                        return (
                          <TableCell
                            key={`${row.craneId}:${column.tagCode}`}
                            className={cn(
                              'border-border border-r px-1 py-1.5 align-middle last:border-r-0',
                              getAlignmentClassName(column.align),
                            )}
                            style={{
                              minWidth: getColumnWidth(column),
                            }}
                          >
                            {column.cellKind === 'statusDot' ? (
                              <StatusDotCell
                                value={cell?.value}
                                timestamp={cell?.timestamp}
                                statusBehavior={column.statusBehavior}
                              />
                            ) : (
                              <div
                                className={cn(
                                  'flex min-w-0 flex-col',
                                  column.align === 'center'
                                    ? 'items-center'
                                    : column.align === 'right'
                                      ? 'items-end'
                                      : 'items-start',
                                )}
                                title={
                                  cell?.timestamp
                                    ? `${formatCellValue(cell.value)} | ${formatTimestamp(cell.timestamp)}`
                                    : undefined
                                }
                              >
                                <span
                                  className={cn(
                                    'font-mono text-[10px] font-medium tabular-nums',
                                    cell
                                      ? 'text-foreground'
                                      : 'text-muted-foreground',
                                  )}
                                >
                                  {formatCellValue(cell?.value)}
                                </span>
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
