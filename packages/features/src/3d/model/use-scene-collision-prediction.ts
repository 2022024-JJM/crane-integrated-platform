import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { SavedSceneInfo } from '@crane/domain/3d';
import { buildTagMappingIndex } from '../lib/tag-mapping-index';
import {
  alignSweepBase,
  PREDICTION_BUDGET_MS,
  PREDICTION_INTERVAL_MS,
  PREDICTION_STEP_MS,
  quantizeLeadTimeSec,
} from '../lib/scene-collision-pairs';
import {
  buildPredictedAddressValues,
  sampleFutureTagValues,
} from '../lib/tag-prediction';
import { rigPoseBorrow } from './use-rig-driver';
import { rigValueStore } from './rig-value-store';
import { isRunnerRunning } from './scene-collision-hold';
import {
  sceneCollisionPredictionRuntime,
  type ScenePredictionHit,
} from './scene-collision-prediction-runtime';
import { sceneCollisionRuntime } from './scene-collision-runtime';
import { useActiveTransformStore } from './use-active-transform-store';
import {
  useSceneCollisionStore,
  type ScenePredictedCollision,
  type ScenePredictionGhost,
} from './use-scene-collision-store';
import { useVirtualTagStore } from './use-virtual-tag-store';
import { virtualTagRuntime } from './virtual-tag-runner';

/**
 * 충돌 예측 — "이대로 가면 몇 초 뒤에 부딪히는가" 를 매 스윕 계산한다.
 *
 * **가상 태그가 장비를 움직이는 동안만 돈다.** 가상 태그 파형은 경과 시간
 * 만의 순수 함수라 미래 값이 정확히 나온다(tag-prediction 주석).
 *
 * 이것은 페이지 모드와 다른 조건이다. 실시간 모니터링 화면에서도 독 ▶ 로
 * 가상 태그를 켜면 그것이 장비를 움직이므로 예측이 그대로 성립하고, 실제
 * WebSocket 값만 흐르는 동안은 러너가 꺼져 있어 저절로 빠진다. 그래서
 * `mode` 가 아니라 러너 상태를 본다.
 *
 * 미래를 모르는 값에는 쓸 수 없다 — WebSocket 값은 미래가 없고 SmoothDamp
 * 속도는 0.35초 안에 target 으로 수렴해 외삽에 쓸 수 없다. 리플레이는 미래
 * 프레임을 이미 배열로 들고 있어 "예측" 이 아니라 정확한 사후 계산이므로
 * 섞지 않는다(검사기 자체도 리플레이에선 마운트되지 않는다).
 *
 * **마운트 위치는 `SceneCollisionDetector` 직후.** 같은 priority 의 useFrame
 * 은 마운트 순서로 돌고, 감지 런타임의 변화 감지는 생 `matrixWorld` 를 비교
 * 한다 — 예측이 먼저 돌면 감지가 미래 행렬을 "움직임" 으로 읽어 거짓 충돌을
 * 기록·정지까지 보고한다. `rigPoseBorrow.release()` 가 행렬을 되돌리므로
 * 순서가 정확성을 지탱하지는 않지만, 방어를 두 겹으로 둔다.
 *
 * 사다리는 **단일 시간 원점**이다. 스윕을 시작할 때 경과 시간을 한 번만 읽고
 * 칸 k 의 목표를 `sweepBase + k × PREDICTION_STEP_MS` 로 잡는다. 칸마다 다시
 * 읽으면 칸을 도는 동안 시간이 흘러 빗살이 미끄러지고(실효 간격이 커진다)
 * 리드타임이 과소 보고된다. 오름차순이라 첫 hit 이 곧 최단 리드타임이다.
 *
 * 정확도 한계는 셋이고 v1 에서는 보정하지 않는다.
 * 1. 점 샘플링이라 한 칸 사이에 들어왔다 나가는 충돌은 놓친다
 *    (PREDICTION_STEP_MS 주석에 실측 속도 근거).
 * 2. 예측은 태그 **target** 을 적용하지만 화면은 SmoothDamp(0.35초)를 거친
 *    값이라, "1.0초" 칸은 실제로 약 1.35초 뒤 자세다. 방향은 안전한 쪽
 *    (경보가 이르다). 칸마다 0.35초를 빼면 첫 칸이 음수가 되어 이상해진다.
 * 3. square 파형은 duty 경계에서 불연속 점프라 미래 target 은 알아도 미래
 *    smoothed 값은 모른다. 리드타임 오차 최대 한 칸이고 칸을 좁혀도 나아지지
 *    않는다.
 */
