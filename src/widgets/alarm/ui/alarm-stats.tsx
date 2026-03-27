import { AlertCircle, Info, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getAlarmSeverityLabel,
  getAlarmSeverityVisual,
  type AlarmStatistics,
} from '@/entities/alarm';

interface AlarmStatsProps {
  stats: AlarmStatistics
}

export function AlarmStats({ stats }: AlarmStatsProps) {
  const { i18n } = useTranslation();
  const criticalVisual = getAlarmSeverityVisual('critical');
  const highVisual = getAlarmSeverityVisual('high');
  const mediumVisual = getAlarmSeverityVisual('medium');
  const infoVisual = getAlarmSeverityVisual('info');

  return (
    <div className="grid grid-cols-4 gap-2 p-3">
      <div
        className={`flex flex-col items-center gap-1 rounded-lg p-2 ${criticalVisual.surfaceClassName}`}
      >
        <ShieldAlert className={`size-4 ${criticalVisual.iconClassName}`} />
        <span className={`text-lg font-bold ${criticalVisual.valueClassName}`}>
          {stats.critical}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {getAlarmSeverityLabel('critical', i18n.language)}
        </span>
      </div>
      <div
        className={`flex flex-col items-center gap-1 rounded-lg p-2 ${highVisual.surfaceClassName}`}
      >
        <AlertCircle className={`size-4 ${highVisual.iconClassName}`} />
        <span className={`text-lg font-bold ${highVisual.valueClassName}`}>
          {stats.high}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {getAlarmSeverityLabel('high', i18n.language)}
        </span>
      </div>
      <div
        className={`flex flex-col items-center gap-1 rounded-lg p-2 ${mediumVisual.surfaceClassName}`}
      >
        <AlertCircle className={`size-4 ${mediumVisual.iconClassName}`} />
        <span className={`text-lg font-bold ${mediumVisual.valueClassName}`}>
          {stats.medium}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {getAlarmSeverityLabel('medium', i18n.language)}
        </span>
      </div>
      <div
        className={`flex flex-col items-center gap-1 rounded-lg p-2 ${infoVisual.surfaceClassName}`}
      >
        <Info className={`size-4 ${infoVisual.iconClassName}`} />
        <span className={`text-lg font-bold ${infoVisual.valueClassName}`}>
          {stats.info}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {getAlarmSeverityLabel('info', i18n.language)}
        </span>
      </div>
    </div>
  );
}
