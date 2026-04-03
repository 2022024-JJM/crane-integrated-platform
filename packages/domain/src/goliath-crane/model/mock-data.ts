import type {
  GoliathCraneDetail,
  GoliathSensorTimeSeries,
  GoliathSafetyParameter,
  GoliathOperationLogEntry,
  TimeRange,
} from './types';

const GC_04: GoliathCraneDetail = {
  id: 'gc-04',
  name: 'Goliath Crane 04호기',
  craneNo: 'GC-04',
  regionId: '__all__',
  status: 'operating',
  load: 85,
  maxLoad: 100,
  auxLoad: 12,
  auxMaxLoad: 25,
  windSpeed: 8.3,
  windSpeedThreshold: 20,
  boomAngle: 12.5,
  hoistHeight: 25.3,
  auxHoistHeight: 18.7,
  slewAngle: 142,
  trolleyPosition: 35.2,
  girderLength: 80,
  railPositionLeft: 12.5,
  railPositionRight: 12.5,
  railSpan: 120,
  operatingHoursToday: 6.2,
  cycleCountToday: 142,
  antiCollisionActive: true,
  overloadProtectionActive: true,
  loadWarningThreshold: 80,
  lastUpdated: new Date().toISOString(),
  hoistMotorTemp: 62,
  hoistMotorCurrent: 180,
  trolleyMotorTemp: 55,
  trolleyMotorCurrent: 120,
  travelMotorTemp: 48,
  travelMotorCurrent: 95,
  wireRopeUsageCount: 12400,
  wireRopeMaxCount: 20000,
  brakeStatus: 'normal',
};

function randomFluctuation(base: number, range: number): number {
  return Math.round((base + (Math.random() - 0.5) * range) * 10) / 10;
}

export function getGoliathCrane(): GoliathCraneDetail {
  return { ...GC_04 };
}

export function applyLiveFluctuation(
  crane: GoliathCraneDetail,
): GoliathCraneDetail {
  return {
    ...crane,
    load: Math.max(
      0,
      Math.min(crane.maxLoad, randomFluctuation(crane.load, 4)),
    ),
    auxLoad: Math.max(
      0,
      Math.min(crane.auxMaxLoad, randomFluctuation(crane.auxLoad, 2)),
    ),
    windSpeed: Math.max(0, randomFluctuation(crane.windSpeed, 1.5)),
    hoistHeight: Math.max(0, randomFluctuation(crane.hoistHeight, 0.8)),
    auxHoistHeight: Math.max(0, randomFluctuation(crane.auxHoistHeight, 0.5)),
    trolleyPosition: Math.max(
      0,
      Math.min(
        crane.girderLength,
        randomFluctuation(crane.trolleyPosition, 1.2),
      ),
    ),
    slewAngle: (crane.slewAngle + randomFluctuation(0, 2) + 360) % 360,
    hoistMotorTemp: Math.max(
      20,
      Math.min(120, randomFluctuation(crane.hoistMotorTemp, 3)),
    ),
    hoistMotorCurrent: Math.max(
      0,
      randomFluctuation(crane.hoistMotorCurrent, 10),
    ),
    trolleyMotorTemp: Math.max(
      20,
      Math.min(120, randomFluctuation(crane.trolleyMotorTemp, 2)),
    ),
    trolleyMotorCurrent: Math.max(
      0,
      randomFluctuation(crane.trolleyMotorCurrent, 8),
    ),
    travelMotorTemp: Math.max(
      20,
      Math.min(120, randomFluctuation(crane.travelMotorTemp, 2)),
    ),
    travelMotorCurrent: Math.max(
      0,
      randomFluctuation(crane.travelMotorCurrent, 6),
    ),
    lastUpdated: new Date().toISOString(),
  };
}

const TIME_RANGE_POINTS: Record<
  TimeRange,
  { count: number; intervalMs: number }
> = {
  '1h': { count: 60, intervalMs: 60_000 },
  '6h': { count: 72, intervalMs: 5 * 60_000 },
  '12h': { count: 144, intervalMs: 5 * 60_000 },
  '24h': { count: 192, intervalMs: 7.5 * 60_000 },
};

