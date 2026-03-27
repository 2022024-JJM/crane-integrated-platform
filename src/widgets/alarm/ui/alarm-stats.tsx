import { AlertCircle, Info, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAlarmSeverityLabel, type AlarmStatistics } from '@/entities/alarm';

interface AlarmStatsProps {
  stats: AlarmStatistics
}

export function AlarmStats({ stats }: AlarmStatsProps) {
  const { i18n } = useTranslation();

  return (
    <div className="grid grid-cols-4 gap-2 p-3">
      <div className="flex flex-col items-center gap-1 rounded-lg bg-destructive/10 p-2">
        <ShieldAlert className="size-4 text-destructive" />
        <span className="text-lg font-bold text-destructive">{stats.critical}</span>
        <span className="text-[10px] text-muted-foreground">
          {getAlarmSeverityLabel('critical', i18n.language)}
        </span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-lg bg-orange-500/10 p-2">
        <AlertCircle className="size-4 text-orange-500" />
        <span className="text-lg font-bold text-orange-500">{stats.high}</span>
        <span className="text-[10px] text-muted-foreground">
          {getAlarmSeverityLabel('high', i18n.language)}
        </span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-lg bg-amber-500/10 p-2">
        <AlertCircle className="size-4 text-amber-500" />
        <span className="text-lg font-bold text-amber-500">{stats.medium}</span>
        <span className="text-[10px] text-muted-foreground">
          {getAlarmSeverityLabel('medium', i18n.language)}
        </span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-lg bg-blue-500/10 p-2">
        <Info className="size-4 text-blue-500" />
        <span className="text-lg font-bold text-blue-500">{stats.info}</span>
        <span className="text-[10px] text-muted-foreground">
          {getAlarmSeverityLabel('info', i18n.language)}
        </span>
      </div>
    </div>
  );
}
