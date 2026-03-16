import type {
  AlarmRow,
  MonitoringStatCard,
} from '@/entities/monitoring/alarm/model/types';

export const ALARM_OVERVIEW_TEXT = {
  alarmTitle: '알람 내역',
  statsTitle: '알람 통계',
} as const;

export const INDOOR_MONITORING_STAT_CARDS = [
  { label: '# Alarms', value: '2', tone: 'danger' },
  { label: 'Elapsed Time', value: '3 min', tone: 'neutral' },
  { label: '# Occurrence', value: '1', tone: 'ok' },
  { label: 'Abnormal', value: '2', tone: 'danger' },
  { label: 'Danger', value: '1', tone: 'danger' },
  { label: 'Normal', value: '0', tone: 'ok' },
] satisfies readonly MonitoringStatCard[];

export const OUTDOOR_MONITORING_STAT_CARDS = [
  { label: '# Alarms', value: '4', tone: 'danger' },
  { label: 'Elapsed Time', value: '4 min', tone: 'neutral' },
  { label: '# Occurrence', value: '1', tone: 'ok' },
  { label: 'Abnormal', value: '4', tone: 'danger' },
  { label: 'Danger', value: '0', tone: 'danger' },
  { label: 'Normal', value: '0', tone: 'ok' },
] satisfies readonly MonitoringStatCard[];

export const INDOOR_ALARM_ROWS = [
  ['88', 'Normal', '2019-01-23 14:55', 'BL-01', '1'],
  ['87', 'Warning', '2019-01-23 14:48', 'BL-03', '2'],
  ['86', 'Warning', '2019-01-23 14:40', 'OHC-11', '3'],
  ['85', 'Critical', '2019-01-23 14:31', 'OHC-07', '1'],
  ['84', 'Normal', '2019-01-23 14:22', 'BL-05', '2'],
  ['83', 'Warning', '2019-01-23 14:15', 'OHC-02', '1'],
] satisfies readonly AlarmRow[];

export const OUTDOOR_ALARM_ROWS = [
  ['132', 'Warning', '2019-01-23 15:16', 'TC-m', '4'],
  ['131', 'Critical', '2019-01-23 15:10', 'GC-4', '2'],
  ['130', 'Critical', '2019-01-23 15:10', 'TTC-26', '1'],
  ['129', 'Critical', '2019-01-23 15:11', 'TTC-12', '3'],
  ['128', 'Critical', '2019-01-23 15:06', 'TC-57', '2'],
  ['127', 'Critical', '2019-01-23 15:03', 'OC-05', '1'],
] satisfies readonly AlarmRow[];
