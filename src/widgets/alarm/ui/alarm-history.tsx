import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getAlarmMessageTranslation,
  type Alarm,
  type AlarmSeverity,
} from '@/entities/alarm';
import { getFormatLocale } from '@/shared/config/i18n';
import { ScrollArea } from '@/shared/ui/molecules/scroll-area';

interface AlarmHistoryProps {
  alarms: Alarm[];
}

const severityIcon: Record<
  AlarmSeverity,
  { icon: typeof AlertTriangle; className: string }
> = {
  critical: { icon: AlertTriangle, className: 'text-destructive' },
  warning: { icon: AlertCircle, className: 'text-amber-500' },
  info: { icon: Info, className: 'text-blue-500' },
};

function formatTime(timestamp: string, language: string) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(getFormatLocale(language), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AlarmHistory({ alarms }: AlarmHistoryProps) {
  const { t, i18n } = useTranslation();

  return (
    <ScrollArea className="flex-1 overflow-auto">
      <div className="flex flex-col gap-1 p-3">
        {alarms.map((alarm) => {
          const sv = severityIcon[alarm.severity];
          const Icon = sv.icon;
          const message = getAlarmMessageTranslation(alarm);
          return (
            <div
              key={alarm.id}
              className="flex items-start gap-2 rounded-md border p-2 text-xs"
            >
              <Icon className={`mt-0.5 size-3.5 shrink-0 ${sv.className}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium">{alarm.craneName}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatTime(alarm.timestamp, i18n.language)}
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground">
                  {t(message.key, message.values)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
