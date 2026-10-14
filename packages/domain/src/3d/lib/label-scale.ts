/**
 * 화면을 향한 DOM 표시(모델 라벨·눈금의 점과 숫자)의 카메라 거리 규칙.
 * 두 표시가 같은 함수를 써서 멀어질 때 같은 비율로 줄고 같은 거리에서
 * 사라진다.
 */

/**
 * 이 거리(world units, 카메라 ↔ 표시 위치)를 넘으면 DOM 을 숨긴다.
 * drei <Html>은 매 프레임 화면 좌표 project + transform 계산을 수행하므로,
 * 멀리 있어 작아 보이는 것까지 그리면 100+ 모델 씬에서 hot path가 된다.
 */
export const LABEL_VISIBILITY_DISTANCE = 1000;

/**
 * 거리 기반 축소. 카메라가 REF보다 가까우면 원래 크기(1x), 멀어질수록
 * REF/dist 비율로 줄어들되 MIN 밑으로는 내려가지 않는다. 순수 원근 스케일
 * (distanceFactor)과 달리 근접 시 과도하게 커지지 않고, 원거리에서도 최소
 * 가독 크기를 유지한다.
 */
export const LABEL_SCALE_REF_DISTANCE = 300;
export const LABEL_MIN_SCALE = 0.45;

/** 축소 배율의 눈금 — 이 단위로 끊어 매 프레임 style 재작성을 막는다. */
const LABEL_SCALE_STEPS = 50;

export function isLabelInRange(distance: number): boolean {
  return distance <= LABEL_VISIBILITY_DISTANCE;
}

/** 카메라 거리 → 표시 배율 [LABEL_MIN_SCALE, 1]. 거리를 모르면 1. */
export function labelScaleAtDistance(distance: number): number {
  if (!Number.isFinite(distance) || distance <= 0) return 1;
  const raw = Math.min(1, LABEL_SCALE_REF_DISTANCE / distance);
  return Math.max(
    LABEL_MIN_SCALE,
    Math.round(raw * LABEL_SCALE_STEPS) / LABEL_SCALE_STEPS,
  );
}
