import type { Alarm } from '@crane/domain/alarm';
import type { CraneStatus } from '@crane/domain/crane';
import type { Region } from '@crane/domain/region';

export interface DashboardMetricCard {
  id: 'regionCount' | 'craneCount' | 'operatingRate' | 'urgentRegion';
  titleKey: string;
  descriptionKey: string;
  value: number | string;
  format: 'number' | 'percent' | 'translation' | 'text';
  tone: 'default' | 'success' | 'warning';
  href?: string;
  metaKey?: string;
  metaValues?: Record<string, string | number>;
}

export interface DashboardTrendPoint {
  dateKey: string;
  operationalRate?: number;
  alarmCount?: number;
  warningCount?: number;
}

export interface DashboardRegionStatusDatum {
  regionId: Region['id'];
  navigateTo: Region['navigateTo'];
  titleKey: string;
  operating: number;
  warning: number;
  offline: number;
  total: number;
}

export interface DashboardRiskCraneDatum {
  craneId: string;
  craneName: string;
  regionId: Region['id'];
  regionTitleKey: string;
  status: CraneStatus;
  loadRatio: number;
  windSpeed: number;
  score: number;
}

export interface DashboardUrgentRegion {
  regionId: Region['id'];
  titleKey: string;
  subtitleKey: string;
  navigateTo: Region['navigateTo'];
  critical: number;
  warning: number;
  info: number;
  total: number;
  latestTimestamp: string | null;
}

export interface DashboardSummary {
  metrics: DashboardMetricCard[];
  monthlyTrend: DashboardTrendPoint[];
  weeklyTrend: DashboardTrendPoint[];
  regionStatuses: DashboardRegionStatusDatum[];
  riskCranes: DashboardRiskCraneDatum[];
  recentAlarms: Alarm[];
  urgentRegion: DashboardUrgentRegion | null;
  monthlyAlarmTotal: number;
  topAlarmMonth: string | null;
  averageOperatingRate: number;
  bestOperatingMonth: string | null;
  weeklyAlarmTotal: number;
  weeklyWarningTotal: number;
  averageWeeklyAlarms: number;
  peakWeeklyDay: string | null;
}
