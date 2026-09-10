import { Color, DoubleSide, NormalBlending, ShaderMaterial } from 'three';

/**
 * 홀로그램(프레넬 림) 머티리얼 — 충돌 예측의 "미래 자세 고스트" 가 쓴다.
 *
 * 예측이 보여 줘야 하는 것은 "몇 초 뒤 이 장비가 여기 있다" 이고, 그것을
 * 바운딩 박스로 그리면 형태를 잃어 어느 부품이 어디로 가는지 안 읽힌다.
 * 그래서 실제 모델을 한 벌 더 그리되 실물과 헷갈리지 않게 반투명 림으로만
 * 표현한다.
 *
 * 프레넬: 시선과 노멀이 이루는 각이 클수록(윤곽선에 가까울수록) 밝다. 안쪽은
 * 거의 비어 보이고 실루엣만 살아나므로 뒤에 있는 실물이 비쳐 두 자세를 동시에
 * 읽을 수 있다.
 *
 * 실루엣 테두리(silhouette-outline)와 달리 **스텐실을 쓰지 않는다.** 스텐실
 * 참조값이 캔버스당 하나뿐이라 빨간 충돌 테두리와 동시에 뜨면 발자국이 전역
 * 합집합이 되기 때문이다(object-silhouette-outline 주석). 여기서는 깊이만
 * 읽고(가려지면 가려진다) 깊이를 쓰지 않아 고스트끼리 겹쳐도 누적된다.
 *
 * **`logdepthbuf` 청크를 반드시 include 한다.** 씬 렌더러가
 * `logarithmicDepthBuffer: true` 라(scene-render-preset) raw ShaderMaterial 이
 * 표준 z 를 쓰면 깊이 비교가 씬 전체와 다른 좌표계에서 돌아, 고스트가 카메라
 * 거리·각도에 따라 통째로 사라졌다 나타났다 한다(실측 2026-09-10). 실루엣
 * 테두리의 옛 inverted hull 이 통째로 탈락했던 것과 같은 함정이다
 * (silhouette-outline 주석). 청크 내부가 옵션 가드라 로그 깊이가 꺼진
 * 렌더러에서도 무해하다.
 *
 * 블렌딩은 `NormalBlending` 이다. `AdditiveBlending` 은 어두운 배경에서만
 * 빛나고 밝은 지형·하늘 위에서는 흰색으로 포화돼 사라진다 — 카메라를 돌리면
 * 배경이 바뀌므로 "각도에 따라 안 보이는" 두 번째 원인이었다.
 *
 * 프레넬 바닥값(0.32)이 "정면으로 보는 면" 의 최소 가시성을 정한다. 크레인은
 * 큰 평판이 많아 이 값이 낮으면 정면 시점에서 통째로 옅어진다.
 *
 * ShaderMaterial 은 톤매핑·포그를 포함하지 않으므로 원색이 유지되고, 출력
 * 색공간 변환만 `colorspace_fragment` 로 직접 건다(sea-surface-material 선례).
 *
 * 머티리얼은 opacity 단계별로 캐시해 세션 동안 살려 둔다. three 는 같은
 * 셰이더의 마지막 머티리얼이 dispose 되면 프로그램을 지우므로, 캐시가 없으면
 * 예측이 뜰 때마다 셰이더가 다시 컴파일돼 프레임이 선다(실루엣 프리워밍이
 * 존재하는 이유와 같다). 색·투명도는 uniform 이라 프로그램 키에 영향을 주지
 * 않는다.
 *
 * **맥동(시간에 따른 밝기·투명도 변조)을 두지 않는다.** 임박할수록 빠르게
 * 뛰게 만들었더니(최대 2.6Hz, 진폭 0.45) 그냥 번쩍이는 것으로 보였다
 * (2026-09-10 사용자 피드백). 고스트는 "저기 있다" 를 조용히 가리키는 표시이고
 * 긴박함은 카운트다운 숫자·호가 맡는다. 정적이라 프레임마다 uniform 을 쓸
 * 일도 없어졌다.
 */

const VERTEX_SHADER = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>

varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
}
`;

const FRAGMENT_SHADER = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>

uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  #include <logdepthbuf_fragment>

  // 노멀이 뒤집힌 면(DoubleSide)도 같은 밝기가 되게 abs 를 쓴다.
  float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
  // 지수를 낮게(1.6) 잡아 정면으로 보는 평판도 완전히 사라지지 않게 한다.
  float rim = pow(1.0 - facing, 1.6);
  // 바닥값(BASE_ALPHA)이 "정면에서 본 면" 의 최소 가시성을 정한다. 이 값이
  // 너무 낮으면 크레인의 큰 평판을 정면으로 볼 때 통째로 사라진다.
  float alpha = (0.32 + 0.68 * rim) * uOpacity;
  gl_FragColor = vec4(uColor * (0.7 + 0.6 * rim), alpha);

  #include <colorspace_fragment>
}
`;

const cache = new Map<string, ShaderMaterial>();

/** 캐시 키 — opacity 를 100 단계로 양자화해 머티리얼 수를 묶는다. */
function keyOf(color: string, opacity: number): string {
  return `${color}@${Math.round(opacity * 100)}`;
}

/**
 * 고스트용 머티리얼. 같은 (색, opacity) 조합은 같은 인스턴스를 돌려주므로
 * 호출자가 dispose 하지 않는다 — 세션 동안 유지되는 것이 의도다.
 */
export function getHologramMaterial(
  color: string,
  opacity: number,
): ShaderMaterial {
  const key = keyOf(color, opacity);
  const cached = cache.get(key);
  if (cached) return cached;
  const material = new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uColor: { value: new Color(color) },
      uOpacity: { value: opacity },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
    toneMapped: false,
  });
  cache.set(key, material);
  return material;
}

/**
 * 고스트 메시의 renderOrder. 투명 객체는 three 가 깊이로 정렬하는데, 크레인처럼
 * 메시 수십 개가 비슷한 거리에 있으면 카메라를 돌릴 때 정렬 순서가 뒤바뀌며
 * 블렌딩 결과가 튄다. 고정 값을 주어 씬의 다른 투명체(바다 등)와 섞이는
 * 순서만큼은 고정한다. 실루엣 오버레이(10·11)보다 앞이고 선택 박스(1)보다 뒤다.
 */
export const HOLOGRAM_RENDER_ORDER = 2;
