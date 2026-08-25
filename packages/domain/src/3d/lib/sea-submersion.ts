import type { Material } from 'three';
import { SEA_LEVEL_Y } from '../model/sea-level';

/**
 * 수면 아래 잠김 패치 — 떠 있는 모델(floating)의 머티리얼에 **월드 y 기준
 * 깊이 안개**를 주입한다.
 *
 * 물속 물체는 깊이에 따라 물 색으로 흡수·산란되어 흐려진다. 수면 근처는
 * 원래 색이 거의 그대로, 깊어질수록 물 색으로 섞여 형체만 남는다 — 색을
 * 유지한 채 "물 너머로 보이는" 느낌을 낸다.
 *
 * 바다 평면이 깊이를 써서 가리거나 클리핑으로 잘라내지 않는 이유: 전자는
 * 지도의 수면 아래 지형(드라이독 -12.4m)까지 물로 채우고, 후자는 형체가
 * 아예 사라진다. 프레임버퍼를 복사해 진짜 블러를 거는 오버레이는
 * alpha:false 프레임버퍼·텍스처 포맷 호환에 취약해 뺐다(scene-environment.tsx).
 *
 * 주입 지점:
 * - vertex `<worldpos_vertex>` 뒤 — three의 worldPosition은 특정 define에서만
 *   계산되므로 자체 varying(vSeaWorldY)을 만든다. `transformed`는 스킨/모프
 *   적용 후 값이고, 인스턴싱이면 instanceMatrix를 먼저 곱한다.
 * - fragment `<tonemapping_fragment>` 앞 — 톤매핑 전(linear)에서 섞어 바다
 *   평면과 같은 ACES 경로를 탄다.
 *
 * customProgramCacheKey를 반드시 지정한다 — three는 onBeforeCompile 유무만으로
 * 프로그램을 구분하지 않아, 없으면 원본 머티리얼의 프로그램을 재사용해 패치가
 * 먹지 않는다(features/lib/materialize-material.ts와 같은 규칙).
 *
 * 상수는 GLSL 리터럴로 굽는다 — 런타임에 바뀔 값이 없어 uniform이 필요 없다.
 */

/** 안개 밀도(1/m). 2m: 39%, 5m: 71%, 10m: 92%가 물 색으로 섞인다. */
export const SEA_FOG_DENSITY = 0.25;
/** 안개 상한. 아무리 깊어도 원래 색 10%는 남겨 형체가 보이게 한다. */
export const SEA_FOG_MAX = 0.9;
/**
 * 물 색(linear). EXR nadir 평균(0.03, 0.04, 0.064)보다 약간 밝고 초록 —
 * 어두운 선체와의 대비를 남겨 형체가 읽히게 한다.
 */
export const SEA_WATER_COLOR: readonly [number, number, number] = [
  0.05, 0.09, 0.12,
];

const CACHE_KEY = 'sea-submersion';

const glslFloat = (v: number) => v.toFixed(4);

const VERTEX_INJECT = /* glsl */ `
#include <worldpos_vertex>
{
  vec4 seaWp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    seaWp = instanceMatrix * seaWp;
  #endif
  vSeaWorldY = (modelMatrix * seaWp).y;
}
`;

const FRAGMENT_INJECT = /* glsl */ `
{
  float seaDepth = max(0.0, ${glslFloat(SEA_LEVEL_Y)} - vSeaWorldY);
  float seaFog = (1.0 - exp(-seaDepth * ${glslFloat(SEA_FOG_DENSITY)})) * ${glslFloat(SEA_FOG_MAX)};
  gl_FragColor.rgb = mix(
    gl_FragColor.rgb,
    vec3(${SEA_WATER_COLOR.map(glslFloat).join(', ')}),
    seaFog
  );
}
#include <tonemapping_fragment>
`;

type PatchableMaterial = Material & {
  onBeforeCompile: (shader: {
    vertexShader: string;
    fragmentShader: string;
  }) => void;
  customProgramCacheKey: () => string;
};

export function applySeaSubmersion(material: Material): void {
  const target = material as PatchableMaterial;
  target.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vSeaWorldY;')
      .replace('#include <worldpos_vertex>', VERTEX_INJECT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSeaWorldY;')
      .replace('#include <tonemapping_fragment>', FRAGMENT_INJECT);
  };
  target.customProgramCacheKey = () => CACHE_KEY;
  target.needsUpdate = true;
}

/**
 * 패치 해제 — opacity<1 등으로 clone이 유지된 채 floating만 꺼질 때 쓴다.
 * clone 자체가 버려지는 경로(restoreOriginalMaterials)에서는 원본이 패치가
 * 없으므로 호출할 필요가 없다.
 */
export function clearSeaSubmersion(material: Material): void {
  const target = material as PatchableMaterial;
  if (target.customProgramCacheKey() !== CACHE_KEY) return;
  target.onBeforeCompile = () => {};
  target.customProgramCacheKey = () => '';
  target.needsUpdate = true;
}
