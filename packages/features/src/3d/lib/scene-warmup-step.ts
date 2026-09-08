import type { BvhBuildCounts } from '@crane/domain/3d';

/**
 * 씬 로딩 뒤 후처리(워밍업) 중 화면에 보일 단계 하나를 고른다.
 *
 * 모델이 뜬 뒤에도 몇 초간 버벅이는 이유는 다운로드가 아니라 마운트 이후
 * 메인 스레드에서 도는 후처리다 — BVH 빌드(클릭 raycast 가속), 충돌 감지
 * 기준선(BVH 를 기다리며 재시도). 표시는 한 줄이라 우선순위 순으로 첫 번째
 * 활성 단계만 보인다. 전부 비활성이면 null(표시 없음).
 *
 *  1. bvh       — 전역 워밍업 큐에 미빌드 BVH 가 남아 있음(CPU 정지의 주범)
 *  2. outline   — 같은 큐의 실루엣 테두리 사본(스무딩 노멀)이 남아 있음. 큐가
 *     BVH 를 전부 먼저 처리하므로 bvh 뒤에만 보인다
 *  3. collision — 충돌 감지 런타임이 기준선 단계(BVH 완료 직후 몇 틱)
 *  4. assets    — three DefaultLoadingManager 가 활성(다운로드·파싱 중). 가장
 *     낮은 순위인 이유: 편집 화면은 카탈로그 40개를 수십 초 동안 프리로드해
 *     이 신호가 오래 켜져 있고, 그 사이 씬 자체의 준비 상태가 더 중요하다.
 *     모니터링은 불투명 로딩 오버레이가 이 단계를 덮는다.
 *
 * 타이머 추측은 쓰지 않는다 — 세 신호 모두 실제 작업 큐·런타임 상태다.
 */
export type SceneWarmupStep =
  | { kind: 'bvh'; done: number; total: number }
  | { kind: 'outline'; done: number; total: number }
  | { kind: 'collision' }
  | { kind: 'assets'; loaded: number; total: number }
  | null;

export interface SceneWarmupInput {
  bvh: BvhBuildCounts;
  outline: BvhBuildCounts;
  collisionBaselinePending: boolean;
  assetsActive: boolean;
  /** drei useProgress 의 loaded/total — LoadingManager 항목 수. */
  assetsLoaded: number;
  assetsTotal: number;
}

/** 표시용 정수 — NaN·음수·소수는 0 또는 내림으로 고정한다. */
function toCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function selectSceneWarmupStep(
  input: SceneWarmupInput,
): SceneWarmupStep {
  if (toCount(input.bvh.pending) > 0) {
    return {
      kind: 'bvh',
      done: toCount(input.bvh.done),
      total: toCount(input.bvh.total),
    };
  }
  if (toCount(input.outline.pending) > 0) {
    return {
      kind: 'outline',
      done: toCount(input.outline.done),
      total: toCount(input.outline.total),
    };
  }
  if (input.collisionBaselinePending) return { kind: 'collision' };
  if (input.assetsActive) {
    return {
      kind: 'assets',
      loaded: toCount(input.assetsLoaded),
      total: toCount(input.assetsTotal),
    };
  }
  return null;
}