export function useSceneCollisionPrediction({
  sceneInfo,
  enabled,
}: {
  sceneInfo: SavedSceneInfo | null;
  /** 감지가 켜져 있고 이 화면이 예측 대상인지(호출부 게이트 포함). */
  enabled: boolean;
}): void {
  const models = sceneInfo?.models;
  // useFrame 콜백이 읽는 값 — 렌더 중이 아니라 effect 에서 갱신(react-hooks/refs).
  const enabledRef = useRef(false);
  const indexRef = useRef(buildTagMappingIndex(sceneInfo));
  const lastSweepRef = useRef(0);
  /** 현재 스윕의 시간 원점(ms). 예산 이월 중에는 유지된다. */
  const sweepBaseRef = useRef(0);
  /** 다음에 볼 칸 번호(1 부터). 0 이면 새 스윕을 시작한다. */
  const rungRef = useRef(0);

  useEffect(() => {
    indexRef.current = buildTagMappingIndex(sceneInfo);
  }, [sceneInfo]);

  useEffect(() => {
    sceneCollisionPredictionRuntime.sync(models);
  }, [models]);

  useEffect(() => {
    enabledRef.current = enabled;
    return () => {
      enabledRef.current = false;
      rungRef.current = 0;
      sceneCollisionPredictionRuntime.reset();
      useSceneCollisionStore.getState().setPredicted(null);
    };
  }, [enabled]);

  useFrame(() => {
    const store = useSceneCollisionStore.getState();
    const gateOpen =
      enabledRef.current &&
      store.enabled &&
      store.predictionEnabled &&
      // 페이지 모드가 아니라 **가상 태그 러너가 도는지** 를 본다. 실시간
      // 모니터링 화면도 독 ▶ 로 가상 태그를 켜면 그것이 장비를 움직이므로
      // (AGENTS.md 충돌 감지 항목) 예측이 그대로 성립한다. WebSocket 값만
      // 흐르는 동안은 미래를 알 수 없어 러너가 꺼져 있고, 그래서 이 조건
      // 하나로 두 경우가 갈린다.
      isRunnerRunning('simulation') &&
      !useActiveTransformStore.getState().active;

    if (!gateOpen) {
      // 게이트가 닫히면 예측을 내린다 — 충돌 정지로 러너가 멈추면 이 경로로
      // 주황 표시가 사라져 빨강과 동시에 뜨지 않는다.
      if (store.predicted !== null) store.setPredicted(null);
      rungRef.current = 0;
      return;
    }

    // 프레임 수가 아니라 시계로 스로틀한다 — frameloop='demand' 인 뷰에서
    // invalidate 가 몰리면 매 프레임 스윕이 된다.
    const now = performance.now();
    if (now - lastSweepRef.current < PREDICTION_INTERVAL_MS) return;
    lastSweepRef.current = now;

    const rungs = Math.max(
      1,
      Math.round((store.predictionHorizonSec * 1000) / PREDICTION_STEP_MS),
    );
    if (rungRef.current === 0 || rungRef.current > rungs) {
      rungRef.current = 1;
      // 격자 정렬 — 칸이 항상 같은 절대 시각에 놓여야 두 쌍의 검출 순서가
      // 스윕마다 뒤집히지 않는다(alignSweepBase 주석).
      sweepBaseRef.current = alignSweepBase(virtualTagRuntime.elapsed);
    }

    // 구동 모델이 없으면(리그·node 맵핑이 붙은 모델이 하나도 없는 씬) 미래
    // 자세가 현재와 같다 — 사다리를 돌 이유가 없다.
    const drivenModelIds = rigPoseBorrow.drivenModelIds();
    if (drivenModelIds.length === 0) {
      if (store.predicted !== null) store.setPredicted(null);
      rungRef.current = 0;
      return;
    }

    const tags = useVirtualTagStore.getState().tags;
    const excluded = collectExcludedPairs();
    const t0 = now;

    while (rungRef.current <= rungs) {
      const rung = rungRef.current;
      const targetElapsed = sweepBaseRef.current + rung * PREDICTION_STEP_MS;
      const hit = probeAtElapsed(
        tags,
        targetElapsed,
        indexRef.current,
        excluded,
        drivenModelIds,
        // 한 칸에서 여러 쌍이 겹치면 지금 띄우고 있는 쌍을 유지한다 —
        // 쌍 열거 순서로 정하면 씬이 조금만 달라져도 표시가 바뀐다.
        store.predicted?.pairKey,
      );
      rungRef.current = rung + 1;

      if (hit) {
        const leadMs = targetElapsed - virtualTagRuntime.elapsed;
        const leadTimeSec = quantizeLeadTimeSec(leadMs / 1000);
        const same = store.predicted?.pairKey === hit.key;
        store.setPredicted(
          same
            ? { ...(store.predicted as ScenePredictedCollision), leadTimeSec }
            : {
                pairKey: hit.key,
                a: {
                  modelId: hit.a.modelId,
                  equipName: hit.a.model.equipName,
                  nodePath: hit.a.nodePath,
                },
                b: {
                  modelId: hit.b.modelId,
                  equipName: hit.b.model.equipName,
                  nodePath: hit.b.nodePath,
                },
                leadTimeSec,
                initialLeadTimeSec: leadTimeSec,
                contactPoint: hit.contact,
                // 고스트·궤적·지면 캡처는 자세 차용을 십수 번 더 하는 비싼
                // 경로다. **쌍이 새로 잡힐 때만** 돈다 — 같은 쌍이 이어지는
                // 동안은 리드타임만 갱신하고 표시는 고정이다.
                ...captureVisuals({
                  hit,
                  tags,
                  index: indexRef.current,
                  targetElapsed,
                }),
              },
        );
        // 오름차순이라 이 칸이 최단이다 — 다음 틱에 새 원점으로 다시 훑는다.
        rungRef.current = 0;
        return;
      }

      // 예산은 칸 사이에서만 본다. 첫 칸은 항상 끝까지 돌려 매 틱 최소 한
      // 칸은 진전이 있게 한다(감지 런타임과 같은 규칙).
      if (performance.now() - t0 >= PREDICTION_BUDGET_MS) break;
    }

    if (rungRef.current > rungs) {
      // 지평선 전체를 훑었고 아무것도 없다 — 예측을 내리고 다음 틱에 새 원점.
      if (store.predicted !== null) store.setPredicted(null);
      rungRef.current = 0;
    }
  });
}

