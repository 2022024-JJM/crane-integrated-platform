import { useEffect, useMemo, useRef, useState } from 'react';
import { scenarioDurationMs } from '@crane/domain/virtual-tag';
import type { EquipmentRuntimeStatus } from '@crane/core/types/status';
import type { SavedSceneInfo } from '@crane/domain/3d';
import {
  REPASS_JITTER_MS,
  accumulateTagValue,
  addScannedInterval,
  createTagAggregate,
  decideZoneEvent,
  emptyStatusMs,
  hasEventNear,
  openZoneSubjectsAt,
  type Play3dEvent,
} from '../lib/play3d-stats';
import {
  isCollisionExcluded,
  omitRuntimeStatuses,
  reportExcludedModelIds,
} from '../lib/play3d-scope';
import { collectSceneTagKeys } from '../lib/tag-mapping-index';
import type { RuntimeStatusRecord } from '../lib/model-runtime-status';
import {
  diffZoneIntrusions,
  pairKeyOf,
  type ZonePairRef,
} from '../lib/zone-journal-map';
import {
  readPlay3dFrameIndex,
  readPlay3dPositionMs,
  usePlay3dTransport,
} from './play3d-transport';
import { subscribeSceneSeek } from './scene-seek-signal';
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
/**
 * seek 뒤 자세가 정착할 때까지(벽시계) 영역·충돌 전이를 사건으로 남기지 않는
 * 창. 리깅 스무딩(SmoothDamp, smoothTime 0.35s)의 임계감쇠 잔여가 1.2s 에
 * 0.8% 이고 영역 스캔 50ms + 프레임 1개를 더한 값. 리플레이 seek 는 rest 를
 * 거쳐 이동이 커서 충돌 재기준선(BASELINE_SETTLE_MS)보다 보수적이다.
 * `hasPendingSmoothing` 으로 판정하지 않는다 — 값 도달이 수 초까지 늦다.
 */
const SEEK_SETTLE_MS = 1200;

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
  event: Omit<Play3dEvent, 'id' | 'atMs' | 'frameIndex' | 'provisional'>,
  provisional = false,
): void {
  data.events.push({
    ...event,
    id: data.nextEventId++,
    atMs: readPlay3dPositionMs(),
    frameIndex: readPlay3dFrameIndex(),
    ...(provisional ? { provisional: true } : {}),
  });
}

/** 기존 사건의 시각을 지금 위치로 옮긴다(제자리 수정 — id·타임라인 key 유지). */
function replaceEventTime(
  data: Play3dStatsData,
  id: number,
  provisional: boolean,
): void {
  const target = data.events.find((e) => e.id === id);
  if (!target) return;
  target.atMs = readPlay3dPositionMs();
  target.frameIndex = readPlay3dFrameIndex();
  if (provisional) target.provisional = true;
  else delete target.provisional;
}

type ZoneEventFields = Omit<
  Play3dEvent,
  'id' | 'atMs' | 'frameIndex' | 'kind' | 'provisional'
>;

/** 영역 침범 쌍 → 사건 필드. diff 와 정착 화해가 같이 쓴다. */
function zoneEventFields(ref: ZonePairRef): ZoneEventFields {
  const { intrusion } = ref;
  const zoneName = `${intrusion.ownerName} · ${intrusion.zoneName || intrusion.zoneId}`;
  return {
    subject: pairKeyOf(intrusion.zoneKey, ref.intruderId),
    label: `${zoneName} ← ${ref.intruderName}`,
    level: intrusion.level,
    zoneKey: intrusion.zoneKey,
    zoneName,
    ownerId: intrusion.ownerId,
    intruderId: ref.intruderId,
    intruderName: ref.intruderName,
  };
}

/** 로그의 열린 진입 사건 → 그 이탈 사건의 필드(침범 쌍이 스토어에 없을 때). */
function zoneExitFieldsOf(enter: Play3dEvent): ZoneEventFields {
  return {
    subject: enter.subject,
    label: enter.label,
    level: enter.level,
    zoneKey: enter.zoneKey,
    zoneName: enter.zoneName,
    ownerId: enter.ownerId,
    intruderId: enter.intruderId,
    intruderName: enter.intruderName,
  };
}

/**
 * 영역 전이를 로그 기준 결정(decideZoneEvent)에 따라 반영한다 — seek 는 로그를
 * 바꾸지 않는다. 정착 화해가 넣는 사건은 잠정(provisional)이고 실제 전이가
 * 교체한다. 무언가 바뀌었으면 true.
 */
function recordZoneEvent(
  data: Play3dStatsData,
  kind: 'zoneEnter' | 'zoneExit',
  fields: ZoneEventFields,
  provisional: boolean,
): boolean {
  const decision = decideZoneEvent(
    data.events,
    kind,
    fields.subject,
    readPlay3dPositionMs(),
  );
  if (decision.action === 'skip') return false;
  if (decision.action === 'replace') {
    replaceEventTime(data, decision.id, provisional);
    return true;
  }
  pushEvent(data, { kind, ...fields }, provisional);
  return true;
}

