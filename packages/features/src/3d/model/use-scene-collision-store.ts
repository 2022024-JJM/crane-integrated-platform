import { create } from 'zustand';
import type { Vector3Tuple } from '@crane/core/types/math';
import type { GhostNodePose } from '@crane/domain/3d';
import {
  clampPredictionHorizonSec,
  FLASH_MS,
  HISTORY_MAX,
  PREDICTION_HORIZON_DEFAULT_SEC,
} from '../lib/scene-collision-pairs';
import { rigValueStore } from './rig-value-store';
import { holdRunners, releaseRunners } from './scene-collision-hold';
import { sceneCollisionRuntime } from './scene-collision-runtime';

/**
 * 씬 객체 충돌 감지의 React 상태 — 세션 전용(씬 데이터·localStorage 아님).
 * `enabled`·`pauseOnCollision` 은 모니터링(시뮬레이션·실시간)·에디터가 공유한다.
 * 둘 다 기본 ON — 관제자가 매번 켜지 않아도 되게 한다. 세션 전용이라 사용자가
 * 끄면 새로고침 전까지만 OFF 이고, 검사기 언마운트(`clear`)는 되돌리지 않는다.
 *
 * 프레임 루프(scene-collision-runtime)는 여기에 쓰지 않는다. 검사기 훅이
 * 충돌을 받았을 때 기록을 한 번 넣고(`pushRecord`) 정지 모드면 `pin`,
 * 무정지 모드면 `flash`(FLASH_MS 뒤 자동 해제) 한다.
 *
 * 기록은 노드를 Object3D 참조가 아니라 `modelId + nodePath` 로 가리킨다 —
 * 그릴 때 registry 에서 해석하므로(resolveRecordNodes) 기록이 남아 있는 동안
 * 모델이 리마운트돼도 유효하다. `values` 는 충돌 순간 씬 전체 자세
 * (rigValueStore 스냅샷)라 기록을 클릭하면 그 시점으로 돌아간다.
 *
 * 정지·복원 상태(pinned)를 만들 때 값 생산자를 멈추는 것은 scene-collision-hold
 * 다(가상 태그 pause + 실시간 화면 반영 보류). pinned 을 떠나는 모든 경로
 * (`resume`·`clearActive`·`clearHistory`·`clear`·`setEnabled(false)`)가
 * 실시간 보류를 풀어, 실시간 화면에서 X·재개·기록 초기화 뒤에 보류가 남지
 * 않는다. 가상 태그는 ▶ 재생이 켠다 — 검사기가 러너의 isRunning false→true
 * 전이에서 `resume()` 을 불러 재무장하고, 러너는 pause 로 경과 시간을
 * 보존하므로 재생은 멈춘 지점에서 이어진다.
 */

export interface SceneCollisionRecordParty {
  modelId: string;
  equipName: string;
  /** 모델 루트 기준 mesh-path. 루트 자체면 ''. */
  nodePath: string;
}

export interface SceneCollisionRecord {
  /** 증가 카운터 — 목록 key·선택 판정용. */
  id: number;
  pairKey: string;
  /** 충돌 시각(Date.now). */
  at: number;
  a: SceneCollisionRecordParty;
  b: SceneCollisionRecordParty;
  /** 근사 접촉점(두 메쉬 월드 AABB 교집합 중심, 씬 unit). */
  contactPoint: Vector3Tuple;
  /** 충돌 순간 씬 전체 자세 — rigValueStore.snapshot(). */
  values: ReadonlyArray<readonly [address: string, value: number]>;
}

/** pinned = 정지·복원 상태(▶ 로 해제), flash = FLASH_MS 뒤 자동 해제. */
export type SceneCollisionActiveMode = 'pinned' | 'flash';

/** 고스트 한 벌 — 어떤 GLB 를 어떤 자세로 세울지. */
export interface ScenePredictionGhost {
  modelId: string;
  /** GLB 경로. 고스트가 같은 자산을 로드해 clone 한다. */
  path: string;
  /** 구동 노드의 미래 로컬 transform. 루트는 nodePath ''. */
  nodes: readonly GhostNodePose[];
}

/**
 * 현재 예측 — "이대로 가면 leadTimeSec 뒤에 이 두 장비가 부딪힌다".
 *
 * 리드타임을 뺀 나머지는 **그 쌍을 처음 발견한 시점에 고정**한다(기록의
 * `contactPoint` 와 같은 의미론). 고스트 자세·궤적·지면 높이를 매 스윕
 * 갱신하면 clone 과 라인이 계속 다시 만들어져 처닝이 생기고, "여기서
 * 부딪힌다" 는 메시지도 흔들린다. 캡처 자체도 자세 차용을 십수 번 더 하는
 * 비싼 경로라 쌍이 바뀔 때만 돈다.
 */
