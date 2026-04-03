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
  getAlarmSeverityVisual,
  type Alarm,
  type AlarmSeverity,
} from '@crane/domain/alarm';
import { getFormatLocale } from '@crane/core/config/i18n';
import { cn } from '@crane/core/lib/utils';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';

interface AlarmHistoryProps {
  alarms: Alarm[];
}

const severityIcon: Record<
  AlarmSeverity,
  { icon: typeof AlertTriangle; className: string }
> = {
  critical: {
    icon: ShieldAlert,
    className: getAlarmSeverityVisual('critical').iconClassName,
  },
  high: {
    icon: AlertCircle,
    className: getAlarmSeverityVisual('high').iconClassName,
  },
  medium: {
    icon: AlertTriangle,
    className: getAlarmSeverityVisual('medium').iconClassName,
  },
  info: {
    icon: Info,
    className: getAlarmSeverityVisual('info').iconClassName,
  },
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
          const severityVisual = alarm.active
            ? getAlarmSeverityVisual(alarm.severity)
            : null;

          return (
            <div
              key={alarm.id}
              className={cn(
                'flex items-start gap-2 rounded-md border p-2 text-xs',
                alarm.active
                  ? severityVisual?.surfaceClassName
                  : 'border-emerald-500/20 bg-emerald-500/6',
              )}
            >
              <Icon className={`mt-0.5 size-3.5 shrink-0 ${visual.className}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{alarm.craneName}</span>
                    <span
                      className={cn(
                        'text-[11px]',
                        alarm.active
                          ? severityVisual?.emphasisClassName
                          : 'text-emerald-600 dark:text-emerald-400',
                      )}
                    >
                      {getAlarmSeverityLabel(alarm.severity, i18n.language)}
                    </span>
                  </div>
                  <span className="shrink-0 text-muted-foreground">
                    {formatTime(alarm.timestamp, i18n.language)}
                  </span>
                </div>
                <p
                  className={cn(
                    'mt-0.5',
                    alarm.active
                      ? 'text-foreground/85'
                      : 'text-emerald-600 dark:text-emerald-400',
                  )}
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
