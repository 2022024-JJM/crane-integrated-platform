import { type IUniform, ShaderMaterial, type Texture } from 'three';

/**
 * 바다 평면 셰이더 — "사진 방향 샘플링 + 월드 고정 파도".
 *
 * 색은 배경(scene.background)과 **같은 규칙**으로 낸다: 픽셀마다 카메라→픽셀
 * 시선 방향으로 EXR 하반구를 샘플링한다(three가 배경을 그릴 때 쓰는
 * `equirectUv`와 같은 함수). 그래서 파도 강도 0에서는 원판과 배경이 픽셀
 * 단위로 같고, 원판 가장자리(40km)에 이음새가 생기지 않는다.
 *
 * 접지감은 **시선 방향을 파도 노멀만큼 기울여서** 만든다. 실제 바다에서
 * 파도 면이 반사 방향을 기울여 수평선 쪽 밝은 하늘/아래쪽 어두운 물을
 * 번갈아 비추는 것과 같은 원리다. 노멀은 월드 XZ 기준 sum-of-sines라 바닥에
 * 붙어 있어 카메라가 움직이면 시차가 생긴다.
 *
 * 왜 PBR 반사(MeshStandardMaterial + envMap)나 평면 반사(Water.js)가 아닌가:
 * 사용자의 기준점이 "배경 사진의 바다"라 사진과 픽셀 단위로 일치하는 방식이
 * 필요했고, Water.js는 씬을 미러 카메라로 한 번 더 그려 지도급 씬에서
 * 프레임 비용이 2배가 된다(docs/지도-GLB-최적화-파이프라인.md의 정책 위반).
 * 크레인이 물에 비쳐야 하면 Water.js를 복제해 mirrorCamera.layers로
 * 하늘+크레인만 반사하도록 개조하는 것이 다음 단계다.
 *
 * 노멀은 프로시저럴 — 텍스처 자산이 없고 타일 반복이 없다. 처음엔 사인파
 * 7개 합성이었는데 마루가 직선이라 격자로 읽혔다. 지금은 해석적 기울기를
 * 가진 값 노이즈 FBM 세 층(너울 2 + 잔물결 1)에, 위상을 저주파 노이즈로
 * 흔든 방향성 너울 2개를 얹는다 — 노이즈가 불규칙성을, 방향성 너울이
 * 바다의 우세 방향을 준다. 원거리에서는 잔물결 → 너울 순으로 감쇠해
 * 앨리어싱을 막고, 완전히 감쇠한 곳은 배경과 같은 색이 된다.
 */

// ShaderMaterial.uniforms가 인덱스 시그니처를 요구해 Record를 확장한다.
export interface SeaSurfaceUniforms extends Record<string, IUniform> {
  /** EXR equirect 파노라마 — 배경과 같은 텍스처 객체 */
  tEnv: { value: Texture };
  uTime: { value: number };
  /**
   * 파도 기울기 배율. 1이면 사인파가 정의한 물리 기울기(최대 ~10°) 그대로,
   * 0이면 배경과 픽셀 단위로 동일.
   */
  uWaveStrength: { value: number };
  /** 카메라 거리 기준 너울 감쇠 시작/끝(월드 unit). 잔물결은 시작 거리의 20~80% 구간에서 먼저 감쇠. */
  uFadeStart: { value: number };
  uFadeEnd: { value: number };
}

const vertexShader = /* glsl */ `
varying vec3 vWorldPos;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const fragmentShader = /* glsl */ `
#include <common>

uniform sampler2D tEnv;
uniform float uTime;
uniform float uWaveStrength;
uniform float uFadeStart;
uniform float uFadeEnd;

varying vec3 vWorldPos;

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

// 값 노이즈 + 해석적 기울기 (x: 값, yz: d/dx, d/dy). 유한차분 대신 써서
// 노이즈 호출 수를 1/5로 줄인다. 퀸틱 보간이라 기울기가 연속이다.
vec3 noised(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  float k1 = b - a;
  float k2 = c - a;
  float k3 = a - b - c + d;
  return vec3(
    a + k1 * u.x + k2 * u.y + k3 * u.x * u.y,
    du * vec2(k1 + k3 * u.y, k2 + k3 * u.x)
  );
}

