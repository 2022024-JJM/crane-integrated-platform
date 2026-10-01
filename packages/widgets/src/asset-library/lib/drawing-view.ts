/**
 * 도면 뷰어의 확대·이동 계산. 화면 좌표계는 뷰포트 좌상단 원점이고, 도면은
 * `translate(x, y) scale(scale)`(transform-origin 0 0)으로 놓인다.
 */

export interface DrawingView {
  x: number;
  y: number;
  scale: number;
}

export interface Size {
  width: number;
  height: number;
}

export const DRAWING_SCALE_MIN = 0.05;
export const DRAWING_SCALE_MAX = 16;

export function clampDrawingScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(DRAWING_SCALE_MAX, Math.max(DRAWING_SCALE_MIN, scale));
}

/** 도면 전체가 여백을 두고 뷰포트 가운데에 들어오는 배치. */
export function fitDrawingView(
  viewport: Size,
  content: Size,
  padding = 24,
): DrawingView {
  if (!(content.width > 0) || !(content.height > 0)) {
    return { x: 0, y: 0, scale: 1 };
  }
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const scale = clampDrawingScale(
    Math.min(availableWidth / content.width, availableHeight / content.height),
  );
  return {
    x: (viewport.width - content.width * scale) / 2,
    y: (viewport.height - content.height * scale) / 2,
    scale,
  };
}

/**
 * 한 점을 고정한 채 확대·축소한다 — 커서 아래의 도면 위치가 움직이지 않는다.
 * 배율이 한계에 닿아 바뀌지 않으면 입력을 그대로 돌려준다.
 */
export function zoomDrawingAt(
  view: DrawingView,
  factor: number,
  point: { x: number; y: number },
): DrawingView {
  const scale = clampDrawingScale(view.scale * factor);
  if (scale === view.scale) return view;
  const ratio = scale / view.scale;
  return {
    x: point.x - (point.x - view.x) * ratio,
    y: point.y - (point.y - view.y) * ratio,
    scale,
  };
}

/** 실제 크기(100%)로, 뷰포트 가운데 기준. */
export function actualSizeDrawingView(
  viewport: Size,
  content: Size,
): DrawingView {
  return {
    x: (viewport.width - content.width) / 2,
    y: (viewport.height - content.height) / 2,
    scale: 1,
  };
}
