import { useEffect, useMemo } from 'react';
import { useSiteType } from '@crane/core/lib/site-type-context';
import { getRegionsBySiteType } from '@crane/domain/region';
import {
  useAlarmJournalStore,
  useRealtimeAlarmStore,
  getRealtimeAlarmStatsByRegion,
} from '@crane/features/alarm';
import {
  sceneCollisionRuntime,
  useCollisionJournalStore,
  useRealtimeStore,
  useSceneCollisionStore,
  useVirtualTagStore,
} from '@crane/features/3d';
import { useNowTick } from './use-now-tick';
import { buildCollisionSummary } from './build-collision-summary';
import { useSceneOverview } from './use-scene-overview';
import type {
  DashboardActiveAlarmStats,
  DashboardEquipmentRow,
  DashboardSummary,
} from './types';

/**
 * 충돌방지 관제 대시보드의 단일 데이터 훅 — 전부 실 데이터.
 * journal(영속 이력)·충돌 감지 상태·러너 가동·실시간 활성 알람·씬 배치를
 * 모아 summary 로 만든다. 런타임 phase 는 React 상태가 아니라 1초 폴링으로
 * 읽는다(useRigLivePoll 관례). 집계의 `now` 도 같은 틱에서 갱신돼 자정을
 * 넘겨 떠 있어도 일별 버킷이 따라온다.
 */
export function useCollisionDashboard(): {
  summary: DashboardSummary;
  equipment: DashboardEquipmentRow[];
} {
  const { siteType } = useSiteType();
  const regions = useMemo(() => getRegionsBySiteType(siteType), [siteType]);

  // journal sync 는 앱 셸에 마운트돼 있지만 hydrate 는 멱등이라 대시보드가
  // 먼저 뜨는 경로에서도 안전하게 한 번 더 부른다.
  useEffect(() => {
    useCollisionJournalStore.getState().hydrate();
    useAlarmJournalStore.getState().hydrate();
  }, []);

  const collisionEntries = useCollisionJournalStore((s) => s.entries);
  const alarmEntries = useAlarmJournalStore((s) => s.entries);
  const detectionEnabled = useSceneCollisionStore((s) => s.enabled);
  const pauseOnCollision = useSceneCollisionStore((s) => s.pauseOnCollision);
  const simulationRunning = useVirtualTagStore((s) => s.isRunning);
  const virtualTagsHydrated = useVirtualTagStore((s) => s.hydrated);
  const virtualTags = useVirtualTagStore((s) => s.tags);
  const realtimeRunning = useRealtimeStore((s) => s.isRunning);
  const realtimeHeld = useRealtimeStore((s) => s.held);
  const activeAlarms = useRealtimeAlarmStore((s) => s.activeAlarms);
  const sceneOverview = useSceneOverview(regions);

  // 장비 라이브 태그의 표시명·단위를 위해 가상 태그 정의를 로드한다
  // (모니터링을 먼저 열지 않은 세션 대비). 읽기 전용 fetch 라 부작용 없음.
  useEffect(() => {
    if (virtualTagsHydrated) return;
    useVirtualTagStore
      .getState()
      .load()
      .catch((error: unknown) => {
        console.warn('[dashboard] Failed to load virtual tags.', error);
      });
  }, [virtualTagsHydrated]);

  // phase(런타임 mutable) 폴링과 일별 버킷의 now — 1Hz 면 관제 표시에 충분하다.
  const now = useNowTick(1000);

  const summary = useMemo(() => {
    const activeAlarmStats = sumActiveAlarmStats(
      regions.map((region) =>
        getRealtimeAlarmStatsByRegion(activeAlarms, region.id),
      ),
    );
    return buildCollisionSummary({
      regions,
      collisionEntries,
      alarmEntries,
      detection: {
        enabled: detectionEnabled,
        phase: sceneCollisionRuntime.currentPhase,
        pauseOnCollision,
      },
      sources: { simulationRunning, realtimeRunning, realtimeHeld },
      activeAlarmStats,
      equipmentCountByRegion: sceneOverview.equipmentCountByRegion,
      now,
    });
  }, [
    now,
    regions,
    collisionEntries,
    alarmEntries,
    detectionEnabled,
    pauseOnCollision,
    simulationRunning,
    realtimeRunning,
    realtimeHeld,
    activeAlarms,
    sceneOverview.equipmentCountByRegion,
  ]);

  const equipment = useMemo(() => {
    const defsByKey = new Map(virtualTags.map((def) => [def.key, def]));
    return sceneOverview.equipment.map((row) => ({
      ...row,
      tags: row.tags.map((tag) => {
        const def = defsByKey.get(tag.tagKey);
        return {
          tagKey: tag.tagKey,
          label: def?.name || tag.tagKey,
          unit: def?.unit ?? null,
        };
      }),
    }));
  }, [sceneOverview.equipment, virtualTags]);

  return { summary, equipment };
}

function sumActiveAlarmStats(
  statsList: ReadonlyArray<{
    critical: number;
    high: number;
    medium: number;
    info: number;
  }>,
): DashboardActiveAlarmStats {
  const sum = { critical: 0, high: 0, medium: 0, info: 0, total: 0 };
  for (const stats of statsList) {
    sum.critical += stats.critical;
    sum.high += stats.high;
    sum.medium += stats.medium;
    sum.info += stats.info;
  }
  sum.total = sum.critical + sum.high + sum.medium + sum.info;
  return sum;
}
