/**
 * 화면 밖 근접 쌍 안내 — 쌍의 가운데를 화면에 투영해 뷰포트 밖이면 화면
 * 가장자리(여백 안)에 화살표를 둔다. 24시간 관제에서 카메라가 다른 곳을
 * 보고 있어도 위험이 어느 쪽에 생겼는지 바로 보이게 한다. 순수 계산만 —
 * DOM 쓰기는 ui/scene-offscreen-indicators.tsx.
 */

/** 가장자리 여백(px) — 화살표·라벨이 잘리지 않게. */
export const OFFSCREEN_EDGE_MARGIN_PX = 28;
/** 위쪽 여백(px) — 상단 HUD 와 좌상단 방위 표시 아래로. */
export const OFFSCREEN_TOP_MARGIN_PX = 128;
/** 겹친 화살표 밀어내기 주기(ms). */
export const OFFSCREEN_STACK_INTERVAL_MS = 250;

export type EdgeSide = 'left' | 'right' | 'top' | 'bottom';

export interface EdgeIndicator {
  x: number;
  y: number;
  /** 화살표가 가리킬 방향(도, 0 = 오른쪽, 시계 방향 = 화면 좌표계). */
  angleDeg: number;
  /** 화면 밖이라 표시해야 하는지. */
  offscreen: boolean;
  /** 닿은 가장자리 — 상자가 안쪽으로 놓이도록 anchor 를 정한다. */
  side: EdgeSide;
}

/** 가장자리별 CSS transform — 상자가 점에서 화면 안쪽으로 펼쳐진다. */
export const EDGE_TRANSFORM: Record<EdgeSide, string> = {
  left: 'translate(0, -50%)',
  right: 'translate(-100%, -50%)',
  top: 'translate(-50%, 0)',
  bottom: 'translate(-50%, -100%)',
};

/**
 * 투영점(뷰포트 CSS px, 왼쪽 위 원점) → 가장자리 표시. 카메라 뒤
 * (`behind`)면 투영이 뒤집히므로 중심 대칭으로 되돌린 뒤 판정한다. 화면 안이면
 * `offscreen: false` 에 좌표는 그대로.
 */
export function resolveEdgeIndicator(
  x: number,
  y: number,
  width: number,
  height: number,
  behind: boolean,
  margin: number = OFFSCREEN_EDGE_MARGIN_PX,
  topMargin: number = OFFSCREEN_TOP_MARGIN_PX,
): EdgeIndicator {
  // 위쪽 여백이 다르므로 "여백 안 사각형" 의 중심은 화면 중심보다 아래다.
  const cx = width / 2;
  const cy = (topMargin + (height - margin)) / 2;
  let px = x;
  let py = y;
  if (behind) {
    px = cx - (x - cx);
    py = cy - (y - cy);
  }
  const inside =
    !behind &&
    px >= margin &&
    px <= width - margin &&
    py >= topMargin &&
    py <= height - margin;
  if (inside || !Number.isFinite(px) || !Number.isFinite(py)) {
    return { x: px, y: py, angleDeg: 0, offscreen: false, side: 'left' };
  }
  const dx = px - cx;
  let dy = py - cy;
  if (dx === 0 && dy === 0) dy = -1;
  const halfW = Math.max(1, cx - margin);
  const halfH = Math.max(1, cy - topMargin);
  // 중심에서 방향 (dx,dy) 로 나가 여백 안 사각형과 만나는 점.
  const t = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
  const horizontal = Math.abs(dx) / halfW >= Math.abs(dy) / halfH;
  const side: EdgeSide = horizontal
    ? dx < 0
      ? 'left'
      : 'right'
    : dy < 0
      ? 'top'
      : 'bottom';
  return {
    x: cx + dx * t,
    y: cy + dy * t,
    angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
    offscreen: true,
    side,
  };
}
