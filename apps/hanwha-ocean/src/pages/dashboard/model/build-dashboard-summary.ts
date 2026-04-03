import { getAlarmsByRegion, type Alarm } from '@crane/domain/alarm';
import { getCranesByRegion, type CraneOperationalData } from '@crane/domain/crane';
import {
  getRegionSubtitleKey,
  getRegionTitleKey,
  regions,
  type Region,
} from '@crane/domain/region';
import type {
  DashboardMetricCard,
  DashboardRegionStatusDatum,
  DashboardRiskCraneDatum,
  DashboardSummary,
  DashboardTrendPoint,
  DashboardUrgentRegion,
} from './types';

const MONTHLY_RATE_OFFSETS = [5.4, 7.1, -1.8, 4.6, 1.9, 0];
const MONTHLY_ALARM_OFFSETS = [2, 1, 5, -1, 3, 4];
const WEEKLY_ALARM_OFFSETS = [1, 3, 2, 4, 6, 2, 1];
const WEEKLY_WARNING_OFFSETS = [0, 1, 1, 2, 3, 1, 0];

interface RegionSnapshot {
  region: Region;
  cranes: CraneOperationalData[];
  alarms: Alarm[];
}

export function buildDashboardSummary(): DashboardSummary {
  const snapshots = regions.map((region) => ({
    region,
    cranes: getCranesByRegion(region.id),
    alarms: getAlarmsByRegion(region.id),
  }));

  const allCranes = snapshots.flatMap((snapshot) => snapshot.cranes);
  const allAlarms = snapshots
    .flatMap((snapshot) => snapshot.alarms)
    .sort(compareAlarmDesc);
  const snapshotDate = getSnapshotDate(allCranes, allAlarms);
  const operatingCount = allCranes.filter(
    (crane) => crane.status === 'operating',
  ).length;
  const idleCount = allCranes.filter((crane) => crane.status === 'idle').length;
  const operatingRate = allCranes.length
    ? roundToOne(((operatingCount + idleCount) / allCranes.length) * 100)
    : 0;
  const urgentRegion = getUrgentRegion(snapshots);
  const monthlyTrend = buildMonthlyTrend({
    operatingRate,
    alarms: allAlarms,
    snapshotDate,
  });
  const weeklyTrend = buildWeeklyTrend({
    alarms: allAlarms,
    snapshotDate,
  });
  const regionStatuses = buildRegionStatuses(snapshots);
  const riskCranes = buildRiskCranes(allCranes);

  return {
    metrics: buildMetricCards({
      operatingRate,
      connectedCraneCount: allCranes.length,
      regionCount: regions.length,
      urgentRegion,
    }),
    monthlyTrend,
    weeklyTrend,
    regionStatuses,
    riskCranes,
    recentAlarms: allAlarms.slice(0, 4),
    urgentRegion,
    monthlyAlarmTotal: monthlyTrend.reduce(
      (sum, point) => sum + (point.alarmCount ?? 0),
      0,
    ),
    topAlarmMonth: getPeakDateKey(monthlyTrend, 'alarmCount'),
    averageOperatingRate: roundToOne(
      monthlyTrend.reduce(
        (sum, point) => sum + (point.operationalRate ?? 0),
        0,
      ) / Math.max(monthlyTrend.length, 1),
    ),
    bestOperatingMonth: getPeakDateKey(monthlyTrend, 'operationalRate'),
    weeklyAlarmTotal: weeklyTrend.reduce(
      (sum, point) => sum + (point.alarmCount ?? 0),
      0,
    ),
    weeklyWarningTotal: weeklyTrend.reduce(
      (sum, point) => sum + (point.warningCount ?? 0),
      0,
    ),
    averageWeeklyAlarms: roundToOne(
      weeklyTrend.reduce((sum, point) => sum + (point.alarmCount ?? 0), 0) /
        Math.max(weeklyTrend.length, 1),
    ),
    peakWeeklyDay: getPeakDateKey(weeklyTrend, 'alarmCount'),
  };
}

