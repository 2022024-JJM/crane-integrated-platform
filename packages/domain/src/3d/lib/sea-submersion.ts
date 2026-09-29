import type { IUniform, Material } from 'three';
import { SEA_LEVEL_Y } from '../model/sea-level';
import { seaReachUniforms } from './sea-reach-uniforms';

/**
 * 수면 아래 잠김 패치 — 바다가 있는 씬의 모델·지도 머티리얼에 **깊이 안개**를
 * 주입한다(model-mesh.tsx seaSubmersion). 수면 위 프래그먼트는 건드리지
 * 않으므로 물 위에 있는 부분엔 변화가 없다.
 *
 * 물속 물체는 깊이에 따라 물 색으로 흡수·산란되어 흐려진다. 수면 근처는
 * 원래 색이 거의 그대로, 깊어질수록 물 색으로 섞여 형체만 남는다 — 색을
 * 유지한 채 "물 너머로 보이는" 느낌을 낸다.
 *
 * 안개가 끼는 조건은 둘이다: 수면보다 낮고(월드 y), **그 위치에 바다가
 * 닿는다**(바다 도달 마스크를 월드 XZ 로 조회 — sea-reach-mask.ts). 드라이독
 * 안의 블록처럼 수면보다 낮아도 물이 닿지 않는 곳에 있으면 안개가 없다.
 * 모델과 지도가 같은 조건을 쓴다. 마스크 격자 밖은 바다로 본다.
 *
 * 바다 평면이 깊이를 써서 가리거나 클리핑으로 잘라내지 않는 이유: 전자는
 * 지도의 수면 아래 지형(드라이독)까지 물로 채우고, 후자는 형체가
 * 아예 사라진다. 프레임버퍼를 복사해 진짜 블러를 거는 오버레이는
 * alpha:false 프레임버퍼·텍스처 포맷 호환에 취약해 뺐다(docs/agents/
 * rendering-perf.md 하지 않기로 한 것).
 *
 * 주입 지점:
 * - vertex `<worldpos_vertex>` 뒤 — three의 worldPosition은 특정 define에서만
 *   계산되므로 자체 varying(vSeaWorldPos)을 만든다. `transformed`는 스킨/모프
 *   적용 후 값이고, 인스턴싱이면 instanceMatrix를 먼저 곱한다.
 * - fragment `<tonemapping_fragment>` 앞 — 톤매핑 전(linear)에서 섞어 바다
 *   평면과 같은 ACES 경로를 탄다.
 *
 * customProgramCacheKey를 반드시 지정한다 — three는 onBeforeCompile 유무만으로
 * 프로그램을 구분하지 않아, 없으면 원본 머티리얼의 프로그램을 재사용해 패치가
 * 먹지 않는다(features/lib/materialize-material.ts와 같은 규칙).
 *
 * 안개 상수는 GLSL 리터럴로 굽는다. 마스크만 uniform 이고, 패치된 머티리얼
 * 전부가 sea-reach-uniforms.ts 의 같은 유니폼 객체를 참조한다 — 잠김 공유
 * 머티리얼(sea-material-cache.ts)에 인스턴스별 값을 쓰지 않는다.
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
/**
 * 마스크 값(0‥1)을 안개 배율로 바꾸는 문턱. 마스크는 선형 보간으로 읽으므로
 * 칸 경계에서 0.5 를 지난다 — 그 둘레의 좁은 폭에서만 부드럽게 넘어간다.
 */
export const SEA_REACH_EDGE: readonly [number, number] = [0.4, 0.6];

const CACHE_KEY = 'sea-submersion';

const glslFloat = (v: number) => v.toFixed(4);

const VERTEX_DECLARE = /* glsl */ `#include <common>
varying vec3 vSeaWorldPos;`;

const VERTEX_INJECT = /* glsl */ `
#include <worldpos_vertex>
{
  vec4 seaWp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    seaWp = instanceMatrix * seaWp;
  #endif
  vSeaWorldPos = (modelMatrix * seaWp).xyz;
}
`;

const FRAGMENT_DECLARE = /* glsl */ `#include <common>
varying vec3 vSeaWorldPos;
uniform sampler2D seaReachMask;
uniform mat3 seaReachTransform;`;

// 마스크는 분기 밖에서 항상 읽는다 — 분기 안의 텍스처 조회는 미분이 정의되지
// 않는다. 격자 밖(seaInside 0)은 바다다.
const FRAGMENT_INJECT = /* glsl */ `
{
  float seaDepth = max(0.0, ${glslFloat(SEA_LEVEL_Y)} - vSeaWorldPos.y);
  vec2 seaUv = (seaReachTransform * vec3(vSeaWorldPos.xz, 1.0)).xy;
  float seaInside = step(0.0, seaUv.x) * step(seaUv.x, 1.0)
    * step(0.0, seaUv.y) * step(seaUv.y, 1.0);
  float seaReach = mix(
    1.0,
    smoothstep(${SEA_REACH_EDGE.map(glslFloat).join(', ')}, texture2D(seaReachMask, seaUv).r),
    seaInside
  );
  float seaFog = (1.0 - exp(-seaDepth * ${glslFloat(SEA_FOG_DENSITY)})) * ${glslFloat(SEA_FOG_MAX)} * seaReach;
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
    uniforms: Record<string, IUniform>;
    vertexShader: string;
    fragmentShader: string;
  }) => void;
  customProgramCacheKey: () => string;
};

export function applySeaSubmersion(material: Material): void {
  const target = material as PatchableMaterial;
  target.onBeforeCompile = (shader) => {
    // 값이 아니라 유니폼 객체를 물려 준다 — 마스크가 바뀌면 전 머티리얼이
    // 다음 프레임에 새 값을 본다.
    shader.uniforms.seaReachMask = seaReachUniforms.seaReachMask;
    shader.uniforms.seaReachTransform = seaReachUniforms.seaReachTransform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', VERTEX_DECLARE)
      .replace('#include <worldpos_vertex>', VERTEX_INJECT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', FRAGMENT_DECLARE)
      .replace('#include <tonemapping_fragment>', FRAGMENT_INJECT);
  };
  target.customProgramCacheKey = () => CACHE_KEY;
  target.needsUpdate = true;
}

/**
 * 패치 해제 — opacity<1 등으로 clone이 유지된 채 seaSubmersion만 꺼질 때 쓴다.
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
