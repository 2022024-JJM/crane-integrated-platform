/**
 * 임계감쇠 스프링(SmoothDamp, Unity 식). 서버·리플레이 값이 프레임 사이에서
 * 튀지 않게 목표값을 부드럽게 추종한다. smoothTime 은 "대략 정착까지 걸리는 초".
 *
 * 클래스 대신 상태 객체 + 순수 함수로 두어 값 저장소가 채널마다 인스턴스를
 * 만들지 않아도 되게 했다.
 */
export interface SmoothDampState {
  value: number;
  velocity: number;
}

export function smoothDampStep(
  state: SmoothDampState,
  target: number,
  smoothTime: number,
  dt: number,
): number {
  if (
    !Number.isFinite(target) ||
    !Number.isFinite(state.value) ||
    smoothTime <= 0 ||
    dt <= 0
  ) {
    state.value = Number.isFinite(target) ? target : 0;
    state.velocity = 0;
    return state.value;
  }

  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = state.value - target;
  const temp = (state.velocity + omega * change) * dt;

  state.velocity = (state.velocity - omega * temp) * exp;
  state.value = target + (change + temp) * exp;

  // 오버슈트가 목표를 지나치면 목표에 고정(진동 방지).
  if (change < 0 === state.value > target) {
    state.value = target;
    state.velocity = 0;
  }
  return state.value;
}
