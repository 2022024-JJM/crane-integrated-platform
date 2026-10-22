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

/**
 * 정착 스냅 임계 — 잔차와 속도가 함께 이 아래면 target 에 고정하고 속도를 0 으로.
 * 지수 수렴은 수학적으로 영원히 target 에 닿지 않아(실측 고정점 ~1e-14, 어떤
 * 목표값·스무딩 시간에서도 `value === target` 이 되지 않는다) 값 저장소의
 * `hasPendingSmoothing` 이 끝나지 않고, 거버너 틱이 꺼진 뒤에도 드라이버가
 * 프레임마다 다음 프레임을 요청해 유휴 화면이 주사율로 그려진다. 단위는
 * m·deg·배율 공통 — 0.1mm·0.0001° 는 어떤 카메라 거리에서도 픽셀에 나타나지
 * 않는다. 연속 램프 추종은 잔차가 속도 × smoothTime 만큼 커서 스냅이 끼지 않는다.
 */
export const SMOOTH_SETTLE_EPS = 1e-4;

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

  // 오버슈트가 목표를 지나치면 목표에 고정(진동 방지). 잔차·속도가 임계 아래면
  // 정착으로 보고 고정 — 그래야 소비자가 "끝났다" 를 안다.
  if (
    change < 0 === state.value > target ||
    (Math.abs(state.value - target) < SMOOTH_SETTLE_EPS &&
      Math.abs(state.velocity) < SMOOTH_SETTLE_EPS)
  ) {
    state.value = target;
    state.velocity = 0;
  }
  return state.value;
}