// ---- 표시용 캡처 (쌍이 새로 잡힐 때만) ----

interface CaptureVisualsArgs {
  hit: ScenePredictionHit;
  tags: Parameters<typeof sampleFutureTagValues>[0];
  index: ReturnType<typeof buildTagMappingIndex>;
  targetElapsed: number;
}

type PredictionVisuals = Pick<ScenePredictedCollision, 'ghosts'>;

/**
 * 예측 표시에 필요한 것을 캡처한다 — 충돌 순간의 자세(고스트).
 *
 * 자세를 차용해 읽으므로 `borrow`/`release` 가 든다. 그래서 호출자가
 * **쌍이 새로 잡힐 때만** 부른다. 같은 쌍이 이어지는 동안은 리드타임만
 * 갱신되고 표시는 고정이다.
 */
function captureVisuals({
  hit,
  tags,
  index,
  targetElapsed,
}: CaptureVisualsArgs): PredictionVisuals {
  // 충돌 순간 자세 — 이 시각은 방금 검사한 칸과 같다.
  return {
    ghosts: captureGhostsAt(tags, targetElapsed, index, [
      hit.a.modelId,
      hit.b.modelId,
    ]),
  };
}

/** 한 시각의 자세를 차용해 대상 모델들의 스냅샷을 뜬다. */
function captureGhostsAt(
  tags: Parameters<typeof sampleFutureTagValues>[0],
  atElapsedMs: number,
  index: ReturnType<typeof buildTagMappingIndex>,
  modelIds: readonly string[],
): ScenePredictionGhost[] {
  sampleFutureTagValues(tags, atElapsedMs, getCurrentTagValue, _futureTags);
  buildPredictedAddressValues(index, _futureTags, _futureAddresses);
  if (!rigPoseBorrow.borrow(predictionResolve)) return [];
  try {
    const out: ScenePredictionGhost[] = [];
    for (const modelId of modelIds) {
      const pose = rigPoseBorrow.captureModelPose(modelId);
      // 구동되지 않는 장비는 미래 자세가 현재와 같다 — 고스트를 그리면
      // 실물과 겹친 이중상만 되므로 건너뛴다.
      if (!pose) continue;
      out.push({ modelId, path: pose.path, nodes: pose.nodes });
    }
    return out;
  } finally {
    rigPoseBorrow.release();
  }
}

