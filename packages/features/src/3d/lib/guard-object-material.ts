import type { Material } from 'three';

/**
 * 충돌 감지 객체의 재질 페이드 — 자산이 가진 재질(색·텍스처)을 그대로 두고
 * 등장·이탈·경계 고스트의 불투명도만 곱한다.
 *
 * 재질마다 원래 값이 다르므로(유리는 반투명, 머리카락은 알파 컷) 페이드를
 * 그대로 대입하면 모습이 깨진다. 복제할 때 원래 값을 잡아 두고 매 프레임
 * 그 값에 페이드를 곱한다.
 */

/** 이 값 이상이면 실체로 본다 — 원래 깊이를 쓰던 재질이 깊이를 쓴다. */
export const GUARD_SOLID_FADE = 0.99;

/**
 * 원래 반투명인 재질(유리·눈썹)을 쓰는 메시의 렌더 순서.
 *
 * 감지 객체의 재질은 페이드 때문에 전부 투명 패스에서 그려진다. 깊이를 쓰지
 * 않는 유리가 그 뒤의 실내보다 먼저 그려지면 실내가 유리를 덮어 유리가
 * 사라지므로, 같은 객체의 본체(0)보다 뒤에 그린다. 바다(0.25)보다는 앞이라
 * 본체와 같은 쪽에 남는다.
 */
export const GUARD_BLENDED_RENDER_ORDER = 0.1;

/**
 * 알파 컷 기준의 바닥값. three 는 컴파일 시점의 `alphaTest > 0` 으로 컷 여부를
 * 정하고 그 뒤로는 0 보다 클 때만 유니폼을 갱신한다 — 0 으로 내리면 컷이
 * 빠진 채 컴파일되거나 직전 값이 남는다.
 */
const ALPHA_TEST_FLOOR = 1e-4;

interface GuardFadeBase {
  opacity: number;
  alphaTest: number;
  depthWrite: boolean;
  /** 원래 반투명(알파 블렌딩)이던 재질인가. */
  blended: boolean;
}

/** 준비되지 않은 재질의 기준값 — 불투명한 재질로 본다. */
const OPAQUE_BASE: GuardFadeBase = {
  opacity: 1,
  alphaTest: 0,
  depthWrite: true,
  blended: false,
};

const fadeBases = new WeakMap<Material, GuardFadeBase>();

function clamp01(value: number): number {
  if (!(value > 0)) return 0;
  return value < 1 ? value : 1;
}

/**
 * 자산의 재질을 감지 객체용으로 복제한다. 색·텍스처는 그대로이고, 페이드가
 * 곱해질 원래 값을 잡아 둔 뒤 보이지 않는 상태(페이드 0)에서 시작한다.
 * 원본은 건드리지 않는다 — GLTF 캐시가 다른 인스턴스와 공유한다.
 */
export function prepareGuardObjectMaterial<T extends Material>(source: T): T {
  const material = source.clone() as T;
  const base: GuardFadeBase = {
    opacity: Number.isFinite(source.opacity) ? clamp01(source.opacity) : 1,
    alphaTest: Number.isFinite(source.alphaTest)
      ? clamp01(source.alphaTest)
      : 0,
    depthWrite: source.depthWrite === true,
    blended: source.transparent === true,
  };
  fadeBases.set(material, base);
  material.transparent = true;
  material.alphaTest = base.alphaTest;
  applyGuardFade(material, 0);
  return material;
}

/** 원래 반투명이던 재질인가 — 그 메시는 본체 뒤에 그린다. */
export function isGuardBlendedMaterial(material: Material): boolean {
  return fadeBases.get(material)?.blended === true;
}

/**
 * 페이드(0~1)를 재질에 반영한다.
 *
 * - 불투명도는 원래 값에 곱한다. 유리는 다 나타난 뒤에도 유리다.
 * - 알파 컷 기준도 같은 비율로 낮춘다. 그대로 두면 반투명 구간에서 컷
 *   재질(머리카락·눈)이 통째로 잘린다.
 * - 깊이는 원래 쓰던 재질이 실체가 됐을 때만 쓴다. 반투명한 동안 깊이를
 *   쓰면 같은 객체의 뒷면이 그려지는 순서에 따라 얼룩진다.
 */
export function applyGuardFade(material: Material, fade: number): void {
  const base = fadeBases.get(material) ?? OPAQUE_BASE;
  const level = clamp01(fade);
  material.opacity = base.opacity * level;
  if (base.alphaTest > 0) {
    material.alphaTest = Math.max(base.alphaTest * level, ALPHA_TEST_FLOOR);
  }
  material.depthWrite = base.depthWrite && level >= GUARD_SOLID_FADE;
}
