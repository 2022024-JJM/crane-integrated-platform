import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Badge } from '@crane/ui/atoms/badge';
import { Button } from '@crane/ui/atoms/button';
import { tableRowStatusBadgeClassName } from '@crane/core/lib/status-colors';
import { useTranslation } from 'react-i18next';
import type { MonitoringReplayRow } from '@crane/domain/monitoring';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { cn } from '@crane/core/lib/utils';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crane/ui/molecules/table';
import {
  CRANE_COLUMN_WIDTH,
  TAG_NAME_COLUMN_WIDTH,
  type SortKey,
  type SortDirection,
  formatValue,
  formatTimestamp,
  formatDataType,
  compareRows,
  getCategoryClassName,
  buildRowStatuses,
  buildHeartbeatStatuses,
} from './crane-status-table-helpers';

interface CraneStatusTableProps {
  rows: MonitoringReplayRow[];
  searchFrom: string;
  searchTo: string;
  viewingFrom: string;
  viewingTo: string;
  isSearchDisabled?: boolean;
  validationReason?: 'missing' | 'invalid' | 'order' | 'tooLarge' | null;
  onSearchFromChange: (value: string) => void;
  onSearchToChange: (value: string) => void;
  onSearch: () => void;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string | null;
  isEmpty?: boolean;
}

function HeartbeatStatusBar({ rows }: { rows: MonitoringReplayRow[] }) {
  const statuses = buildHeartbeatStatuses(rows);

  if (statuses.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
      {statuses.map((s) => (
        <div
          key={s.craneId}
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
            s.stale
              ? 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              s.stale ? 'bg-red-500' : 'bg-emerald-500',
            )}
          />
          <span>{s.craneNo}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: keyof typeof tableRowStatusBadgeClassName;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-6 rounded-full px-2.5 text-[11px] font-medium',
        tableRowStatusBadgeClassName[tone],
      )}
    >
      {label}
    </Badge>
  );
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

function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-muted-foreground flex min-w-[220px] flex-col gap-1 text-xs">
      <span>{label}</span>
      <input
        type="datetime-local"
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-border bg-background text-foreground focus-visible:border-ring h-8 w-full rounded-md border px-2 text-sm ring-0 transition outline-none"
      />
    </label>
  );
}

function SortButton({
  label,
  isActive,
  direction,
  onClick,
  align = 'left',
}: {
  label: string;
  isActive: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: 'left' | 'right';
}) {
  const Icon = !isActive
    ? ArrowUpDown
    : direction === 'asc'
      ? ArrowUp
      : ArrowDown;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-xs font-semibold transition',
        align === 'right' ? 'justify-end' : 'justify-start',
      )}
    >
      <span>{label}</span>
      <Icon className="size-3.5" />
    </button>
  );
}