// 4옥타브 FBM + 기울기. 옥타브마다 회전·스케일된 좌표의 기울기를
// 체인룰(vec * mat = 전치 곱)로 원 좌표계로 되돌려 누적한다.
vec3 fbmd(vec2 p) {
  const mat2 rot = mat2(0.8, 0.6, -0.6, 0.8) * 2.03;
  mat2 m = mat2(1.0);
  float value = 0.0;
  vec2 grad = vec2(0.0);
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    vec3 n = noised(p);
    value += amp * n.x;
    grad += amp * (n.yz * m);
    p = rot * p + vec2(17.3, 9.1);
    m = rot * m;
    amp *= 0.5;
  }
  return vec3(value, grad);
}

// 방향성 너울 한 개의 기울기. 위상을 저주파 노이즈로 흔들어 마루가 직선이
// 아니라 구불구불하게 — 이게 없으면 사인파 마루가 그대로 격자로 읽힌다.
void addSwell(
  inout vec2 grad, vec2 p, vec2 dir,
  float wavelength, float amplitude, float speed, float t
) {
  float k = PI2 / wavelength;
  float jitter = (noised(p * 0.006 + t * 0.02).x - 0.5) * 5.0;
  float phase = dot(dir, p) * k + t * speed + jitter;
  grad += dir * (amplitude * k * cos(phase));
}

vec3 waveNormal(vec2 p, float t, float rippleWeight) {
  vec2 grad = vec2(0.0);

  // 노이즈 너울 두 층 — 서로 다른 스케일·회전·흐름 방향이라 합이 주기
  // 없이 계속 변한다(한 층만 흘리면 시트가 미끄러지는 것처럼 보인다).
  // 기울기 = 진폭/스케일 × FBM 기울기. 진폭/스케일 ≈ 0.05 → 최대 ~5°.
  vec3 n1 = fbmd(p / 62.0 + vec2(0.021, 0.013) * t);
  grad += (3.2 / 62.0) * n1.yz;

  const mat2 r2 = mat2(0.799, 0.602, -0.602, 0.799);
  vec3 n2 = fbmd((r2 * p) / 47.0 + vec2(-0.017, 0.024) * t);
  grad += (2.2 / 47.0) * (n2.yz * r2);

  // 방향성 너울 두 개(파장이 무리수 비) — 바다에 남는 우세 방향.
  addSwell(grad, p, normalize(vec2(1.0, 0.41)), 97.0, 0.55, 0.52, t);
  addSwell(grad, p, normalize(vec2(-0.37, 1.0)), 143.0, 0.45, 0.43, t);

  // 잔물결 — 노이즈 한 층, 빠르게 흐른다. 원거리에선 먼저 감쇠.
  vec3 n3 = fbmd(p / 7.5 + vec2(0.35, 0.2) * t);
  grad += rippleWeight * (0.28 / 7.5) * n3.yz;

  return normalize(vec3(-grad.x, 1.0, -grad.y));
}

void main() {
  vec3 dir = normalize(vWorldPos - cameraPosition);
  float dist = distance(vWorldPos, cameraPosition);

  float swellFade = 1.0 - smoothstep(uFadeStart, uFadeEnd, dist);
  float rippleFade = 1.0 - smoothstep(uFadeStart * 0.2, uFadeStart * 0.8, dist);

  vec3 n = waveNormal(vWorldPos.xz, uTime, rippleFade);

  // 시선 방향을 노멀 기울기만큼 기울인다. 하반구(사진의 바다) 안에 머물게
  // 클램프 — 위로 넘어가면 물 아래로 하늘이 비친다.
  vec3 d = dir + (n - vec3(0.0, 1.0, 0.0)) * (uWaveStrength * swellFade);
  d = normalize(d);
  d.y = min(d.y, -0.002);
  d = normalize(d);

  vec3 color = texture2D(tEnv, equirectUv(d)).rgb;
  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createSeaSurfaceMaterial(
  envTexture: Texture,
  options: { waveStrength: number; fadeStart: number; fadeEnd: number },
): ShaderMaterial & { uniforms: SeaSurfaceUniforms } {
  const uniforms: SeaSurfaceUniforms = {
    tEnv: { value: envTexture },
    uTime: { value: 0 },
    uWaveStrength: { value: options.waveStrength },
    uFadeStart: { value: options.fadeStart },
    uFadeEnd: { value: options.fadeEnd },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    // 지도가 항상 위에 덮이게(GLB 바다 y≈-0.017과의 z-fighting 방지).
    depthWrite: false,
  });
  return material as ShaderMaterial & { uniforms: SeaSurfaceUniforms };
}
