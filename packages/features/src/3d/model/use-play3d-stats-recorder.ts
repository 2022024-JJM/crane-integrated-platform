import { useEffect, useMemo, useRef } from 'react';
import { scenarioDurationMs } from '@crane/domain/virtual-tag';
import type { EquipmentRuntimeStatus } from '@crane/core/types/status';
import type { SavedSceneInfo } from '@crane/domain/3d';
import {
  accumulateTagValue,
  addScannedInterval,
  createTagAggregate,
  emptyStatusMs,
  type Play3dEvent,
} from '../lib/play3d-stats';
import {
  isCollisionExcluded,
  omitRuntimeStatuses,
  reportExcludedModelIds,
} from '../lib/play3d-scope';
import { collectSceneTagKeys } from '../lib/tag-mapping-index';
import type { RuntimeStatusRecord } from '../lib/model-runtime-status';
import { diffZoneIntrusions, pairKeyOf } from '../lib/zone-journal-map';
import {
  readPlay3dFrameIndex,
  readPlay3dPositionMs,
  usePlay3dTransport,
} from './play3d-transport';
import { subscribeTagValues } from './tag-value-bus';
import { useModelRuntimeStatuses } from './use-model-runtime-statuses';
import { usePlay3dStore, type Play3dSource } from './use-play3d-store';
import {
  usePlay3dStatsStore,
  type Play3dStatsData,
  type Play3dStatsMeta,
} from './use-play3d-stats-store';
import { useReplayPlayerStore } from './use-replay-player-store';
import { useSceneCollisionStore } from './use-scene-collision-store';
import { useSceneInfoStore } from './use-scene-info-store';
import { useSceneZoneStore } from './use-scene-zone-store';
import { useVirtualTagStore } from './use-virtual-tag-store';

/** 위치·검사 구간·상태 누적 폴링 주기. */
export const PLAY3D_STATS_POLL_MS = 250;
/**
 * 한 폴링에서 이만큼 넘게 건너뛴 위치 변화는 seek 로 본다 — 검사 구간·상태
 * 누적에 넣지 않는다(재생이 지나간 시간이 아니다). 배속 × 폴링 주기의 몇 배.
 */
const SEEK_JUMP_FACTOR = 6;

function buildMeta(source: Play3dSource, regionId: string): Play3dStatsMeta {
  const replay = useReplayPlayerStore.getState();
  const sim = useVirtualTagStore.getState();
  const scenario =
    sim.scenarios.find((s) => s.id === sim.activeScenarioId) ?? null;
  return {
    source,
    regionId,
    replayFrom:
      source === 'replay' ? (replay.frames[0]?.timestamp ?? null) : null,
    replayTo:
      source === 'replay'
        ? (replay.frames[replay.frames.length - 1]?.timestamp ?? null)
        : null,
    scenarioName:
      source === 'simulation' && scenario ? scenario.name || scenario.id : null,
    scenarioLoop: source === 'simulation' ? (scenario?.loop ?? false) : false,
    startedAt: Date.now(),
  };
}

function activeScenarioDurationMs(source: Play3dSource): number | null {
  if (source !== 'simulation') return null;
  const sim = useVirtualTagStore.getState();
  const scenario = sim.scenarios.find((s) => s.id === sim.activeScenarioId);
  return scenario ? scenarioDurationMs(scenario) : null;
}

function pushEvent(
  data: Play3dStatsData,
  event: Omit<Play3dEvent, 'id' | 'atMs' | 'frameIndex'>,
): void {
  data.events.push({
    ...event,
    id: data.nextEventId++,
    atMs: readPlay3dPositionMs(),
    frameIndex: readPlay3dFrameIndex(),
  });
}

function modelName(scene: SavedSceneInfo | null, modelId: string): string {
  const model = scene?.models.find((m) => m.id === modelId);
  return model?.equipName || modelId;
}