export function CraneStatusTable({
  rows,
  searchFrom,
  searchTo,
  isSearchDisabled = false,
  validationReason = null,
  onSearchFromChange,
  onSearchToChange,
  onSearch,
  isLoading = false,
  isError = false,
  errorMessage = null,
  isEmpty = false,
}: CraneStatusTableProps) {
  const { t, i18n } = useTranslation();
  const [sortKey, setSortKey] = useState<SortKey>('crane');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const startTimeLabel = t('common:craneStatus.search.startTime', {
    defaultValue: 'Start Time',
  });
  const endTimeLabel = t('common:craneStatus.search.endTime', {
    defaultValue: 'End Time',
  });
  const searchLabel = t('common:craneStatus.search.submit', {
    defaultValue: 'Search',
  });
  const validationMessage =
    validationReason === 'order'
      ? t('common:craneStatus.search.validation.order', {
          defaultValue: 'Start time must be earlier than end time.',
        })
      : validationReason === 'tooLarge'
        ? t('common:craneStatus.search.validation.tooLarge', {
            defaultValue: 'Search range must be within 24 hours.',
          })
        : validationReason === 'invalid'
          ? t('common:craneStatus.search.validation.invalid', {
              defaultValue: 'Please enter a valid time range.',
            })
          : validationReason === 'missing'
            ? t('common:craneStatus.search.validation.missing', {
                defaultValue: 'Start time and end time are required.',
              })
            : null;

  const sortedRows = useMemo(() => {
    const nextRows = [...rows];

    nextRows.sort((left, right) => {
      const compared = compareRows(left, right, sortKey);
      return sortDirection === 'asc' ? compared : -compared;
    });

    return nextRows;
  }, [rows, sortDirection, sortKey]);

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextKey);
    setSortDirection('asc');
  };

  return (
    <div className="bg-background flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">
              {t('common:craneStatus.title')}
            </h3>
          </div>
          <form
            className="flex flex-col items-stretch gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onSearch();
            }}
          >
            <div className="flex flex-wrap items-end gap-2">
              <DateTimeField
                label={startTimeLabel}
                value={searchFrom}
                onChange={onSearchFromChange}
              />
              <DateTimeField
                label={endTimeLabel}
                value={searchTo}
                onChange={onSearchToChange}
              />
              <Button type="submit" size="default" disabled={isSearchDisabled}>
                {searchLabel}
              </Button>
            </div>
            {validationMessage ? (
              <p className="text-destructive text-xs">{validationMessage}</p>
            ) : null}
          </form>
        </div>
      </div>
      <HeartbeatStatusBar rows={rows} />
      <div className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="flex-1 overflow-auto">
          {isLoading ? (
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
            <div className="relative min-w-[1120px]">
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                    <TableHead
                      className="bg-muted text-muted-foreground sticky top-0 left-0 z-30 w-[120px] border-r px-3 py-3 text-xs font-semibold whitespace-nowrap shadow-[1px_0_0_0_hsl(var(--border))]"
                      style={{ minWidth: CRANE_COLUMN_WIDTH }}
                    >
                      <SortButton
                        label={t('common:craneStatus.columns.crane')}
                        isActive={sortKey === 'crane'}
                        direction={sortDirection}
                        onClick={() => toggleSort('crane')}
                      />
                    </TableHead>
                    <TableHead
                      className="bg-muted text-muted-foreground sticky top-0 z-30 w-[320px] border-r px-3 py-3 text-xs font-semibold whitespace-nowrap shadow-[1px_0_0_0_hsl(var(--border))]"
                      style={{
                        left: CRANE_COLUMN_WIDTH,
                        minWidth: TAG_NAME_COLUMN_WIDTH,
                      }}
                    >
                      <SortButton
                        label={t('common:craneStatus.columns.tagName')}
                        isActive={sortKey === 'tagName'}
                        direction={sortDirection}
                        onClick={() => toggleSort('tagName')}
                      />
                    </TableHead>
                    <TableHead className="bg-muted text-muted-foreground sticky top-0 z-10 w-[140px] border-r px-3 py-3 text-right text-xs font-semibold">
                      <SortButton
                        label={t('common:craneStatus.columns.value')}
                        isActive={sortKey === 'value'}
                        direction={sortDirection}
                        onClick={() => toggleSort('value')}
                        align="right"
                      />
                    </TableHead>
                    <TableHead className="bg-muted text-muted-foreground sticky top-0 z-10 w-[90px] border-r px-3 py-3 text-xs font-semibold">
                      <SortButton
                        label={t('common:craneStatus.columns.unit')}
                        isActive={sortKey === 'unit'}
                        direction={sortDirection}
                        onClick={() => toggleSort('unit')}
                      />
                    </TableHead>
                    <TableHead className="bg-muted text-muted-foreground sticky top-0 z-10 w-[120px] border-r px-3 py-3 text-xs font-semibold">
                      <SortButton
                        label={t('common:craneStatus.columns.category')}
                        isActive={sortKey === 'category'}
                        direction={sortDirection}
                        onClick={() => toggleSort('category')}
                      />
                    </TableHead>
                    <TableHead className="bg-muted text-muted-foreground sticky top-0 z-10 w-[110px] border-r px-3 py-3 text-xs font-semibold">
                      <SortButton
                        label={t('common:craneStatus.columns.dataType')}
                        isActive={sortKey === 'dataType'}
                        direction={sortDirection}
                        onClick={() => toggleSort('dataType')}
                      />
                    </TableHead>
                    <TableHead className="bg-muted text-muted-foreground sticky top-0 z-10 w-[130px] border-r px-3 py-3 text-xs font-semibold">
                      <SortButton
                        label={t('common:craneStatus.columns.snapshotAt')}
                        isActive={sortKey === 'snapshotAt'}
                        direction={sortDirection}
                        onClick={() => toggleSort('snapshotAt')}
                      />
                    </TableHead>
                    <TableHead className="bg-muted text-muted-foreground sticky top-0 z-10 min-w-[180px] px-3 py-3 text-xs font-semibold">
                      {t('common:craneStatus.columns.status')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:nth-child(even)]:bg-muted/10">
                  {sortedRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-border/60 hover:bg-muted/20 border-b"
                    >
                      <TableCell
                        className="bg-background sticky left-0 z-20 border-r px-3 py-3 shadow-[1px_0_0_0_hsl(var(--border))]"
                        style={{ minWidth: CRANE_COLUMN_WIDTH }}
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="text-foreground font-medium">
                            {row.craneNo}
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            {row.craneId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell
                        className="bg-background sticky z-20 border-r px-3 py-3 shadow-[1px_0_0_0_hsl(var(--border))]"
                        style={{
                          left: CRANE_COLUMN_WIDTH,
                          minWidth: TAG_NAME_COLUMN_WIDTH,
                        }}
                      >
                        <div className="min-w-0">
                          <p className="text-foreground truncate text-sm font-medium">
                            {row.displayName}
                          </p>
                          <p className="text-muted-foreground mt-0.5 truncate font-mono text-[11px]">
                            {row.tagCode}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="border-r px-3 py-3 text-right">
                        {formatValue(row.value) === null ? (
                          <span className="text-muted-foreground/80 text-sm">
                            -
                          </span>
                        ) : (
                          <span className="text-foreground font-mono text-sm font-medium">
                            {formatValue(row.value)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground border-r px-3 py-3 text-sm">
                        {row.unit ?? '-'}
                      </TableCell>
                      <TableCell className="border-r px-3 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            'h-5 rounded-md px-2 text-[11px] font-medium capitalize',
                            getCategoryClassName(row.category),
                          )}
                        >
                          {row.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="border-r px-3 py-3">
                        <span className="text-muted-foreground font-mono text-xs">
                          {formatDataType(row.dataType)}
                        </span>
                      </TableCell>
                      <TableCell className="border-r px-3 py-3">
                        <span className="text-muted-foreground text-xs">
                          {formatTimestamp(row.snapshotAt, i18n.language)}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {buildRowStatuses(row).map((status) => (
                            <StatusBadge
                              key={`${row.id}:${status.label}`}
                              label={t(
                                `common:craneStatus.statusBadges.${status.label.toLowerCase()}`,
                              )}
                              tone={status.tone}
                            />
                          ))}
                        </div>
                      </TableCell>
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
