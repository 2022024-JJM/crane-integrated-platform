import type {
  AlarmRow,
  MonitoringStatCard,
} from '@/entities/monitoring/alarm/model/types';

export const ALARM_OVERVIEW_TEXT = {
  alarmTitle: '알람 내역',
  statsTitle: '알람 통계',
} as const;

export const MONITORING_STAT_CARDS = [
  { label: '# Alarms', value: '2', tone: 'danger' },
  { label: 'Elapsed Time', value: '3 min', tone: 'neutral' },
  { label: '# Occurrence', value: '1', tone: 'ok' },
  { label: 'Abnormal', value: '2', tone: 'danger' },
  { label: 'Danger', value: '1', tone: 'danger' },
  { label: 'Normal', value: '0', tone: 'ok' },
] satisfies readonly MonitoringStatCard[];

export const ALARM_ROWS = [
  ['88', 'Normal', '2019-01-23 14:55', 'BL-01', '1'],
  ['87', 'Warning', '2019-01-23 14:48', 'BL-03', '2'],
  ['86', 'Warning', '2019-01-23 14:40', 'OHC-11', '3'],
  ['85', 'Critical', '2019-01-23 14:31', 'OHC-07', '1'],
  ['84', 'Normal', '2019-01-23 14:22', 'BL-05', '2'],
  ['83', 'Warning', '2019-01-23 14:15', 'OHC-02', '1'],
] satisfies readonly AlarmRow[];