/**
 * 3D 플레이 실행 통계 기록기 — Play3dView 가 Canvas 밖에서 한 번 마운트한다.
 * 충돌 기록·영역 침범·정지(hold)·두절 전이를 사건으로, 재생 중 지나간 씬 시간을
 * 검사 구간·장비 상태 누적으로, 버스 publish 를 태그 집계로 쌓는다. 사건 시각은
 * 스토어의 벽시계 `at` 이 아니라 그 순간의 트랜스포트 위치(씬 시간)다 —
 * zustand 구독은 같은 틱 안에서 동기로 오므로 정확하다.
 *
 * 실행의 시작점(reset): 마운트, 소스 전환, 새 구간 조회(프레임 참조 교체),
 * 시나리오 변경, 시뮬레이션 종료(hasSession true→false). 값·시간 초기화
 * (resetValues)와 seek(0) 은 reset 이 아니라 뒤로 seek 다 — 창이 0 으로
 * 줄어 사건이 감춰질 뿐 기록은 남는다.
 *
 * "영역 감지에서 제외"(zoneExempt) 모델은 리포트에서 뺀다(lib/play3d-scope) —
 * 상태 기록을 여기서 한 번 걸러 누적·전이·시딩이 모두 따라오고, 그 모델이 끼인
 * 충돌은 사건으로 남기지 않는다. 영역 사건은 런타임이 애초에 감지하지 않는다.
 * 공용 훅(useModelRuntimeStatuses)은 라벨·HUD 가 전 모델을 전제로 써서 그대로다.
 */
