/**
 * 줌 컨트롤의 수치 계산. `ui/*.tsx` 안에서 계산하지 않는다는 규약에 따라
 * 클램프·정규화·포인터 환산을 여기로 뺀다.
 */

/** 버튼 한 번에 움직이는 줌 폭. 구글맵 기본 컨트롤과 같은 1단계. */
export const ZOOM_STEP = 1;

/** 슬라이더를 키보드로 움직일 때의 폭. 버튼보다 잘게 잡는다. */
export const ZOOM_KEY_STEP = 0.5;

export function clampZoom(zoom: number, min: number, max: number): number {
  if (!Number.isFinite(zoom)) return min;
  return Math.min(max, Math.max(min, zoom));
}

/**
 * 줌을 트랙 위 0~1 위치로 정규화한다. min === max 인 퇴화 구간에서는
 * 0으로 떨어뜨려 NaN 이 스타일 문자열로 새는 것을 막는다.
 */
export function zoomRatio(zoom: number, min: number, max: number): number {
  if (!Number.isFinite(zoom) || max <= min) return 0;
  return clampZoom((zoom - min) / (max - min), 0, 1);
}

/** 트랙 위 0~1 위치를 줌 값으로 되돌린다. */
export function ratioToZoom(ratio: number, min: number, max: number): number {
  if (!Number.isFinite(ratio)) return min;
  return clampZoom(min + clampZoom(ratio, 0, 1) * (max - min), min, max);
}

/**
 * 세로 트랙 위 포인터 y좌표 → 0~1 위치.
 * 트랙은 아래가 축소, 위가 확대라 y축을 뒤집는다.
 */
export function pointerRatio(clientY: number, top: number, height: number) {
  if (height <= 0) return 0;
  return clampZoom(1 - (clientY - top) / height, 0, 1);
}
