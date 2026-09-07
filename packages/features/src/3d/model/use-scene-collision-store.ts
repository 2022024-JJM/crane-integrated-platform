import { create } from 'zustand';
import type { Vector3Tuple } from '@crane/core/types/math';
import { FLASH_MS, HISTORY_MAX } from '../lib/scene-collision-pairs';
import { rigValueStore } from './rig-value-store';
import { sceneCollisionRuntime } from './scene-collision-runtime';
import { useVirtualTagStore } from './use-virtual-tag-store';

/**
 * 씬 객체 충돌 감지의 React 상태 — 세션 전용(씬 데이터·localStorage 아님).
 * `enabled`·`pauseOnCollision` 은 모니터링(simulation)·에디터가 공유한다.
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
 * 정지·복원 상태(pinned)를 푸는 것은 ▶ 재생이다 — 검사기가 러너의
 * isRunning false→true 전이에서 `resume()` 을 불러 재무장한다. 러너는
 * pause 로 경과 시간을 보존하므로 재생은 멈춘 지점에서 이어진다.
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

interface SceneCollisionState {
  enabled: boolean;
  /** 충돌 시 시뮬레이션을 멈출지. 끄면 기록만 남기고 박스를 잠깐 보여 준다. */
  pauseOnCollision: boolean;
  /** 최신 먼저, HISTORY_MAX 개까지. 끄고 켜도 남고 clearHistory 로만 비운다. */
  history: SceneCollisionRecord[];
  /** 빨간 박스 대상 기록. */
  activeRecordId: number | null;
  activeMode: SceneCollisionActiveMode | null;
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
   * 기록 클릭. 런타임 정지 → 값 저장소를 그 시점으로 복원 → 러너 정지 → pin.
   * 이미 고정된 같은 기록을 다시 클릭하면 resume 과 같다. 없는 id 는 no-op.
   */
  selectRecord: (id: number) => void;
  /** pinned/flash 해제 + 정지돼 있던 런타임 재무장. 검사기가 ▶ 전이에서 부른다. */
  resume: () => void;
  /** 박스만 지운다(런타임 무변경). */
  clearActive: () => void;
  /** 기록 전부 삭제(active 도 해제). 런타임은 그대로 — 정지 중이면 ▶ 가 푼다. */
  clearHistory: () => void;
  /** 검사기 언마운트 — active 만 해제, 기록은 유지. */
  clear: () => void;
}

let flashTimer: ReturnType<typeof setTimeout> | null = null;

function cancelFlash(): void {
  if (flashTimer !== null) {
    clearTimeout(flashTimer);
    flashTimer = null;
  }
}

const INACTIVE = { activeRecordId: null, activeMode: null } as const;

export const useSceneCollisionStore = create<SceneCollisionState>()(
  (set, get) => ({
    enabled: false,
    pauseOnCollision: true,
    history: [],
    activeRecordId: null,
    activeMode: null,

    toggle: () => get().setEnabled(!get().enabled),

    setEnabled: (enabled) => {
      if (enabled === get().enabled) return;
      if (!enabled) cancelFlash();
      set(enabled ? { enabled } : { enabled, ...INACTIVE });
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
      // 순서: 런타임을 먼저 멈춰야 복원된(겹친) 자세가 새 충돌로 보고되지 않는다.
      sceneCollisionRuntime.halt();
      rigValueStore.restore(record.values);
      useVirtualTagStore.getState().pause();
      state.pin(id);
    },

    resume: () => {
      cancelFlash();
      // 정지돼 있던 런타임만 다시 무장한다 — 검사기가 없어(idle) 멈춘 것은 그
      // 검사기의 effect 가 마운트될 때 스스로 arm 한다.
      if (get().enabled && sceneCollisionRuntime.currentPhase === 'halted') {
        sceneCollisionRuntime.arm();
      }
      if (get().activeRecordId !== null) set(INACTIVE);
    },

    clearActive: () => {
      cancelFlash();
      if (get().activeRecordId !== null) set(INACTIVE);
    },

    clearHistory: () => {
      cancelFlash();
      const state = get();
      if (state.history.length === 0 && state.activeRecordId === null) return;
      set({ history: [], ...INACTIVE });
    },

    clear: () => {
      cancelFlash();
      if (get().activeRecordId !== null) set(INACTIVE);
    },
  }),
);
