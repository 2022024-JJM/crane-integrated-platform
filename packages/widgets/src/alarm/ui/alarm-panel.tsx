import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Separator } from '@crane/ui/atoms/separator';
import type {
  Alarm,
  AlarmSeverity,
  AlarmStatistics,
} from '@crane/domain/alarm';
import { getAlarmSeverityLabel } from '@crane/domain/alarm';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import { AlarmStats } from './alarm-stats';
import { AlarmHistory } from './alarm-history';

interface AlarmPanelProps {
  stats: AlarmStatistics;
  alarms: Alarm[];
}

type SeverityFilter = AlarmSeverity | 'all';

const SEVERITY_VALUES: SeverityFilter[] = [
  'all',
  'critical',
  'high',
  'medium',
  'info',
];

export function AlarmPanel({ stats, alarms }: AlarmPanelProps) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<SeverityFilter>('all');

  function getSeverityLabel(value: SeverityFilter) {
    if (value === 'all') return t('common:alarms.filterAll');
    return getAlarmSeverityLabel(value, i18n.language);
  }

  const filteredAlarms =
    filter === 'all' ? alarms : alarms.filter((a) => a.severity === filter);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-2">
        <h3 className="text-sm font-medium">{t('common:alarms.title')}</h3>
      </div>
      <AlarmStats stats={stats} />
      <Separator />
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <h4 className="text-muted-foreground text-xs font-medium">
          {t('common:alarms.history')}
        </h4>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-[11px]">
            {t('common:alarms.alarmStatus')}
          </span>
          <Select
            value={filter}
            onValueChange={(v: string) => setFilter(v as SeverityFilter)}
          >
            <SelectTrigger label={getSeverityLabel(filter)} />
            <SelectPopup>
              {SEVERITY_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {getSeverityLabel(value)}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      </div>
      <AlarmHistory alarms={filteredAlarms} />
    </div>
  );
}
