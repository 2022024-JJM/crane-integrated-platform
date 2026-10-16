import type { Material } from 'three';
import { planViewUniforms } from './plan-view-uniforms';
import {
  clearShaderPatch,
  hasShaderPatch,
  setShaderPatch,
  type ShaderPatchTarget,
} from './shader-patch';

/**
 * 평면도(직교 탑뷰) 톤 패치 — 관제 평면도의 색 위계를 셰이더에서 만든다.
 * `uPlanView` 가 0 인 원근에서는 수식이 원래 값으로 떨어져 아무 변화가 없고,
 * 탑뷰 진입·복귀는 유니폼 값만 바뀌므로 재컴파일이 없다.
 *
 * 두 종류다.
 *  - 'ground' (지도): 채도를 낮추고 어둡게 — 콘크리트 균열·흰 선 텍스처가
 *    장비와 경쟁하지 않게 바닥을 조용히 만든다. 배율은 낮·밤 공통 하나다 —
 *    밤 밝기는 다른 화면과 같은 밤 조명이 정하고 평면도만 더 어둡게 하지
 *    않는다. 주입 지점은 `<color_fragment>` 뒤(diffuseColor 확정 직후,
 *    조명 전)라 Lambert·Standard 모두 같은 자리다.
 *  - 'equipment' (장비): 조명 결과를 알베도 기반 평면 색으로 대부분 대체 —
 *    낮이든 밤이든 크레인이 같은 주황으로 보인다. 24시간 교대 근무자가 보는
 *    색 체계가 시각에 따라 바뀌지 않게 하려는 것. 약한 음영은 남겨 겹침이
 *    읽힌다. 주입 지점은 `<opaque_fragment>` 앞(outgoingLight 확정 뒤,
 *    톤매핑 전).
 *
 * 패치는 shader-patch.ts 로 합성된다 — 잠김 안개(sea-submersion.ts)와 같은
 * 머티리얼에 함께 걸린다.
 */
export type PlanViewKind = 'ground' | 'equipment';

/** 바닥의 채도 유지 비율(0 = 완전 무채색). */
export const PLAN_GROUND_SATURATION = 0.35;
/** 바닥 밝기 배율(낮·밤 공통). */
export const PLAN_GROUND_BRIGHTNESS = 0.62;
/** 장비 색에서 평면 색이 차지하는 비율(나머지는 조명 결과 = 약한 음영). */
export const PLAN_EQUIPMENT_FLAT_MIX = 0.8;
/** 장비 평면 색의 알베도 배율 — 조명 받은 밝기와 비슷하게 맞춘 값. */
export const PLAN_EQUIPMENT_FLAT_GAIN = 1.15;

const KEY_PREFIX = 'plan-view-';

const glslFloat = (v: number) => v.toFixed(4);

const FRAGMENT_DECLARE = /* glsl */ `#include <common>
uniform float uPlanView;`;

const GROUND_INJECT = /* glsl */ `#include <color_fragment>
{
  vec3 planGray = vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));
  vec3 planTone = mix(planGray, diffuseColor.rgb, ${glslFloat(PLAN_GROUND_SATURATION)});
  diffuseColor.rgb = mix(diffuseColor.rgb, planTone * ${glslFloat(PLAN_GROUND_BRIGHTNESS)}, uPlanView);
}
`;

const EQUIPMENT_INJECT = /* glsl */ `{
  vec3 planFlat = diffuseColor.rgb * ${glslFloat(PLAN_EQUIPMENT_FLAT_GAIN)};
  outgoingLight = mix(outgoingLight, planFlat, uPlanView * ${glslFloat(PLAN_EQUIPMENT_FLAT_MIX)});
}
#include <opaque_fragment>`;

function groundPatch(shader: ShaderPatchTarget): void {
  shader.uniforms.uPlanView = planViewUniforms.uPlanView;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', FRAGMENT_DECLARE)
    .replace('#include <color_fragment>', GROUND_INJECT);
}

function equipmentPatch(shader: ShaderPatchTarget): void {
  shader.uniforms.uPlanView = planViewUniforms.uPlanView;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', FRAGMENT_DECLARE)
    .replace('#include <opaque_fragment>', EQUIPMENT_INJECT);
}

export function planViewPatchKey(kind: PlanViewKind): string {
  return `${KEY_PREFIX}${kind}`;
}

/** 종류의 패치를 건다. 다른 종류가 걸려 있었으면 바꿔 끼운다. 멱등. */
export function applyPlanViewPatch(material: Material, kind: PlanViewKind): void {
  const other: PlanViewKind = kind === 'ground' ? 'equipment' : 'ground';
  clearShaderPatch(material, planViewPatchKey(other));
  if (hasShaderPatch(material, planViewPatchKey(kind))) return;
  setShaderPatch(
    material,
    planViewPatchKey(kind),
    kind === 'ground' ? groundPatch : equipmentPatch,
  );
}

/** 평면도 패치 해제(어느 종류든). 없으면 no-op. */
export function clearPlanViewPatch(material: Material): void {
  clearShaderPatch(material, planViewPatchKey('ground'));
  clearShaderPatch(material, planViewPatchKey('equipment'));
}