export interface ScenePredictedCollision {
  pairKey: string;
  a: SceneCollisionRecordParty;
  b: SceneCollisionRecordParty;
  /** 표시 단위(PREDICTION_LEAD_QUANTUM_SEC)로 양자화된 남은 시간. */
  leadTimeSec: number;
  /** 처음 발견했을 때의 리드타임 — 카운트다운 진행 호의 분모. */
  initialLeadTimeSec: number;
  /** 미래 접촉점(씬 unit) — 발견 시점 고정. */
  contactPoint: Vector3Tuple;
  /** 부딪히는 순간의 자세. 구동 모델만 담는다(정적 장비는 지금과 같다). */
  ghosts: readonly ScenePredictionGhost[];
}

interface SceneCollisionState {
  enabled: boolean;
  /** 충돌 시 시뮬레이션을 멈출지. 끄면 기록만 남기고 박스를 잠깐 보여 준다. */
  pauseOnCollision: boolean;
  /** 최신 먼저, HISTORY_MAX 개까지. 끄고 켜도 남고 clearHistory 로만 비운다. */
  history: SceneCollisionRecord[];
  /** 빨간 박스 대상 기록. */
  activeRecordId: number | null;
  activeMode: SceneCollisionActiveMode | null;
  /**
   * 런타임이 기준선(baseline) 단계인지 — 겹친 쌍을 보고 대신 억제하며 안정화
   * 창(BASELINE_SETTLE_MS)을 기다리는 동안 true. BVH 가 아직 없는 쌍은
   * 재시도되므로 모델 로드 직후 몇 초간 유지된다. **스캔 중일 때만** true 다 —
   * 러너 정지·기즈모 드래그로 스캔이 멈추면 검사기가 false 로 내린다(phase 는
   * baseline 인 채 남고 재개 시 새 창). 검사기만 갱신하며 화면
   * (SceneWarmupIndicator)이 "충돌 감지 기준선 계산 중" 으로 보여 준다.
   */
  baselinePending: boolean;
  /**
   * 충돌 예측 on/off — 감지 하위 항목이라 `enabled` 가 false 면 의미가 없다.
   * 기본 ON, 감지·정지와 같은 세션 전용 정책.
   */
  predictionEnabled: boolean;
  /** 몇 초 앞까지 볼지. 칸 간격은 고정이므로 이 값이 칸 수를 정한다. */
  predictionHorizonSec: number;
  /** 현재 예측 — 없으면 null. 예측기 훅만 쓴다. */
  predicted: ScenePredictedCollision | null;
  toggle: () => void;
  setEnabled: (enabled: boolean) => void;
  setPauseOnCollision: (pause: boolean) => void;
  /** 검사기만 호출. 앞에 넣고 HISTORY_MAX 초과분을 버린다. */
  pushRecord: (record: SceneCollisionRecord) => void;
  /** 정지 모드 충돌·기록 클릭 — 박스를 고정한다. 없는 id 는 no-op. */
  pin: (id: number) => void;
  /** 무정지 모드 충돌 — FLASH_MS 뒤 자동으로 지운다. 새 flash 가 이전 타이머를 취소. */
  flash: (id: number) => void;
  /**
   * 기록 클릭. 그 쌍 억제 → 값 저장소를 그 시점으로 복원 → 재기준선 → 러너
   * 정지 → pin. 이미 고정된 같은 기록을 다시 클릭하면 resume 과 같다. 없는
   * id 는 no-op.
   */
  selectRecord: (id: number) => void;
  /** pinned/flash 해제(+ 외부에서 halt 된 런타임이면 재무장). 검사기가 ▶ 전이에서 부른다. */
  resume: () => void;
  /** 박스만 지운다(런타임 무변경). */
  clearActive: () => void;
  /** 기록 전부 삭제(active 도 해제). 런타임은 그대로 — 정지 중이면 ▶ 가 푼다. */
  clearHistory: () => void;
  /** 검사기 언마운트 — active 만 해제, 기록은 유지. */
  clear: () => void;
  /** 검사기만 호출 — 런타임 phase 가 baseline 을 드나들 때. */
  setBaselinePending: (pending: boolean) => void;
  setPredictionEnabled: (enabled: boolean) => void;
  /** 범위 밖 값은 클램프된다. */
  setPredictionHorizonSec: (seconds: number) => void;
  /**
   * 예측기만 호출. 같은 쌍·같은 리드타임이면 상태를 바꾸지 않는다(참조 유지)
   * — 스윕마다 set 하면 패널·독·오버레이가 10Hz 로 리렌더된다. 쌍이 그대로면
   * 박스·접촉점은 처음 값을 유지하고 리드타임만 갱신한다.
   */
  setPredicted: (predicted: ScenePredictedCollision | null) => void;
}

let flashTimer: ReturnType<typeof setTimeout> | null = null;

function cancelFlash(): void {
  if (flashTimer !== null) {
    clearTimeout(flashTimer);
    flashTimer = null;
  }
}

const INACTIVE = { activeRecordId: null, activeMode: null } as const;

