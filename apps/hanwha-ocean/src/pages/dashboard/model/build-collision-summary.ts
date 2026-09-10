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
  DashboardOverallStatus,
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
/** 이 시간 안의 최신 충돌은 상단 경보 배너로 승격한다. */
export const ATTENTION_WINDOW_MS = 10 * 60 * 1000;

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

  const monitoringHref = input.regions[0]?.navigateTo ?? null;
  const latestCollision = collisions[0];
  const attentionCollision =
    latestCollision && input.now - latestCollision.at <= ATTENTION_WINDOW_MS
      ? toCollisionRow(latestCollision, regionById)
      : null;

  return {
    metrics: buildMetricCards({
      detection: input.detection,
      sources: input.sources,
      activeAlarmStats: input.activeAlarmStats,
      todayCollisionCount,
      weekCollisionTotal,
      monitoringHref,
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
    attentionCollision,
    monitoringHref,
    overallStatus: resolveOverallStatus({
      detection: input.detection,
      activeAlarmStats: input.activeAlarmStats,
      todayCollisionCount,
      hasAttentionCollision: attentionCollision !== null,
    }),
  };
}

function resolveOverallStatus({
  detection,
  activeAlarmStats,
  todayCollisionCount,
  hasAttentionCollision,
}: {
  detection: DashboardDetectionStatus;
  activeAlarmStats: DashboardActiveAlarmStats;
  todayCollisionCount: number;
  hasAttentionCollision: boolean;
}): DashboardOverallStatus {
  if (
    hasAttentionCollision ||
    activeAlarmStats.critical > 0 ||
    detection.phase === 'halted'
  ) {
    return 'danger';
  }
  if (todayCollisionCount > 0 || activeAlarmStats.total > 0) {
    return 'warning';
  }
  return 'safe';
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
  monitoringHref,
}: {
  detection: DashboardDetectionStatus;
  sources: DashboardDataSourceStatus;
  activeAlarmStats: DashboardActiveAlarmStats;
  todayCollisionCount: number;
  weekCollisionTotal: number;
  monitoringHref: string | null;
}): DashboardMetricCard[] {
  return [
    buildDetectionCard(detection, monitoringHref),
    {
      id: 'todayCollisions',
      titleKey: 'dashboard:metrics.todayCollisions.title',
      descriptionKey: 'dashboard:metrics.todayCollisions.description',
      value: todayCollisionCount,
      format: 'number',
      tone: todayCollisionCount > 0 ? 'warning' : 'success',
      href: monitoringHref ?? undefined,
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
      href: monitoringHref ? `${monitoringHref}/alarm-history` : undefined,
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
  monitoringHref: string | null,
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
    // 감시 중일 때만 pulse — 화면의 모션 초점은 이 점 하나로 유지한다.
    live: detection.enabled && detection.phase === 'scanning',
    href: monitoringHref ?? undefined,
    // idle 은 "감지가 꺼졌나?" 로 읽히기 쉽다 — 실제로는 3D 모니터링 화면이
    // 떠 있는 동안만 검사기가 돌기 때문이라, 그 맥락을 meta 로 알린다.
    metaKey:
      detection.enabled && detection.phase === 'idle'
        ? 'dashboard:collision.idleMeta'
        : detection.pauseOnCollision
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