const _futureTags = new Map<string, number>();
const _futureAddresses = new Map<string, number>();

/** 미래 값이 없는 주소는 현재값으로 — 수동 슬라이더로 세운 관절 등. */
function predictionResolve(address: string): number {
  const predicted = _futureAddresses.get(address);
  return predicted === undefined ? rigValueStore.get(address) : predicted;
}

/**
 * 한 시각의 자세를 차용해 검사한다. 차용은 반드시 같은 콜백 안에서
 * 되돌린다 — `finally` 로 묶어 검사가 throw 해도 자세가 남지 않게 한다.
 */
function probeAtElapsed(
  tags: Parameters<typeof sampleFutureTagValues>[0],
  targetElapsedMs: number,
  index: ReturnType<typeof buildTagMappingIndex>,
  excludedPairKeys: ReadonlySet<string>,
  drivenModelIds: readonly string[],
  preferPairKey?: string,
) {
  sampleFutureTagValues(tags, targetElapsedMs, getCurrentTagValue, _futureTags);
  buildPredictedAddressValues(index, _futureTags, _futureAddresses);
  if (!rigPoseBorrow.borrow(predictionResolve)) return null;
  try {
    return sceneCollisionPredictionRuntime.scanSample({
      drivenModelIds,
      excludedPairKeys,
      preferPairKey,
    });
  } finally {
    rigPoseBorrow.release();
  }
}

function getCurrentTagValue(id: string): number | undefined {
  return virtualTagRuntime.getValue(id);
}

const _excluded = new Set<string>();

/**
 * 예측에서 뺄 쌍.
 * - 감지 기준선이 **일부러** 억제한 쌍(에디터에서 겹쳐 놓은 모델, 로딩 배치).
 *   빼지 않으면 그 쌍이 모든 칸에서 hit 이 되어 영구 경보가 된다.
 * - 이미 보고된 활성 충돌 쌍. `pauseOnCollision` 이 꺼져 있으면 러너가 계속
 *   돌아 빨강과 주황이 같은 쌍에 동시에 뜬다.
 */
function collectExcludedPairs(): ReadonlySet<string> {
  _excluded.clear();
  for (const key of sceneCollisionRuntime.suppressedKeys) _excluded.add(key);
  const { history, activeRecordId } = useSceneCollisionStore.getState();
  if (activeRecordId !== null) {
    const active = history.find((r) => r.id === activeRecordId);
    if (active) _excluded.add(active.pairKey);
  }
  return _excluded;
}
