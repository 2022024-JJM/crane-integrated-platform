import type { EquipmentOutlineState } from '@crane/core/types/status';
import { STATUS_OUTLINE_COLORS } from '@crane/domain/3d';

/**
 * 장비 작업 반경 링(관제 모드) — 장비 밑 지면에 수평 범위를 반투명 링으로.
 * 타워크레인은 지브 선회 반경, 갠트리는 거더 반길이가 곧 링 반지름이라
 * 링이 겹치는 자리가 충돌 가능 영역으로 읽힌다. 탑뷰에서 가는 선으로만
 * 보이던 크레인이 원으로 보인다.
 */

/** 링의 두께 — 반지름 대비 비율. 너무 가늘면 멀리서 사라진다. */
export const FOOTPRINT_RING_WIDTH_RATIO = 0.06;
/** 지면 위 띄우는 높이(씬 unit) — 바닥과 겹쳐 깜빡이지 않게. */
export const FOOTPRINT_Y_OFFSET = 0.15;
/** 반지름 하한·상한(씬 unit) — 점·거대 링 방지. */
export const FOOTPRINT_RADIUS_MIN = 2;
export const FOOTPRINT_RADIUS_MAX = 400;
export const FOOTPRINT_OPACITY = 0.28;
/** 평상시 링 색 — 장비 윤곽과 같은 회백색. 상태가 있으면 그 색. */
export const FOOTPRINT_DEFAULT_COLOR = '#d7dbe2';

/**
 * 위험 쌍의 링 맥동 — 주변 시야에서도 잡히게 불투명도를 주기로 흔든다.
 * 주기는 1 초 남짓(경보등 느낌), 바닥은 평상 링보다 진하다.
 */
export const FOOTPRINT_PULSE_PERIOD_MS = 1100;
export const FOOTPRINT_PULSE_MIN = 0.35;
export const FOOTPRINT_PULSE_MAX = 0.95;

/** 시각(ms) → 맥동 불투명도 [MIN, MAX]. 비유한 시각은 MAX. */
export function footprintPulseOpacity(nowMs: number): number {
  if (!Number.isFinite(nowMs)) return FOOTPRINT_PULSE_MAX;
  const phase = (nowMs % FOOTPRINT_PULSE_PERIOD_MS) / FOOTPRINT_PULSE_PERIOD_MS;
  const wave = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
  return (
    FOOTPRINT_PULSE_MIN + (FOOTPRINT_PULSE_MAX - FOOTPRINT_PULSE_MIN) * wave
  );
}

/** 월드 AABB 의 수평 반범위에서 반지름 — 긴 축 기준, 범위로 클램프. */
export function footprintRadius(halfX: number, halfZ: number): number {
  const r = Math.max(Math.abs(halfX), Math.abs(halfZ));
  if (!Number.isFinite(r)) return FOOTPRINT_RADIUS_MIN;
  return Math.min(FOOTPRINT_RADIUS_MAX, Math.max(FOOTPRINT_RADIUS_MIN, r));
}

export function footprintColor(
  state: EquipmentOutlineState | undefined,
): string {
  if (!state || state === 'none' || state === 'contour') {
    return FOOTPRINT_DEFAULT_COLOR;
  }
  return STATUS_OUTLINE_COLORS[state];
}