export function usePlay3dStatsRecorder(regionId: string): void {
  const sceneInfo = useSceneInfoStore(
    (s) => s.sceneInfoByRegion[regionId] ?? null,
  );
  const source = usePlay3dStore((s) => s.source);
  const transport = usePlay3dTransport();
  const rawStatuses = useModelRuntimeStatuses(sceneInfo, {
    paused: !transport.isPlaying,
    timeScale: transport.speed,
  });
  const excluded = useMemo(
    () => reportExcludedModelIds(sceneInfo),
    [sceneInfo],
  );
  const statuses = useMemo(
    () => omitRuntimeStatuses(rawStatuses, excluded),
    [rawStatuses, excluded],
  );
  const collisionEnabled = useSceneCollisionStore((s) => s.enabled);

  // useFrame 급 콜백(폴링·구독)이 읽는 값 — effect 에서만 갱신.
  const sceneRef = useRef<SavedSceneInfo | null>(null);
  const statusesRef = useRef<RuntimeStatusRecord>({});
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const collisionEnabledRef = useRef(true);
  const sourceRef = useRef<Play3dSource>(source);
  const excludedRef = useRef<ReadonlySet<string>>(excluded);
  useEffect(() => {
    sceneRef.current = sceneInfo;
  }, [sceneInfo]);
  useEffect(() => {
    excludedRef.current = excluded;
  }, [excluded]);
  useEffect(() => {
    playingRef.current = transport.isPlaying;
    speedRef.current = transport.speed;
  }, [transport.isPlaying, transport.speed]);
  useEffect(() => {
    collisionEnabledRef.current = collisionEnabled;
  }, [collisionEnabled]);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  // 실행 시작점 — 마운트·소스 전환과, 소스별 재시작 신호. reset 뒤엔 지금
  // 알고 있는 상태를 첫 전이(unknown→x)로 심어 밴드가 창 시작부터 그려진다.
  useEffect(() => {
    const restart = () => {
      usePlay3dStatsStore
        .getState()
        .reset(buildMeta(source, regionId), activeScenarioDurationMs(source));
      const { data } = usePlay3dStatsStore.getState();
      const atMs = readPlay3dPositionMs();
      for (const [modelId, to] of Object.entries(statusesRef.current)) {
        if (to === 'unknown') continue;
        data.statusTransitions.push({ atMs, modelId, from: 'unknown', to });
      }
    };
    restart();
    const unsubReplay = useReplayPlayerStore.subscribe((state, prev) => {
      if (source === 'replay' && state.frames !== prev.frames) restart();
    });
    const unsubSim = useVirtualTagStore.subscribe((state, prev) => {
      if (source !== 'simulation') return;
      if (state.activeScenarioId !== prev.activeScenarioId) restart();
      else if (!state.hasSession && prev.hasSession) restart();
    });
    return () => {
      unsubReplay();
      unsubSim();
    };
  }, [source, regionId]);

  // 충돌 기록 → 사건.
  useEffect(
    () =>
      useSceneCollisionStore.subscribe((state, prev) => {
        if (state.history === prev.history) return;
        const prevIds = new Set(prev.history.map((r) => r.id));
        const fresh = state.history
          .filter((r) => !prevIds.has(r.id))
          .filter(
            (r) =>
              !isCollisionExcluded(
                r.a.modelId,
                r.b.modelId,
                excludedRef.current,
              ),
          )
          .sort((a, b) => a.id - b.id);
        if (fresh.length === 0) return;
        const { data, bump } = usePlay3dStatsStore.getState();
        for (const record of fresh) {
          pushEvent(data, {
            kind: 'collision',
            subject: record.pairKey,
            label: `${record.a.equipName || record.a.modelId} ↔ ${record.b.equipName || record.b.modelId}`,
            modelIds: [record.a.modelId, record.b.modelId],
          });
        }
        bump();
      }),
    [],
  );

  // 영역 침범 diff → 진입·이탈 사건.
  useEffect(
    () =>
      useSceneZoneStore.subscribe((state, prev) => {
        if (state.intrusions === prev.intrusions) return;
        const { entered, exited } = diffZoneIntrusions(
          prev.intrusions,
          state.intrusions,
        );
        if (entered.length === 0 && exited.length === 0) return;
        const { data, bump } = usePlay3dStatsStore.getState();
        for (const kind of ['zoneEnter', 'zoneExit'] as const) {
          for (const ref of kind === 'zoneEnter' ? entered : exited) {
            const { intrusion } = ref;
            pushEvent(data, {
              kind,
              subject: pairKeyOf(intrusion.zoneKey, ref.intruderId),
              label: `${intrusion.ownerName} · ${intrusion.zoneName || intrusion.zoneId} ← ${ref.intruderName}`,
              level: intrusion.level,
              zoneKey: intrusion.zoneKey,
              zoneName: `${intrusion.ownerName} · ${intrusion.zoneName || intrusion.zoneId}`,
              ownerId: intrusion.ownerId,
              intruderId: ref.intruderId,
              intruderName: ref.intruderName,
            });
          }
        }
        bump();
      }),
    [],
  );

  // 정지(hold) — 충돌 pinned 또는 영역 held 인 동안. 벽시계로 누적한다.
  useEffect(() => {
    let holdingSince: number | null = null;
    const evaluate = () => {
      const pinned = useSceneCollisionStore.getState().activeMode === 'pinned';
      const zoneHeld = useSceneZoneStore.getState().held !== null;
      const holding = pinned || zoneHeld;
      if (holding === (holdingSince !== null)) return;
      const { data, bump } = usePlay3dStatsStore.getState();
      if (holding) {
        holdingSince = Date.now();
        pushEvent(data, {
          kind: 'holdStart',
          subject: pinned ? 'collision' : 'zone',
          label: pinned ? 'collision' : 'zone',
        });
      } else {
        data.holdWallMs += Math.max(0, Date.now() - (holdingSince ?? 0));
        holdingSince = null;
        pushEvent(data, { kind: 'holdEnd', subject: 'hold', label: '' });
      }
      bump();
    };
    const unsubCollision = useSceneCollisionStore.subscribe(evaluate);
    const unsubZone = useSceneZoneStore.subscribe(evaluate);
    return () => {
      unsubCollision();
      unsubZone();
    };
  }, []);

  // 상태 전이 — 전부 밴드 타임라인용으로 남기고, 두절 진입·복귀만 사건으로
  // (첫 unknown→x 는 사건이 아니다).
  useEffect(() => {
    const prev = statusesRef.current;
    statusesRef.current = statuses;
    const { data, bump } = usePlay3dStatsStore.getState();
    let changed = false;
    for (const [modelId, to] of Object.entries(statuses)) {
      const from: EquipmentRuntimeStatus = prev[modelId] ?? 'unknown';
      if (from === to) continue;
      data.statusTransitions.push({
        atMs: readPlay3dPositionMs(),
        modelId,
        from,
        to,
      });
      changed = true;
      if (from === 'unknown') continue;
      if (from !== 'offline' && to !== 'offline') continue;
      pushEvent(data, {
        kind: to === 'offline' ? 'offlineEnter' : 'offlineExit',
        subject: modelId,
        label: modelName(sceneRef.current, modelId),
      });
      changed = true;
    }
    if (changed) bump();
  }, [statuses]);

  // 위치·검사 구간·상태 누적 폴링.
  useEffect(() => {
    let lastPos = readPlay3dPositionMs();
    const timer = window.setInterval(() => {
      const pos = readPlay3dPositionMs();
      const { data, bump } = usePlay3dStatsStore.getState();
      const delta = pos - lastPos;
      const maxStep =
        PLAY3D_STATS_POLL_MS * speedRef.current * SEEK_JUMP_FACTOR + 500;
      if (playingRef.current && delta > 0 && delta <= maxStep) {
        data.scanned = addScannedInterval(data.scanned, lastPos, pos);
        if (!collisionEnabledRef.current) data.detectionOffSeen = true;
        const scene = sceneRef.current;
        for (const [modelId, status] of Object.entries(statusesRef.current)) {
          let agg = data.statuses[modelId];
          if (!agg) {
            agg = {
              modelId,
              name: modelName(scene, modelId),
              ms: emptyStatusMs(),
            };
            data.statuses[modelId] = agg;
          }
          agg.ms[status] += delta;
        }
      }
      // 위치가 닿은 가장 먼 지점 — 재생 여부·seek 와 무관. 시간 축의 앵커라
      // 뒤로 끌어도 축이 줄지 않는다. 아래 windowEndMs 비교보다 앞에 둔다 —
      // reachedMs ≥ windowEndMs 라 여기서 자라면 그 비교가 반드시 bump 한다.
      // 폴링 사이에 뛰었다 돌아온 지점은 남지 않는다(어댑터 seek 가 통계에
      // 쓰면 역의존이라 받아들인다).
      if (pos > data.reachedMs) data.reachedMs = pos;
      lastPos = pos;
      if (data.windowEndMs !== pos) {
        data.windowEndMs = pos;
        bump();
      }
    }, PLAY3D_STATS_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  // 태그 집계 — 버스 publish 마다(맵핑된 키만). 한계 포화는 시뮬레이션만.
  useEffect(() => {
    const keys = new Set(collectSceneTagKeys(sceneInfo));
    if (keys.size === 0) return;
    return subscribeTagValues((key, value) => {
      if (!keys.has(key)) return;
      const { data } = usePlay3dStatsStore.getState();
      let agg = data.tags[key];
      let maxSpeed: number | null = null;
      if (sourceRef.current === 'simulation') {
        const def = useVirtualTagStore
          .getState()
          .tags.find((t) => t.key === key);
        maxSpeed = def?.limits?.maxSpeed ?? null;
      }
      if (!agg) {
        agg = createTagAggregate(key, maxSpeed !== null);
        data.tags[key] = agg;
      }
      accumulateTagValue(agg, value, readPlay3dPositionMs(), maxSpeed);
    });
  }, [sceneInfo]);
}