function buildMetricCards({
  operatingRate,
  connectedCraneCount,
  regionCount,
  urgentRegion,
}: {
  operatingRate: number;
  connectedCraneCount: number;
  regionCount: number;
  urgentRegion: DashboardUrgentRegion | null;
}): DashboardMetricCard[] {
  return [
    {
      id: 'regionCount',
      titleKey: 'dashboard:metrics.regionCount.title',
      descriptionKey: 'dashboard:metrics.regionCount.description',
      value: regionCount,
      format: 'number',
      tone: 'default',
    },
    {
      id: 'craneCount',
      titleKey: 'dashboard:metrics.craneCount.title',
      descriptionKey: 'dashboard:metrics.craneCount.description',
      value: connectedCraneCount,
      format: 'number',
      tone: 'default',
    },
    {
      id: 'operatingRate',
      titleKey: 'dashboard:metrics.operatingRate.title',
      descriptionKey: 'dashboard:metrics.operatingRate.description',
      value: operatingRate,
      format: 'percent',
      tone: 'success',
    },
    {
      id: 'urgentRegion',
      titleKey: 'dashboard:metrics.urgentRegion.title',
      descriptionKey: 'dashboard:metrics.urgentRegion.description',
      value:
        urgentRegion?.titleKey ?? 'dashboard:metrics.urgentRegion.emptyValue',
      format: urgentRegion ? 'translation' : 'translation',
      tone: 'warning',
      href: urgentRegion?.navigateTo,
      metaKey: urgentRegion
        ? 'dashboard:metrics.urgentRegion.meta'
        : 'dashboard:metrics.urgentRegion.emptyMeta',
      metaValues: urgentRegion
        ? {
            critical: urgentRegion.critical,
            total: urgentRegion.total,
          }
        : undefined,
    },
  ];
}

function getUrgentRegion(
  snapshots: RegionSnapshot[],
): DashboardUrgentRegion | null {
  const ranked = snapshots
    .map(({ region, alarms }) => {
      const critical = alarms.filter(
        (alarm) => alarm.severity === 'critical',
      ).length;
      const warning = alarms.filter(
        (alarm) => alarm.severity === 'high' || alarm.severity === 'medium',
      ).length;
      const info = alarms.filter((alarm) => alarm.severity === 'info').length;

      return {
        regionId: region.id,
        titleKey: getRegionTitleKey(region.id),
        subtitleKey: getRegionSubtitleKey(region.id),
        navigateTo: region.navigateTo,
        critical,
        warning,
        info,
        total: alarms.length,
        latestTimestamp: alarms[0]?.timestamp ?? null,
      };
    })
    .sort((left, right) => {
      const severityDiff =
        right.critical - left.critical ||
        right.warning - left.warning ||
        right.info - left.info;

      if (severityDiff !== 0) {
        return severityDiff;
      }

      const countDiff = right.total - left.total;
      if (countDiff !== 0) {
        return countDiff;
      }

      return (
        new Date(right.latestTimestamp ?? 0).getTime() -
        new Date(left.latestTimestamp ?? 0).getTime()
      );
    });

  const topRegion = ranked[0];

  if (!topRegion || topRegion.total === 0) {
    return null;
  }

  return topRegion;
}

function buildMonthlyTrend({
  operatingRate,
  alarms,
  snapshotDate,
}: {
  operatingRate: number;
  alarms: Alarm[];
  snapshotDate: Date;
}): DashboardTrendPoint[] {
  const criticalCount = alarms.filter(
    (alarm) => alarm.severity === 'critical',
  ).length;
  const warningCount = alarms.filter(
    (alarm) => alarm.severity === 'high' || alarm.severity === 'medium',
  ).length;
  const infoCount = alarms.filter((alarm) => alarm.severity === 'info').length;
  const alarmPressure =
    criticalCount * 2.8 + warningCount * 1.5 + infoCount * 0.8;
  const startMonth = addMonths(startOfMonth(snapshotDate), -5);

  return Array.from({ length: 6 }, (_, index) => {
    const date = addMonths(startMonth, index);
    const rate = clamp(
      roundToOne(
        operatingRate +
          MONTHLY_RATE_OFFSETS[index] -
          alarmPressure * 0.42 +
          index * 0.4,
      ),
      42,
      95,
    );
    const alarmCount = Math.max(
      1,
      Math.round(
        alarms.length * 1.35 +
          criticalCount * 1.8 +
          warningCount +
          MONTHLY_ALARM_OFFSETS[index],
      ),
    );

    return {
      dateKey: toDateKey(date),
      operationalRate: rate,
      alarmCount,
    };
  });
}

