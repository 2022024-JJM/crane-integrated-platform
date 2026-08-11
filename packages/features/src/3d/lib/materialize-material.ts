import { Color, type MeshStandardMaterial } from 'three';

/**
 * LiDAR 머티리얼라이즈 셰이더 — 충돌 감지 객체의 시그니처 등장 연출.
 *
 * ROI 진입 시 월드 Y 컷 플레인이 아래→위로 상승하며 객체를 "스캔"해
 * 실체화한다. 컷 위쪽 프래그먼트는 discard, 컷 직하단에는 이미시브
 * 스캔 밴드가 빛난다. 이탈 시 컷이 하강하며 역스캔으로 해체된다.
 *
 * 로컬 좌표가 아닌 월드 Y를 쓰는 이유: 서브 메시(캡슐/머리/바퀴)의
 * 로컬 원점이 제각각이고, easeOutBack 스케일 오버슈트 중에도 JS가
 * 현재 스케일 기준으로 컷 높이를 계산하므로 항상 정확하다.
 *
 * 프레넬 림 글로우도 함께 주입한다 — flat-shaded 바디에 FSD풍 광택을
 * 입히고, 세버리티(uRimColor)를 실시간으로 물들이는 채널이 된다.
 */

export const MATERIALIZE_IN_DURATION = 0.6;
export const MATERIALIZE_OUT_DURATION = 0.45;

/** 스캔 밴드 두께 — 객체 높이 대비 비율 */
export const SCAN_BAND_RATIO = 0.18;

/** 컷 플레인 비활성값 (사실상 무한대 → 전체 표시) */
export const CUT_DISABLED = 1e6;

export interface MaterializeUniforms {
  /** 월드 Y 컷 높이. 이 위는 discard. CUT_DISABLED면 전체 표시. */
  uCutY: { value: number };
  /** 스캔 밴드 두께 (월드 unit) */
  uBand: { value: number };
  uScanColor: { value: Color };
  uRimColor: { value: Color };
  uRimStrength: { value: number };
}

export function createMaterializeUniforms(): MaterializeUniforms {
  return {
    uCutY: { value: CUT_DISABLED },
    uBand: { value: 0.1 },
    uScanColor: { value: new Color('#38bdf8') },
    // 감지 진입 = 최소 warning이므로 림은 amber에서 시작한다 — sky에서
    // lerp로 물들면 등장 순간 파란 잔상이 비친다.
    uRimColor: { value: new Color('#f59e0b') },
    uRimStrength: { value: 0.55 },
  };
}

/**
 * MeshStandardMaterial에 머티리얼라이즈 셰이더를 주입한다.
 *
 * 한 트랙의 모든 material이 같은 uniforms 객체를 공유하므로
 * uniforms.uCutY.value 한 번의 갱신이 전체 서브 메시에 반영된다.
 * customProgramCacheKey를 반드시 지정한다 — 없으면 three의 프로그램
 * 캐시가 미패치 프로그램을 재사용할 수 있다. 모든 패치 material이
 * 같은 키를 공유해 셰이더 컴파일은 1회만 일어난다.
 */
export function applyMaterialize(
  material: MeshStandardMaterial,
  uniforms: MaterializeUniforms,
) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vWorldY;',
      )
      .replace(
        // skinning 이후에 주입 — 스킨드 메시(GLB 사람 등)에서도 변형된
        // 최종 정점의 월드 Y를 얻는다. 비스킨드 메시에는 no-op과 동일.
        '#include <skinning_vertex>',
        '#include <skinning_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vWorldY;
uniform float uCutY;
uniform float uBand;
uniform vec3 uScanColor;
uniform vec3 uRimColor;
uniform float uRimStrength;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
if (vWorldY > uCutY) discard;
float scanBand = 1.0 - smoothstep(0.0, uBand, uCutY - vWorldY);
totalEmissiveRadiance += uScanColor * scanBand * 1.6;
float rimFresnel = pow(1.0 - saturate(dot(normalize(vViewPosition), normalize(normal))), 3.0);
totalEmissiveRadiance += uRimColor * rimFresnel * uRimStrength;`,
      );
  };
  material.customProgramCacheKey = () => 'collision-guard-materialize';
  material.needsUpdate = true;
}
