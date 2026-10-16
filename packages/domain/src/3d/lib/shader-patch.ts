import type { IUniform, Material } from 'three';

/**
 * 셰이더 패치 합성 — 한 머티리얼에 여러 `onBeforeCompile` 주입(잠김 안개·
 * 평면도 톤)을 키로 등록해 함께 돌린다.
 *
 * three 의 `onBeforeCompile` 은 슬롯 하나라 패치가 둘이면 나중 것이 앞 것을
 * 덮는다. 여기서는 패치 목록을 머티리얼에 붙여 두고 슬롯 하나가 등록 순서로
 * 전부 적용한다. `customProgramCacheKey` 는 키를 이은 값 — three 는
 * onBeforeCompile 유무로 프로그램을 구분하지 않으므로 키가 없으면 원본
 * 프로그램을 재사용해 패치가 먹지 않는다. 패치 조합이 다르면 키도 달라
 * 프로그램이 따로 잡힌다.
 *
 * 등록·해제 모두 `needsUpdate` 를 올린다. 같은 키 재등록은 교체(멱등),
 * 없는 키 해제는 no-op 이다.
 */

export interface ShaderPatchTarget {
  uniforms: Record<string, IUniform>;
  vertexShader: string;
  fragmentShader: string;
}

export type ShaderPatch = (shader: ShaderPatchTarget) => void;

type PatchableMaterial = Material & {
  onBeforeCompile: (shader: ShaderPatchTarget) => void;
  customProgramCacheKey: () => string;
};

const registry = new WeakMap<Material, Map<string, ShaderPatch>>();

function rebuild(target: PatchableMaterial, patches: Map<string, ShaderPatch>) {
  if (patches.size === 0) {
    target.onBeforeCompile = () => {};
    target.customProgramCacheKey = () => '';
  } else {
    const list = [...patches.values()];
    const key = [...patches.keys()].join('|');
    target.onBeforeCompile = (shader) => {
      for (const patch of list) patch(shader);
    };
    target.customProgramCacheKey = () => key;
  }
  target.needsUpdate = true;
}

/** 키로 패치를 등록(교체)한다. */
export function setShaderPatch(
  material: Material,
  key: string,
  patch: ShaderPatch,
): void {
  let patches = registry.get(material);
  if (!patches) {
    patches = new Map();
    registry.set(material, patches);
  }
  patches.set(key, patch);
  rebuild(material as PatchableMaterial, patches);
}

/** 키의 패치를 해제한다. 등록된 적 없으면 no-op. */
export function clearShaderPatch(material: Material, key: string): void {
  const patches = registry.get(material);
  if (!patches || !patches.delete(key)) return;
  rebuild(material as PatchableMaterial, patches);
}

export function hasShaderPatch(material: Material, key: string): boolean {
  return registry.get(material)?.has(key) === true;
}
