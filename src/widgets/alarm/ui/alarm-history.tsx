import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  formatAlarmHistoryMessage,
  getAlarmSeverityLabel,
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
  critical: { icon: ShieldAlert, className: 'text-destructive' },
  high: { icon: AlertCircle, className: 'text-orange-500' },
  medium: { icon: AlertTriangle, className: 'text-amber-500' },
  info: { icon: Info, className: 'text-blue-500' },
};

const clearedAlarmVisual = {
  icon: CheckCircle2,
  className: 'text-emerald-500',
};

function formatTime(timestamp: string, language: string) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(getFormatLocale(language), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AlarmHistory({ alarms }: AlarmHistoryProps) {
  const { i18n } = useTranslation();

  return (
    <ScrollArea className="flex-1 overflow-auto">
      <div className="flex flex-col gap-1 p-3">
        {alarms.map((alarm) => {
          const visual = alarm.active
            ? severityIcon[alarm.severity]
            : clearedAlarmVisual;
          const Icon = visual.icon;

          return (
            <div
              key={alarm.id}
              className="flex items-start gap-2 rounded-md border p-2 text-xs"
            >
              <Icon className={`mt-0.5 size-3.5 shrink-0 ${visual.className}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{alarm.craneName}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {getAlarmSeverityLabel(alarm.severity, i18n.language)}
                    </span>
                  </div>
                  <span className="shrink-0 text-muted-foreground">
                    {formatTime(alarm.timestamp, i18n.language)}
                  </span>
                </div>
                <p
                  className={`mt-0.5 ${
                    alarm.active
                      ? 'text-muted-foreground'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {formatAlarmHistoryMessage(alarm, i18n.language)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