/**
 * seek 정착 뒤 화해 — 런타임(영역 스토어 intrusions)과 로그의 지금 위치 상태를
 * 맞춘다. 런타임이 안인데 로그가 밖이면 진입, 로그가 안인데 런타임이 밖이면
 * 이탈을 잠정으로 넣는다(교체 규칙은 decideZoneEvent).
 */
function reconcileZones(): void {
  const { data, bump } = usePlay3dStatsStore.getState();
  const current = diffZoneIntrusions(
    [],
    useSceneZoneStore.getState().intrusions,
  ).entered;
  const runtimeInside = new Set<string>();
  let changed = false;
  for (const ref of current) {
    const fields = zoneEventFields(ref);
    runtimeInside.add(fields.subject);
    if (recordZoneEvent(data, 'zoneEnter', fields, true)) changed = true;
  }
  const open = openZoneSubjectsAt(data.events, readPlay3dPositionMs());
  for (const [subject, enter] of open) {
    if (runtimeInside.has(subject)) continue;
    if (recordZoneEvent(data, 'zoneExit', zoneExitFieldsOf(enter), true)) {
      changed = true;
    }
  }
  if (changed) bump();
}

/**
 * 정착 타이머 — seek 마다 (재)무장하고 마지막 seek 뒤 `delayMs` 에 한 번
 * `onSettled`. 무장~만료 사이가 정착 중이다.
 */
function createSeekSettle(delayMs: number, onSettled: () => void) {
  let timer: number | null = null;
  let settling = false;
  return {
    arm(): void {
      settling = true;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        settling = false;
        onSettled();
      }, delayMs);
    },
    isSettling: (): boolean => settling,
    dispose(): void {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      settling = false;
    },
  };
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
 *
 * seek 는 로그를 바꾸지 않는다: seek 신호(scene-seek-signal)와 reset 뒤
 * `SEEK_SETTLE_MS` 동안 영역·충돌 전이를 사건으로 남기지 않고(자세가 스무딩으로
 * 미끄러지는 동안의 전이는 seek 목표 시각의 사건이 아니다), 정착하면 런타임과
 * 로그를 화해한다. 정착 뒤의 전이도 로그 기준 결정(decideZoneEvent)을 거쳐
 * 재통과 중복을 넣지 않는다. 정착 창 안의 실제 전이(시뮬레이션 재생 중 seek,
 * 창 × 배속)는 남지 않고, 정착 중 미끄러짐이 충돌 정지를 일으키면 holdStart 만
 * 남는다.
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
  // seek 정착 타이머 — 인스턴스당 하나. 구독 콜백이 isSettling 을 읽는다.
  const [settle] = useState(() =>
    createSeekSettle(SEEK_SETTLE_MS, reconcileZones),
  );
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

  // seek 신호 → 정착 창. 언마운트에서 타이머를 지운다.
  useEffect(() => {
    const unsubscribe = subscribeSceneSeek(() => settle.arm());
    return () => {
      unsubscribe();
      settle.dispose();
    };
  }, [settle]);

  // 실행 시작점 — 마운트·소스 전환과, 소스별 재시작 신호. reset 뒤엔 지금
  // 알고 있는 상태를 첫 전이(unknown→x)로 심어 밴드가 창 시작부터 그려진다.
  // reset 도 자세 불연속이라 정착 창을 무장한다 — 정착 뒤 화해가 처음부터 안에
  // 있던 쌍의 진입을 심는다.
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
      settle.arm();
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
  }, [source, regionId, settle]);

  // 충돌 기록 → 사건. 정착 중은 버리고, 재통과 중복(같은 쌍 ±jitter)은 넣지 않는다.
  useEffect(
    () =>
      useSceneCollisionStore.subscribe((state, prev) => {
        if (state.history === prev.history) return;
        if (settle.isSettling()) return;
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
        const atMs = readPlay3dPositionMs();
        let changed = false;
        for (const record of fresh) {
          if (
            hasEventNear(
              data.events,
              'collision',
              record.pairKey,
              atMs,
              REPASS_JITTER_MS,
            )
          ) {
            continue;
          }
          pushEvent(data, {
            kind: 'collision',
            subject: record.pairKey,
            label: `${record.a.equipName || record.a.modelId} ↔ ${record.b.equipName || record.b.modelId}`,
            modelIds: [record.a.modelId, record.b.modelId],
          });
          changed = true;
        }
        if (changed) bump();
      }),
    [settle],
  );

  // 영역 침범 diff → 진입·이탈 사건. 정착 중은 버린다(정착 뒤 화해가 맞춘다).
  useEffect(
    () =>
      useSceneZoneStore.subscribe((state, prev) => {
        if (state.intrusions === prev.intrusions) return;
        if (settle.isSettling()) return;
        const { entered, exited } = diffZoneIntrusions(
          prev.intrusions,
          state.intrusions,
        );
        if (entered.length === 0 && exited.length === 0) return;
        const { data, bump } = usePlay3dStatsStore.getState();
        let changed = false;
        for (const kind of ['zoneEnter', 'zoneExit'] as const) {
          for (const ref of kind === 'zoneEnter' ? entered : exited) {
            if (recordZoneEvent(data, kind, zoneEventFields(ref), false)) {
              changed = true;
            }
          }
        }
        if (changed) bump();
      }),
    [settle],
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
