/** 3D 뷰 탭의 오른쪽 구역 패널 폭 + 그리드 간격(px) — 캔버스 폭 = 그리드 폭 − 이것 */
export const VIEWER_SIDE_PANEL_PX = 380 + 16;
/**
 * 캔버스 가로/세로 최소 비율. 크레인은 옆으로 긴 모델이라 캔버스가 이보다 세로로
 * 길면 위아래가 검은 바닥으로 비어 보인다 — 그만큼은 높이를 줄인다.
 */
export const VIEWER_MIN_ASPECT = 1.5;

/** 사용할 캔버스 높이 — 화면에 남는 높이와 "비율 상한" 중 작은 쪽. */
export function clampViewerHeight(
  fillHeight: number | undefined,
  gridWidth: number | undefined,
): number | undefined {
  if (!fillHeight) return undefined;
  if (!gridWidth || gridWidth <= VIEWER_SIDE_PANEL_PX) return fillHeight;
  const canvasWidth = gridWidth - VIEWER_SIDE_PANEL_PX;
  return Math.min(fillHeight, Math.floor(canvasWidth / VIEWER_MIN_ASPECT));
}
