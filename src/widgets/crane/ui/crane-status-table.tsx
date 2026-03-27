import { Badge } from '@/shared/ui/atoms/badge';
import { useTranslation } from 'react-i18next';
import type { MonitoringReplayRow } from '@/entities/monitoring';
import { ScrollArea } from '@/shared/ui/molecules/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/molecules/table';

interface CraneStatusTableProps {
  rows: MonitoringReplayRow[];
  latestFrameTimestamp: string | null;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string | null;
  isEmpty?: boolean;
}

const booleanBadgeClassName = {
  true: 'bg-red-500/15 text-red-600 dark:text-red-400',
  false: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
} as const;

function formatValue(value: MonitoringReplayRow['value']) {
  if (value === null || value === undefined) {
    return '-';
  }

  return String(value);
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function BooleanBadge({ value }: { value: boolean }) {
  return (
    <Badge className={booleanBadgeClassName[String(value) as 'true' | 'false']}>
      {value ? 'Yes' : 'No'}
    </Badge>
  );
}

export function CraneStatusTable({
  rows,
  latestFrameTimestamp,
  isLoading = false,
  isError = false,
  errorMessage = null,
  isEmpty = false,
}: CraneStatusTableProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h3 className="text-sm font-medium">{t('common:craneStatus.title')}</h3>
        <span className="text-xs text-muted-foreground">
          Latest: {formatTimestamp(latestFrameTimestamp)}
        </span>
      </div>
      <ScrollArea className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">
            Loading monitoring replay...
          </div>
        ) : isError ? (
          <div className="p-4 text-sm text-destructive">
            Failed to load monitoring replay.
            {errorMessage ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {errorMessage}
              </p>
            ) : null}
          </div>
        ) : isEmpty ? (
          <div className="p-4 text-sm text-muted-foreground">
            No replay data found for the current region.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Crane</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Alarm</TableHead>
                <TableHead>Stale</TableHead>
                <TableHead>Changed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.craneNo}</TableCell>
                  <TableCell className="font-mono text-xs">{row.tagCode}</TableCell>
                  <TableCell>{row.displayName}</TableCell>
                  <TableCell>{formatValue(row.value)}</TableCell>
                  <TableCell>{row.unit ?? '-'}</TableCell>
                  <TableCell>{row.category}</TableCell>
                  <TableCell>
                    <BooleanBadge value={row.alarm} />
                  </TableCell>
                  <TableCell>
                    <BooleanBadge value={row.stale} />
                  </TableCell>
                  <TableCell>
                    <BooleanBadge value={row.changed} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ScrollArea>
    </div>
  );
}
