import type { IUniform } from 'three';

/**
 * 평면도(직교 탑뷰) 셰이더 유니폼 — 평면도 톤 패치(plan-view-patch.ts)를 건
 * 모든 머티리얼이 **같은 유니폼 객체**를 참조한다. 값만 바꾸면 다음 렌더에
 * 전부가 새 값을 본다(sea-reach-uniforms.ts 와 같은 구조).
 *
 * 앱 전역 하나다 — 공유 머티리얼(shared-material-cache)이 캔버스를 가리지
 * 않으므로 캔버스별 값을 둘 수 없다. 대신 `SceneLighting` 이 **자기 렌더
 * 직전 useFrame 에서** 자기 카메라 기준으로 매 프레임 쓴다. 캔버스마다
 * 프레임 루프가 따로라 각자의 렌더는 각자가 쓴 값을 본다.
 *
 *  - `uPlanView` 0(원근)‥1(직교 탑뷰). 바닥 톤·장비 평면 색의 세기.
 *  - `uPlanNight` 0(낮)‥1(밤). 평면도일 때 바닥을 한 단계 더 어둡게 — 투광등
 *    점등 비율(sceneLightingInfo.floodlightOn)을 그대로 쓴다.
 */
export interface PlanViewUniforms {
  uPlanView: IUniform<number>;
  uPlanNight: IUniform<number>;
}

export const planViewUniforms: PlanViewUniforms = {
  uPlanView: { value: 0 },
  uPlanNight: { value: 0 },
};

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * 평면도 유니폼 기록. 비유한 값은 0. 같은 값이면 쓰지 않는다.
 *
 * @returns 바뀌었는지.
 */
export function publishPlanView(planView: number, night: number): boolean {
  const nextPlan = clamp01(planView);
  const nextNight = clamp01(night);
  let changed = false;
  if (planViewUniforms.uPlanView.value !== nextPlan) {
    planViewUniforms.uPlanView.value = nextPlan;
    changed = true;
  }
  if (planViewUniforms.uPlanNight.value !== nextNight) {
    planViewUniforms.uPlanNight.value = nextNight;
    changed = true;
  }
  return changed;
}