export function generateSensorHistory(
  crane: GoliathCraneDetail,
  range: TimeRange,
): GoliathSensorTimeSeries[] {
  const { count, intervalMs } = TIME_RANGE_POINTS[range];
  const now = Date.now();
  const points: GoliathSensorTimeSeries[] = [];

  for (let i = 0; i < count; i++) {
    const t = now - (count - 1 - i) * intervalMs;
    points.push({
      timestamp: new Date(t).toISOString(),
      load: Math.max(0, randomFluctuation(crane.load, 15)),
      windSpeed: Math.max(0, randomFluctuation(crane.windSpeed, 4)),
      hoistHeight: Math.max(0, randomFluctuation(crane.hoistHeight, 5)),
    });
  }

  return points;
}

export function getGoliathSafetyParameters(
  crane: GoliathCraneDetail,
): GoliathSafetyParameter[] {
  const loadPercent = (crane.load / crane.maxLoad) * 100;
  const windPercent = (crane.windSpeed / crane.windSpeedThreshold) * 100;
  const auxLoadPercent = (crane.auxLoad / crane.auxMaxLoad) * 100;

  function getStatus(percent: number): 'normal' | 'warning' | 'critical' {
    if (percent >= 90) return 'critical';
    if (percent >= 70) return 'warning';
    return 'normal';
  }

  return [
    {
      id: 'main-load',
      nameKey: 'goliath-crane:safety.mainLoad',
      currentValue: crane.load,
      threshold: crane.maxLoad,
      unit: 'ton',
      status: getStatus(loadPercent),
    },
    {
      id: 'aux-load',
      nameKey: 'goliath-crane:safety.auxLoad',
      currentValue: crane.auxLoad,
      threshold: crane.auxMaxLoad,
      unit: 'ton',
      status: getStatus(auxLoadPercent),
    },
    {
      id: 'wind-speed',
      nameKey: 'goliath-crane:safety.windSpeed',
      currentValue: crane.windSpeed,
      threshold: crane.windSpeedThreshold,
      unit: 'm/s',
      status: getStatus(windPercent),
    },
    {
      id: 'hoist-height',
      nameKey: 'goliath-crane:safety.hoistHeight',
      currentValue: crane.hoistHeight,
      threshold: 50,
      unit: 'm',
      status: getStatus((crane.hoistHeight / 50) * 100),
    },
  ];
}

export function getGoliathOperationLog(): GoliathOperationLogEntry[] {
  const now = Date.now();
  return [
    {
      id: 'log-1',
      timestamp: new Date(now - 120_000).toISOString(),
      actionKey: 'goliath-crane:log.hoistUp',
      operator: 'Kim',
      details: '25.3m',
    },
    {
      id: 'log-2',
      timestamp: new Date(now - 300_000).toISOString(),
      actionKey: 'goliath-crane:log.trolleyMove',
      operator: 'Kim',
      details: '35.2m',
    },
    {
      id: 'log-3',
      timestamp: new Date(now - 480_000).toISOString(),
      actionKey: 'goliath-crane:log.loadPickup',
      operator: 'Park',
      details: '85t',
    },
    {
      id: 'log-4',
      timestamp: new Date(now - 720_000).toISOString(),
      actionKey: 'goliath-crane:log.slewRotate',
      operator: 'Park',
      details: '142°',
    },
    {
      id: 'log-5',
      timestamp: new Date(now - 960_000).toISOString(),
      actionKey: 'goliath-crane:log.hoistDown',
      operator: 'Kim',
      details: '18.7m',
    },
    {
      id: 'log-6',
      timestamp: new Date(now - 1_200_000).toISOString(),
      actionKey: 'goliath-crane:log.loadRelease',
      operator: 'Park',
      details: '0t',
    },
    {
      id: 'log-7',
      timestamp: new Date(now - 1_500_000).toISOString(),
      actionKey: 'goliath-crane:log.emergencyStopTest',
      operator: 'Lee',
    },
    {
      id: 'log-8',
      timestamp: new Date(now - 1_800_000).toISOString(),
      actionKey: 'goliath-crane:log.systemCheck',
      operator: 'Lee',
    },
  ];
}
