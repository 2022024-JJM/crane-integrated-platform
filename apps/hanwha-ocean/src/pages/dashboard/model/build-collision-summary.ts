import type { Region } from '@crane/domain/region';
import { getRegionTitleKey } from '@crane/domain/region';
import {
  bucketAlarmsByDay,
  bucketCollisionsByDay,
  countToday,
  type AlarmJournalEntry,
  type CollisionJournalEntry,
} from '@crane/domain/journal';
import type {
  DashboardActiveAlarmStats,
  DashboardCollisionRow,
  DashboardDataSourceStatus,
  DashboardDetectionStatus,
  DashboardMetricCard,
  DashboardSummary,
} from './types';

/**
 * 충돌방지 관제 대시보드 집계 — 전부 실 데이터에서만 파생한다.
 * 입력: journal(localStorage 영속 이력), 충돌 감지·러너 상태, 실시간 활성
 * 알람 통계, 씬 장비 수. 합성 오프셋·mock 파생 수치는 두지 않는다 — 기록이
 * 없으면 0 과 빈 목록을 그대로 돌려주고 UI 가 정직한 empty state 를 그린다.
 */

export const TREND_DAYS = 7;
const RECENT_COLLISIONS_MAX = 6;
const RECENT_ALARMS_MAX = 4;

export interface BuildCollisionSummaryInput {
  regions: Region[];
  collisionEntries: readonly CollisionJournalEntry[];
  alarmEntries: readonly AlarmJournalEntry[];
  detection: DashboardDetectionStatus;
  sources: DashboardDataSourceStatus;
  activeAlarmStats: DashboardActiveAlarmStats;
  equipmentCountByRegion: Record<string, number | null>;
  now: number;
}

export function buildCollisionSummary(
  input: BuildCollisionSummaryInput,
): DashboardSummary {
  const regionById = new Map(input.regions.map((region) => [region.id, region]));

  // 사이트 파티션: journal 은 전역이므로 이 사이트의 region 것만 남긴다.
  // regionId 스탬프가 없는 충돌(에디터 씬 등)은 어느 사이트에서든 보인다 —
  // 숨기면 기록이 어디에서도 안 보이게 된다.
  const collisions = input.collisionEntries.filter(
    (entry) => entry.regionId === null || regionById.has(entry.regionId),
  );
  const alarms = input.alarmEntries.filter((entry) =>
    regionById.has(entry.regionId),
  );

  const collisionTrend = bucketCollisionsByDay(
    collisions,
    TREND_DAYS,
    input.now,
  );
  const alarmTrend = bucketAlarmsByDay(alarms, TREND_DAYS, input.now);
  const todayCollisionCount = countToday(
    collisions,
    (entry) => entry.at,
    input.now,
  );
  const weekCollisionTotal = collisionTrend.reduce(
    (sum, point) => sum + point.count,
    0,
  );
  const weekAlarmTotal = alarmTrend.reduce(
    (sum, point) => sum + point.total,
    0,
  );
  const weekCriticalTotal = alarmTrend.reduce(
    (sum, point) => sum + point.critical,
    0,
  );

  return {
    metrics: buildMetricCards({
      detection: input.detection,
      sources: input.sources,
      activeAlarmStats: input.activeAlarmStats,
      todayCollisionCount,
      weekCollisionTotal,
    }),
    collisionTrend,
    alarmTrend,
    todayCollisionCount,
    weekCollisionTotal,
    weekAlarmTotal,
    weekCriticalTotal,
    regionStatuses: input.regions.map((region) => ({
      regionId: region.id,
      navigateTo: region.navigateTo,
      titleKey: getRegionTitleKey(region.id),
      equipmentCount: input.equipmentCountByRegion[region.id] ?? null,
    })),
    recentCollisions: collisions
      .slice(0, RECENT_COLLISIONS_MAX)
      .map((entry) => toCollisionRow(entry, regionById)),
    recentAlarms: alarms.slice(0, RECENT_ALARMS_MAX),
  };
}

function toCollisionRow(
  entry: CollisionJournalEntry,
  regionById: Map<string, Region>,
): DashboardCollisionRow {
  const region = entry.regionId ? regionById.get(entry.regionId) : undefined;
  return {
    key: entry.key,
    at: entry.at,
    equipA: entry.a.equipName,
    equipB: entry.b.equipName,
    regionTitleKey: region ? getRegionTitleKey(region.id) : null,
    navigateTo: region?.navigateTo ?? null,
  };
}

function buildMetricCards({
  detection,
  sources,
  activeAlarmStats,
  todayCollisionCount,
  weekCollisionTotal,
}: {
  detection: DashboardDetectionStatus;
  sources: DashboardDataSourceStatus;
  activeAlarmStats: DashboardActiveAlarmStats;
  todayCollisionCount: number;
  weekCollisionTotal: number;
}): DashboardMetricCard[] {
  return [
    buildDetectionCard(detection),
    {
      id: 'todayCollisions',
      titleKey: 'dashboard:metrics.todayCollisions.title',
      descriptionKey: 'dashboard:metrics.todayCollisions.description',
      value: todayCollisionCount,
      format: 'number',
      tone: todayCollisionCount > 0 ? 'warning' : 'success',
      metaKey: 'dashboard:metrics.todayCollisions.meta',
      metaValues: { count: weekCollisionTotal },
    },
    {
      id: 'activeAlarms',
      titleKey: 'dashboard:metrics.activeAlarms.title',
      descriptionKey: 'dashboard:metrics.activeAlarms.description',
      value: activeAlarmStats.total,
      format: 'number',
      tone:
        activeAlarmStats.critical > 0
          ? 'danger'
          : activeAlarmStats.total > 0
            ? 'warning'
            : 'success',
      metaKey: 'dashboard:metrics.activeAlarms.meta',
      metaValues: {
        critical: activeAlarmStats.critical,
        high: activeAlarmStats.high,
      },
    },
    buildDataSourceCard(sources),
  ];
}

function buildDetectionCard(
  detection: DashboardDetectionStatus,
): DashboardMetricCard {
  const stateKey = detection.enabled
    ? `dashboard:collision.state.${detection.phase}`
    : 'dashboard:collision.state.off';
  const tone: DashboardMetricCard['tone'] = !detection.enabled
    ? 'default'
    : detection.phase === 'scanning'
      ? 'success'
      : detection.phase === 'halted'
        ? 'danger'
        : detection.phase === 'baseline'
          ? 'warning'
          : 'default';
  return {
    id: 'detection',
    titleKey: 'dashboard:metrics.detection.title',
    descriptionKey: 'dashboard:metrics.detection.description',
    value: stateKey,
    format: 'translation',
    tone,
    metaKey: detection.pauseOnCollision
      ? 'dashboard:collision.pauseOn'
      : 'dashboard:collision.pauseOff',
  };
}

function buildDataSourceCard(
  sources: DashboardDataSourceStatus,
): DashboardMetricCard {
  const state = sources.realtimeHeld
    ? 'held'
    : sources.realtimeRunning
      ? 'realtime'
      : sources.simulationRunning
        ? 'simulation'
        : 'stopped';
  return {
    id: 'dataSource',
    titleKey: 'dashboard:metrics.dataSource.title',
    descriptionKey: 'dashboard:metrics.dataSource.description',
    value: `dashboard:source.state.${state}`,
    format: 'translation',
    tone:
      state === 'stopped' ? 'default' : state === 'held' ? 'warning' : 'success',
    metaKey: `dashboard:source.meta.${state}`,
  };
}
