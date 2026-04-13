import { Badge } from '@crane/ui/atoms/badge';
import { useMonitoringLiveTable } from '@crane/features/monitoring';
import { cn } from '@crane/core/lib/utils';
import { useTranslation } from 'react-i18next';
import type { MonitoringLiveCrane } from '@crane/domain/monitoring';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crane/ui/molecules/table';
import {
  CRANE_ID_COLUMN_WIDTH,
  CRANE_INFO_COLUMN_WIDTH,
  TAG_COLUMN_WIDTH,
  UPDATED_AT_COLUMN_WIDTH,
  formatCellValue,
  formatTimestamp,
  getConnectionClassName,
  getConnectionLabel,
} from './crane-status-table-helpers';

interface CraneStatusTableProps {
  cranes: MonitoringLiveCrane[];
  tagDefinitionIds: number[];
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

export function CraneStatusTable({
  cranes,
  tagDefinitionIds,
}: CraneStatusTableProps) {
  const { t } = useTranslation();
  const {
    columns,
    rows,
    connectionState,
    isMetaLoading,
    isError,
    errorMessage,
    isEmpty,
  } = useMonitoringLiveTable({
    cranes,
    tagDefinitionIds,
  });

  const connectionLabels = {
    idle: t('common:craneStatus.connection.idle', {
      defaultValue: 'Idle',
    }),
    connecting: t('common:craneStatus.connection.connecting', {
      defaultValue: 'Connecting',
    }),
    open: t('common:craneStatus.connection.open', {
      defaultValue: 'Live',
    }),
    closing: t('common:craneStatus.connection.closing', {
      defaultValue: 'Closing',
    }),
    closed: t('common:craneStatus.connection.closed', {
      defaultValue: 'Disconnected',
    }),
  } as const;

  return (
    <div className="bg-background flex h-full min-h-0 flex-col">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">
              {t('common:craneStatus.title', {
                defaultValue: 'Real-time Crane Status',
              })}
            </h3>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('common:craneStatus.liveDescription', {
                defaultValue:
                  'Columns are built from selected tag metadata and values are updated from WebSocket events.',
              })}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium',
              getConnectionClassName(connectionState),
            )}
          >
            {getConnectionLabel(connectionState, connectionLabels)}
          </Badge>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="flex-1 overflow-auto">
          {isMetaLoading ? (
            <StatusState
              title={t('common:craneStatus.loadingTitle', {
                defaultValue: 'Loading crane status metadata...',
              })}
              description={t('common:craneStatus.loadingDescription', {
                defaultValue:
                  'Tag definitions are being prepared for the live table.',
              })}
            />
          ) : isError ? (
            <StatusState
              title={t('common:craneStatus.errorTitle', {
                defaultValue: 'Failed to load crane status metadata.',
              })}
              description={errorMessage}
              tone="error"
            />
          ) : isEmpty ? (
            <StatusState
              title={t('common:craneStatus.emptyTitle', {
                defaultValue: 'No crane or tag configuration is available.',
              })}
              description={t('common:craneStatus.emptyDescription', {
                defaultValue:
                  'Set cranes and tagDefinitionIds on the page to render the live table.',
              })}
            />
          ) : (
            <div className="relative min-w-max">
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                    <TableHead
                      className="bg-muted text-muted-foreground sticky top-0 left-0 z-30 border-r px-3 py-3 text-xs font-semibold whitespace-nowrap shadow-[1px_0_0_0_hsl(var(--border))]"
                      style={{ minWidth: CRANE_INFO_COLUMN_WIDTH }}
                    >
                      {t('common:craneStatus.columns.crane', {
                        defaultValue: 'Crane',
                      })}
                    </TableHead>
                    <TableHead
                      className="bg-muted text-muted-foreground sticky top-0 z-30 border-r px-3 py-3 text-xs font-semibold whitespace-nowrap shadow-[1px_0_0_0_hsl(var(--border))]"
                      style={{
                        left: CRANE_INFO_COLUMN_WIDTH,
                        minWidth: CRANE_ID_COLUMN_WIDTH,
                      }}
                    >
                      {t('common:craneStatus.columns.craneId', {
                        defaultValue: 'Crane ID',
                      })}
                    </TableHead>
                    <TableHead
                      className="bg-muted text-muted-foreground sticky top-0 z-20 border-r px-3 py-3 text-xs font-semibold whitespace-nowrap"
                      style={{
                        left: CRANE_INFO_COLUMN_WIDTH + CRANE_ID_COLUMN_WIDTH,
                        minWidth: UPDATED_AT_COLUMN_WIDTH,
                      }}
                    >
                      {t('common:craneStatus.columns.updatedAt', {
                        defaultValue: 'Updated',
                      })}
                    </TableHead>
                    {columns.map((column) => (
                      <TableHead
                        key={column.tagDefinitionId}
                        className="bg-muted text-muted-foreground sticky top-0 z-10 border-r px-3 py-3 text-xs font-semibold whitespace-nowrap last:border-r-0"
                        style={{ minWidth: TAG_COLUMN_WIDTH }}
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{column.displayName}</span>
                          <span className="text-muted-foreground/80 mt-0.5 truncate font-mono text-[10px] font-normal">
                            {column.unit
                              ? `${column.unit} / ${column.dataType ?? '-'}`
                              : (column.dataType ?? '-')}
                          </span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:nth-child(even)]:bg-muted/10">
                  {rows.map((row) => (
                    <TableRow
                      key={row.craneId}
                      className="border-border/60 hover:bg-muted/20 border-b"
                    >
                      <TableCell
                        className="bg-background sticky left-0 z-20 border-r px-3 py-3 shadow-[1px_0_0_0_hsl(var(--border))]"
                        style={{ minWidth: CRANE_INFO_COLUMN_WIDTH }}
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="text-foreground font-medium">
                            {row.craneNo}
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            {row.craneName ?? '-'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell
                        className="bg-background sticky z-20 border-r px-3 py-3 font-mono text-xs shadow-[1px_0_0_0_hsl(var(--border))]"
                        style={{
                          left: CRANE_INFO_COLUMN_WIDTH,
                          minWidth: CRANE_ID_COLUMN_WIDTH,
                        }}
                      >
                        {row.craneId}
                      </TableCell>
                      <TableCell
                        className="bg-background sticky z-10 border-r px-3 py-3 text-xs shadow-[1px_0_0_0_hsl(var(--border))]"
                        style={{
                          left: CRANE_INFO_COLUMN_WIDTH + CRANE_ID_COLUMN_WIDTH,
                          minWidth: UPDATED_AT_COLUMN_WIDTH,
                        }}
                      >
                        <span className="text-muted-foreground">
                          {formatTimestamp(row.lastUpdated)}
                        </span>
                      </TableCell>
                      {columns.map((column) => {
                        const cell = row.values[column.tagCode];

                        return (
                          <TableCell
                            key={`${row.craneId}:${column.tagCode}`}
                            className={cn(
                              'border-r px-3 py-3 align-top last:border-r-0',
                              cell?.changed && 'bg-emerald-500/5',
                            )}
                          >
                            <div className="flex min-w-[120px] flex-col">
                              <span
                                className={cn(
                                  'font-mono text-sm font-medium',
                                  cell
                                    ? 'text-foreground'
                                    : 'text-muted-foreground/80',
                                )}
                              >
                                {formatCellValue(cell?.value)}
                              </span>
                              <span className="text-muted-foreground mt-1 text-[10px]">
                                {cell ? formatTimestamp(cell.timestamp) : '-'}
                              </span>
                            </div>
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
