import type { CameraPose } from './viewer-camera-sync';

/**
 * 자산 뷰어의 시계·반시계 회전 버튼 — 대상을 지나는 수직축(+Y) 둘레로
 * 카메라를 한 걸음 돌린다. 물체가 아니라 카메라를 돌리므로 치수·격자·다른
 * 뷰어와의 카메라 맞물림이 그대로다. three 없이 튜플만 쓰는 순수 함수다.
 */

/** 버튼 한 번에 도는 각도. */
export const VIEWER_ORBIT_STEP_DEG = 45;

/**
 * 물체가 도는 것처럼 보이는 방향 — **위에서 내려다보았을 때** 기준이며
 * 버튼 아이콘의 화살표 방향과 같다.
 */
export type OrbitDirection = 'ccw' | 'cw';

/**
 * 물체가 위에서 보아 `direction` 방향으로 돈 것처럼 보이도록 카메라를 돌린
 * 자세. 카메라-대상 거리와 높이(Y)는 그대로이고 대상은 움직이지 않는다.
 * 카메라가 대상과 겹쳐 있으면 돌릴 것이 없어 그대로 돌려준다.
 */
export function orbitCameraPose(
  pose: CameraPose,
  direction: OrbitDirection,
  degrees = VIEWER_ORBIT_STEP_DEG,
): CameraPose {
  // 물체가 반시계로 도는 것처럼 보이려면 카메라는 반대인 시계 방향(수직축
  // 둘레 음의 각)으로 돌아야 한다.
  const sign = direction === 'ccw' ? -1 : 1;
  const angle = (sign * degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const [tx, ty, tz] = pose.target;
  const dx = pose.position[0] - tx;
  const dy = pose.position[1] - ty;
  const dz = pose.position[2] - tz;
  return {
    position: [tx + dx * cos + dz * sin, ty + dy, tz - dx * sin + dz * cos],
    target: [tx, ty, tz],
  };
}
