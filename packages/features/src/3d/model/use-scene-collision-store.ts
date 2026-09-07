import { create } from 'zustand';
import type { Object3D } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import { sceneCollisionRuntime } from './scene-collision-runtime';
import { virtualTagRuntime } from './virtual-tag-runner';

/**
 * 씬 객체 충돌 감지 옵션의 React 상태 — 세션 전용(씬 데이터·localStorage 아님).
 * `enabled` 는 모니터링(simulation)·에디터가 공유하는 전역 토글이다.
 *
 * 프레임 루프(scene-collision-runtime)는 여기에 쓰지 않는다. 검사기 훅이
 * 충돌을 받았을 때 `reportCollision` 으로 한 번 쓰고, 이후 사용자 조작
 * (닫기·초기화)이 런타임을 다시 무장시킨다. 재생 재개는 하지 않는다 —
 * 사용자가 ▶ 를 누른다.
 *
 * `report` 는 Object3D 참조(충돌 메쉬)를 들고 있다 — 하이라이트 박스가
 * 그 노드에 포털로 붙는다. 직렬화 대상이 아니며, 모델이 리마운트되면
 * 박스는 사라진다(닫기로 해소).
 */

export interface SceneCollisionTagValue {
  tagKey: string;
  /** 충돌 순간 버스의 마지막 값. 아직 한 번도 안 왔으면 null. */
  value: number | null;
}

export interface SceneCollisionNodeRef {
  modelId: string;
  equipName: string;
  /** 모델 루트 기준 mesh-path. 루트 자체면 ''. */
  nodePath: string;
  node: Object3D;
  /** 이 모델의 tagMappings 가 참조하는 태그와 충돌 순간 값. */
  tags: SceneCollisionTagValue[];
  /** 충돌 순간 드라이버가 적용한 관절값(리그가 있을 때). */
  jointValues: Array<{ jointId: string; value: number }>;
}

export interface SceneCollisionReport {
  /** 증가 카운터 — 하이라이트 key·리렌더 판정용. */
  id: number;
  pairKey: string;
  a: SceneCollisionNodeRef;
  b: SceneCollisionNodeRef;
  /** 근사 접촉점(두 메쉬 월드 AABB 교집합 중심, 씬 unit). */
  contactPoint: Vector3Tuple;
  detectedAt: number;
}

export type SceneCollisionPhase = 'off' | 'scanning' | 'collided';

interface SceneCollisionState {
  enabled: boolean;
  phase: SceneCollisionPhase;
  report: SceneCollisionReport | null;
  toggle: () => void;
  setEnabled: (enabled: boolean) => void;
  /** 검사기(useFrame)만 호출. 꺼져 있거나 이미 collided 면 no-op(참조 유지). */
  reportCollision: (report: SceneCollisionReport) => void;
  /** 닫기 — 이 쌍은 분리될 때까지 억제하고 감시를 다시 시작한다. */
  dismiss: () => void;
  /** 초기화 — 가상 태그를 초기값으로 되돌린 뒤 닫기와 같다. */
  resetAndRearm: () => void;
  /** 검사기 언마운트/비활성. enabled 는 유지하고 report 만 비운다. */
  clear: () => void;
}

export const useSceneCollisionStore = create<SceneCollisionState>()(
  (set, get) => ({
    enabled: false,
    phase: 'off',
    report: null,

    toggle: () => get().setEnabled(!get().enabled),

    setEnabled: (enabled) => {
      if (enabled === get().enabled) return;
      set(
        enabled
          ? { enabled, phase: 'scanning' }
          : { enabled, phase: 'off', report: null },
      );
    },

    reportCollision: (report) => {
      const state = get();
      if (!state.enabled || state.phase === 'collided') return;
      set({ phase: 'collided', report });
    },

    dismiss: () => {
      const state = get();
      if (state.phase !== 'collided' || !state.report) return;
      sceneCollisionRuntime.suppress(state.report.pairKey);
      sceneCollisionRuntime.arm();
      set({ phase: 'scanning', report: null });
    },

    resetAndRearm: () => {
      if (get().phase !== 'collided') return;
      virtualTagRuntime.resetValues();
      get().dismiss();
    },

    clear: () => {
      const state = get();
      if (state.report === null && state.phase !== 'collided') return;
      set({ report: null, phase: state.enabled ? 'scanning' : 'off' });
    },
  }),
);
