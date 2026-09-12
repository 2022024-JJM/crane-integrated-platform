import { AlwaysStencilFunc, KeepStencilOp, ReplaceStencilOp } from 'three';
import type { Material } from 'three';

/**
 * 씬 스텐실 버퍼의 비트 배분 — 캔버스(`SCENE_GL_OPTIONS.stencil: true`)의
 * 8bit 스텐실을 두 용도가 나눠 쓴다. 두 용도 모두 마스크(writeMask·funcMask)로
 * 자기 비트만 읽고 써야 서로를 지우지 않는다.
 *
 * - SILHOUETTE_STENCIL_BIT: 실루엣 테두리의 발자국 마스크(silhouette-outline.ts).
 *   선택·충돌 표시 때 대상 모델의 픽셀에 찍고, 헐이 그 밖에서만 그려진다.
 * - SCENE_OPAQUE_STENCIL_BIT: **"이 픽셀에 불투명 씬 메시가 그려졌다"** 표식.
 *   GLTF 인스턴스의 모든 메시 머티리얼이 깊이 테스트를 통과한 픽셀에 찍는다
 *   (markSceneOpaqueStencil). 바다 평면(features scene-environment)이 불투명
 *   패스 **뒤에** 이 비트가 없는 픽셀에서만 그려진다 — 예전에는 바다를 맨
 *   먼저 그려 야드·지형이 덮을 픽셀에서도 파도 셰이더(픽셀당 노이즈 50여 회)
 *   가 매 프레임 돌았다. 바다는 깊이를 쓰지 않으므로(수면 아래 드라이독·잠긴
 *   선체를 가리면 안 된다) "무엇이든 그려졌으면 진다" 는 규칙을 깊이가 아니라
 *   스텐실로 만든다. 스텐실 테스트는 프래그먼트 셰이더 앞(early test)에서
 *   끝나므로 가려진 픽셀은 셰이더 비용이 0 이다(2026-09-12).
 *
 * 스텐실 버퍼가 없는 캔버스(mro2·philly 존 뷰어)에서는 GL 규격상 테스트가
 * 항상 통과하고 쓰기는 무시되므로 같은 머티리얼을 그대로 써도 무해하다.
 */
export const SILHOUETTE_STENCIL_BIT = 0x01;
export const SCENE_OPAQUE_STENCIL_BIT = 0x02;

/**
 * 불투명 씬 메시 머티리얼에 "그려졌다" 비트 쓰기를 켠다. 테스트는 Always 라
 * 렌더 결과는 그대로이고, 깊이 테스트를 통과한(ZPass) 프래그먼트만 비트를
 * 찍는다 — 뒤에 가려진 조각은 표식을 남기지 않는다. 멱등이라 clone 마다
 * 반복 호출해도 된다. `Material.clone()` 이 스텐실 필드를 복사하므로 알람
 * tint·잠김 공유 variant 등 파생 머티리얼도 표식을 잃지 않는다.
 *
 * transparent 머티리얼에도 켜 두지만 실효는 없다 — transparent 리스트는
 * 바다 뒤에 그려지므로 바다가 먼저 깔리고 그 위에 블렌딩된다(종전과 같다).
 */
export function markSceneOpaqueStencil(material: Material): void {
  material.stencilWrite = true;
  material.stencilFunc = AlwaysStencilFunc;
  material.stencilRef = SCENE_OPAQUE_STENCIL_BIT;
  material.stencilFuncMask = SCENE_OPAQUE_STENCIL_BIT;
  material.stencilWriteMask = SCENE_OPAQUE_STENCIL_BIT;
  material.stencilFail = KeepStencilOp;
  material.stencilZFail = KeepStencilOp;
  material.stencilZPass = ReplaceStencilOp;
}

/** 배열/단일 머티리얼 모두. */
export function markSceneOpaqueStencils(material: Material | Material[]): void {
  if (Array.isArray(material)) {
    for (const m of material) markSceneOpaqueStencil(m);
  } else {
    markSceneOpaqueStencil(material);
  }
}

/** 표식이 켜져 있는지 — 테스트·진단용. */
export function hasSceneOpaqueStencil(material: Material): boolean {
  return (
    material.stencilWrite === true &&
    material.stencilFunc === AlwaysStencilFunc &&
    (material.stencilRef & SCENE_OPAQUE_STENCIL_BIT) !== 0 &&
    (material.stencilWriteMask & SCENE_OPAQUE_STENCIL_BIT) !== 0 &&
    material.stencilZPass === ReplaceStencilOp
  );
}
