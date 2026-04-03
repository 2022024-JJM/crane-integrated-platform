import { ClipboardList, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GoliathOperationLogEntry } from '@crane/domain/goliath-crane';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@crane/ui/molecules/card';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function LogEntry({ entry }: { entry: GoliathOperationLogEntry }) {
  const { t } = useTranslation('goliath-crane');

  return (
    <div className="border-border/50 flex items-start gap-3 border-b py-3 last:border-b-0">
      <div className="text-muted-foreground mt-0.5 shrink-0 text-xs tabular-nums">
        {formatTime(entry.timestamp)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{t(entry.actionKey)}</p>
        {entry.details && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {entry.details}
          </p>
        )}
      </div>
      <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
        <User className="size-3" />
        {entry.operator}
      </div>
    </div>
  );
}

export function OperationLogPanel({
  log,
}: {
  log: GoliathOperationLogEntry[];
}) {
  const { t } = useTranslation('goliath-crane');

  return (
    <Card className="border-border/90 bg-card/60 border shadow-sm backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="text-muted-foreground size-4" />
          <CardTitle>{t('operationLog.title')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-3">
          {log.map((entry) => (
            <LogEntry key={entry.id} entry={entry} />
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
