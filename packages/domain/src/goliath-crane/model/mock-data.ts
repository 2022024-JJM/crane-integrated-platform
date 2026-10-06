import type { GoliathCraneDetail } from './types';

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
    lastUpdated: new Date().toISOString(),
  };
}
