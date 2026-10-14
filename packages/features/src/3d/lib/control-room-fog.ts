/**
 * 관제 모드 거리 안개의 near/far — 카메라 높이에 따라 민다. 고정값이면 망원
 * 탑뷰(수 km 위)에서 야드 전체가 안개색 한 장이 된다. 높이를 더하면 지면까지
 * 거리가 near 안에 들어와 평면에서는 안개가 없고, 낮은 시점에선 원래대로
 * 먼 도시만 녹는다.
 */
export const CONTROL_ROOM_FOG_NEAR = 700;
export const CONTROL_ROOM_FOG_FAR = 2600;

export function controlRoomFogRange(cameraY: number): {
  near: number;
  far: number;
} {
  const lift = Number.isFinite(cameraY) ? Math.max(0, cameraY) : 0;
  return {
    near: CONTROL_ROOM_FOG_NEAR + lift,
    far: CONTROL_ROOM_FOG_FAR + lift,
  };
}