export const useSceneCollisionStore = create<SceneCollisionState>()((
  set,
  get,
) => {
  /** pinned/flash 해제의 공통 경로 — 타이머 취소, 실시간 보류 해제, 박스 제거. */
  const deactivate = (): void => {
    cancelFlash();
    releaseRunners();
    // 예측도 함께 내린다 — 자세가 곧 달라지거나(재개) 화면이 정리되는
    // 순간이라 낡은 주황 박스가 틀린 위치를 가리킨다.
    if (get().predicted !== null) set({ predicted: null });
    if (get().activeRecordId !== null) set(INACTIVE);
  };

  return {
    enabled: true,
    pauseOnCollision: true,
    history: [],
    activeRecordId: null,
    activeMode: null,
    baselinePending: false,
    predictionEnabled: true,
    predictionHorizonSec: PREDICTION_HORIZON_DEFAULT_SEC,
    predicted: null,

    toggle: () => get().setEnabled(!get().enabled),

    setEnabled: (enabled) => {
      if (enabled === get().enabled) return;
      if (!enabled) {
        cancelFlash();
        releaseRunners();
      }
      set(enabled ? { enabled } : { enabled, predicted: null, ...INACTIVE });
    },

    setPauseOnCollision: (pause) => {
      if (pause === get().pauseOnCollision) return;
      set({ pauseOnCollision: pause });
    },

    pushRecord: (record) => {
      set((state) => ({
        history: [record, ...state.history].slice(0, HISTORY_MAX),
      }));
    },

    pin: (id) => {
      if (!get().history.some((r) => r.id === id)) return;
      cancelFlash();
      set({ activeRecordId: id, activeMode: 'pinned' });
    },

    flash: (id) => {
      if (!get().history.some((r) => r.id === id)) return;
      cancelFlash();
      set({ activeRecordId: id, activeMode: 'flash' });
      flashTimer = setTimeout(() => {
        flashTimer = null;
        const state = get();
        if (state.activeRecordId === id && state.activeMode === 'flash') {
          set(INACTIVE);
        }
      }, FLASH_MS);
    },

    selectRecord: (id) => {
      const state = get();
      const record = state.history.find((r) => r.id === id);
      if (!record) return;
      if (state.activeRecordId === id && state.activeMode === 'pinned') {
        state.resume();
        return;
      }
      // 복원된 자세는 그 쌍이 겹친 상태다 — 먼저 억제해야 새 충돌로 보고되지
      // 않는다. 런타임은 멈추지 않는다(다른 쌍·이후 조작은 계속 감시).
      sceneCollisionRuntime.suppress(record.pairKey);
      rigValueStore.restore(record.values);
      // 복원 자세에서 겹친 *다른* 쌍도 기준선으로 흡수한다. 시뮬레이션 러너는
      // 정지 중 스캔이 없어 무해하고 ▶ 의 재기준선이 다시 덮는다. 실시간은
      // 보류 중에도 스캔이 돌아 이것이 필요하며, 안정화 창 안에 release 하면
      // 최신 값으로 튀는 점프도 함께 흡수된다.
      sceneCollisionRuntime.rebaseline();
      holdRunners();
      // 자세가 그 시점으로 순간이동했다 — 낡은 예측 박스는 완전히 틀린 곳을
      // 가리키므로 pin 보다 먼저 내린다.
      if (get().predicted !== null) set({ predicted: null });
      state.pin(id);
    },

    resume: () => {
      // 정지돼 있던 런타임만 다시 무장한다 — 검사기가 없어(idle) 멈춘 것은 그
      // 검사기의 effect 가 마운트될 때 스스로 arm 한다.
      if (get().enabled && sceneCollisionRuntime.currentPhase === 'halted') {
        sceneCollisionRuntime.arm();
      }
      deactivate();
    },

    clearActive: () => deactivate(),

    clearHistory: () => {
      cancelFlash();
      releaseRunners();
      const state = get();
      if (state.predicted !== null) set({ predicted: null });
      if (state.history.length === 0 && state.activeRecordId === null) return;
      set({ history: [], ...INACTIVE });
    },

    clear: () => deactivate(),

    setBaselinePending: (pending) => {
      if (pending === get().baselinePending) return;
      set({ baselinePending: pending });
    },

    setPredictionEnabled: (enabled) => {
      if (enabled === get().predictionEnabled) return;
      set(
        enabled
          ? { predictionEnabled: enabled }
          : {
              predictionEnabled: enabled,
              predicted: null,
            },
      );
    },

    setPredictionHorizonSec: (seconds) => {
      const next = clampPredictionHorizonSec(seconds);
      if (next === get().predictionHorizonSec) return;
      // 지평선이 바뀌면 사다리가 다시 잡히므로 현재 예측은 근거를 잃는다.
      set({ predictionHorizonSec: next, predicted: null });
    },

    setPredicted: (predicted) => {
      const prev = get().predicted;
      if (predicted === null) {
        if (prev === null) return;
        set({ predicted: null });
        return;
      }
      if (prev && prev.pairKey === predicted.pairKey) {
        // 같은 쌍이면 박스·접촉점은 처음 값을 유지하고 리드타임만 본다.
        if (prev.leadTimeSec === predicted.leadTimeSec) return;
        set({ predicted: { ...prev, leadTimeSec: predicted.leadTimeSec } });
        return;
      }
      set({ predicted });
    },
  };
});
