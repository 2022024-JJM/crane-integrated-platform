import type { SplitLayout } from '@crane/domain/3d';

/**
 * 분할 화면의 타일 사각형 — 캔버스(CSS px, 왼쪽 위 원점) 기준. DOM 타일
 * 오버레이와 GL viewport·scissor 가 **같은 함수**의 값을 써야 라벨·테두리가
 * 그림과 어긋나지 않는다. GL 은 왼쪽 아래 원점이라 `toGlViewport` 로 뒤집는다.
 */
export interface SplitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 타일 사이 간격(CSS px). 비운 자리는 캔버스 clear 색이 보인다. */
export const SPLIT_GAP_PX = 2;

/**
 * 격자 index → 정수 경계. 축 길이 `total` 을 `count` 칸으로 나누되 칸 사이에
 * `gap` 을 둔다. 경계를 반올림해 칸끼리 겹치거나 빈 픽셀이 생기지 않게
 * 하고, 음수 크기는 0 으로 막는다(캔버스가 아주 작을 때).
 */
function axisSpans(
  total: number,
  count: number,
  gap: number,
): Array<{ start: number; size: number }> {
  const spans: Array<{ start: number; size: number }> = [];
  if (count <= 0) return spans;
  const stride = (total + gap) / count;
  for (let i = 0; i < count; i += 1) {
    const start = Math.round(i * stride);
    const end = Math.round((i + 1) * stride) - gap;
    spans.push({ start, size: Math.max(0, end - start) });
  }
  return spans;
}

/**
 * 배치의 타일마다 사각형을 돌려준다(`layout.tiles` 와 같은 순서). 폭·높이가
 * 유한하지 않거나 0 이하면 전부 0 크기다.
 */
export function computeSplitRects(
  layout: SplitLayout,
  width: number,
  height: number,
  gap: number = SPLIT_GAP_PX,
): SplitRect[] {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 0;
  const cols = axisSpans(safeWidth, layout.cols, gap);
  const rows = axisSpans(safeHeight, layout.rows, gap);
  return layout.tiles.map((tile) => {
    const col = cols[tile.col] ?? { start: 0, size: 0 };
    const row = rows[tile.row] ?? { start: 0, size: 0 };
    return { x: col.start, y: row.start, width: col.size, height: row.size };
  });
}

/** 왼쪽 위 원점 사각형 → GL viewport/scissor(왼쪽 아래 원점, CSS px). */
export function toGlViewport(rect: SplitRect, canvasHeight: number): SplitRect {
  return {
    x: rect.x,
    y: canvasHeight - rect.y - rect.height,
    width: rect.width,
    height: rect.height,
  };
}