function buildWeeklyTrend({
  alarms,
  snapshotDate,
}: {
  alarms: Alarm[];
  snapshotDate: Date;
}): DashboardTrendPoint[] {
  const severeCount = alarms.filter(
    (alarm) => alarm.severity !== 'info',
  ).length;
  const criticalCount = alarms.filter(
    (alarm) => alarm.severity === 'critical',
  ).length;
  const startDay = addDays(startOfDay(snapshotDate), -6);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startDay, index);
    const alarmCount = Math.max(
      0,
      Math.round(alarms.length / 3) +
        WEEKLY_ALARM_OFFSETS[index] +
        criticalCount,
    );
    const warningCount = Math.min(
      alarmCount,
      Math.max(
        0,
        Math.round(severeCount / 3) + WEEKLY_WARNING_OFFSETS[index] - 1,
      ),
    );

    return {
      dateKey: toDateKey(date),
      alarmCount,
      warningCount,
    };
  });
}

function buildRegionStatuses(
  snapshots: RegionSnapshot[],
): DashboardRegionStatusDatum[] {
  return snapshots.map(({ region, cranes }) => {
    const operating = cranes.filter(
      (crane) => crane.status === 'operating',
    ).length;
    const warning = cranes.filter((crane) => crane.status === 'warning').length;
    const offline = cranes.filter(
      (crane) =>
        crane.status === 'idle' ||
        crane.status === 'stopped' ||
        crane.status === 'maintenance',
    ).length;

    return {
      regionId: region.id,
      navigateTo: region.navigateTo,
      titleKey: getRegionTitleKey(region.id),
      operating,
      warning,
      offline,
      total: cranes.length,
    };
  });
}

function buildRiskCranes(
  cranes: CraneOperationalData[],
): DashboardRiskCraneDatum[] {
  return [...cranes]
    .map((crane) => {
      const loadRatio = crane.maxLoad
        ? roundToOne((crane.load / crane.maxLoad) * 100)
        : 0;
      const windRatio = clamp((crane.windSpeed / 15) * 100, 0, 100);
      const statusWeight = getStatusWeight(crane.status);

      return {
        craneId: crane.id,
        craneName: crane.name,
        regionId: crane.regionId,
        regionTitleKey: getRegionTitleKey(crane.regionId),
        status: crane.status,
        loadRatio,
        windSpeed: crane.windSpeed,
        score: Math.round(statusWeight + loadRatio * 0.34 + windRatio * 0.42),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function getStatusWeight(status: CraneOperationalData['status']) {
  switch (status) {
    case 'stopped':
      return 52;
    case 'warning':
      return 38;
    case 'maintenance':
      return 28;
    case 'idle':
      return 14;
    case 'operating':
    default:
      return 6;
  }
}

function getSnapshotDate(cranes: CraneOperationalData[], alarms: Alarm[]) {
  const timestamps = [
    ...cranes.map((crane) => new Date(crane.lastUpdated).getTime()),
    ...alarms.map((alarm) => new Date(alarm.timestamp).getTime()),
  ];
  const latestTimestamp = timestamps.length
    ? Math.max(...timestamps)
    : Date.now();

  return new Date(latestTimestamp);
}

function getPeakDateKey(
  points: DashboardTrendPoint[],
  metric: 'operationalRate' | 'alarmCount',
) {
  if (points.length === 0) {
    return null;
  }

  return (
    [...points].sort(
      (left, right) => (right[metric] ?? 0) - (left[metric] ?? 0),
    )[0]?.dateKey ?? null
  );
}

function compareAlarmDesc(left: Alarm, right: Alarm) {
  return (
    new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
  );
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonths(date: Date, value: number) {
  return new Date(date.getFullYear(), date.getMonth() + value, 1);
}

function addDays(date: Date, value: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + value);
}

function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    `${date.getMonth() + 1}`.padStart(2, '0'),
    `${date.getDate()}`.padStart(2, '0'),
  ].join('-');
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
