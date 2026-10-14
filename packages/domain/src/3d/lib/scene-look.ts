import type { IUniform } from 'three';

/**
 * 씬 룩(관제 모드) — 모델·지도 머티리얼에 공통으로 주입되는 **무채색화**
 * 유니폼. 값 0 = 실사 그대로, 1 = 완전 무채색(저대비 회색). 머티리얼은
 * 유니폼 **객체**를 공유하므로 값만 바꾸면 전 머티리얼이 다음 프레임에 새
 * 값을 본다 — 재컴파일 없음. 주입은 sea-submersion.ts 의 패치가 잠김 안개와
 * 함께 한다(지도·모델 전부가 그 패치를 거친다).
 *
 * 그룹이 둘이다: environment(지도·지형·배경 객체)와 equipment(태그가 걸린
 * 장비 — 크레인). 관제 모드에서 환경은 완전 무채색, 장비는 채도를 조금
 * 남겨 "크레인이 어디 있나" 는 읽히되 색은 상태 표시(외곽선·거리 선)가
 * 이기게 한다. 어느 쪽을 쓸지는 패치 시점의 `group` 옵션이 정한다.
 *
 * 눈부심도 같은 패치가 잡는다: 관제 모드에선 PBR 의 roughness 를 올리고
 * metalness 를 0 으로 섞어(mute 비율) 환경맵·키 라이트의 스펙큘러 반사를
 * 없애고, 마지막에 밝은 쪽을 눌러(knee) 흰 지붕·수면 하이라이트가 외곽선을
 * 덮지 않게 한다.
 */
export type SceneLookGroup = 'environment' | 'equipment';

export const sceneLookUniforms: {
  mute: IUniform<number>;
  muteEquipment: IUniform<number>;
  /** 환경 그룹만 어둡게 하는 배율(0 = 그대로) — 평면(탑뷰) 모드에서 바탕을 가라앉혀 기호가 뜨게. */
  dim: IUniform<number>;
} = {
  mute: { value: 0 },
  muteEquipment: { value: 0 },
  dim: { value: 0 },
};

/** 평면 모드의 바탕 어둡힘(환경 그룹만). 0~0.9 로 클램프. */
export function setSceneDim(dim: number): void {
  sceneLookUniforms.dim.value = Number.isFinite(dim)
    ? Math.min(0.9, Math.max(0, dim))
    : 0;
}

/** 관제 모드에서 장비에 남기는 채도 — mute 1 이 완전 회색이라 1 − 이 값만큼 색이 남는다. */
export const EQUIPMENT_MUTE = 0.45;

/**
 * 룩에 따라 바뀌는 DOM 표시 설정 — 라벨의 거리 축소 하한. 관제 모드에선
 * 멀리 있는 라벨도 읽히게 하한을 올린다. features 스토어가 민다(유니폼처럼
 * 값만 바뀌고 라벨 useFrame 이 매 프레임 읽는다).
 */
export const sceneLookSettings: {
  labelMinScale: number | null;
  /** 라벨 거리 숨김 상한(씬 unit) — null 이면 기본(LABEL_VISIBILITY_DISTANCE). 관제 모드 탑뷰는 Infinity. */
  labelMaxDistance: number | null;
  /** 평면(탑뷰) 모드 — 장비 마커가 라벨을 대신하므로 모델 라벨은 알람 중인 것만 남긴다. ScenePlanMarkers 가 카메라 방향으로 민다. */
  planView: boolean;
  /** 이름 칩 강조(글자 ↑·검은 테두리) — 관제 모드. 라벨 useFrame 이 바뀜을 보고 클래스를 다시 쓴다. */
  labelEmphasis: boolean;
} = {
  labelMinScale: null,
  labelMaxDistance: null,
  labelEmphasis: false,
  planView: false,
};

export function setSceneLookPlanView(on: boolean): void {
  sceneLookSettings.planView = on;
}

export function setSceneLookLabelMaxDistance(max: number | null): void {
  sceneLookSettings.labelMaxDistance =
    max === null || Number.isNaN(max) ? null : Math.max(0, max);
}

export function setSceneLookLabelEmphasis(on: boolean): void {
  sceneLookSettings.labelEmphasis = on;
}

export function setSceneLookLabelMinScale(minScale: number | null): void {
  sceneLookSettings.labelMinScale =
    minScale === null || !Number.isFinite(minScale)
      ? null
      : Math.min(1, Math.max(0.1, minScale));
}

const clamp01 = (v: number) =>
  Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;

/** 무채색 블렌드 — 환경·장비 각각. */
export function setSceneMute(
  environment: number,
  equipment = environment,
): void {
  sceneLookUniforms.mute.value = clamp01(environment);
  sceneLookUniforms.muteEquipment.value = clamp01(equipment);
}

/** 패치가 그룹에 맞는 유니폼 객체를 고른다. */
export function sceneLookUniformFor(group: SceneLookGroup): IUniform<number> {
  return group === 'equipment'
    ? sceneLookUniforms.muteEquipment
    : sceneLookUniforms.mute;
}

export const LOOK_FRAGMENT_DECLARE = /* glsl */ `
uniform float uSceneMute;
uniform float uSceneDim;`;

/**
 * PBR 표면.
 * - environment(지도·지형·선박): **모드와 무관하게** 거칠고 비금속 — 안벽·
 *   아스팔트·지붕이 하늘을 비추며 번들거릴 이유가 없다(GLB 가 metalness 를
 *   들고 오는 경우가 있다). 실사 모드에서도 도크 뷰의 눈부심이 이것이었다.
 * - equipment: 관제 모드에서만(mute 비율) 스펙큘러·환경맵 반사를 없앤다.
 */
export function lookRoughnessInject(group: SceneLookGroup): string {
  return group === 'environment'
    ? /* glsl */ `#include <roughnessmap_fragment>
roughnessFactor = max(roughnessFactor, 0.85);`
    : /* glsl */ `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.95, uSceneMute);`;
}
export function lookMetalnessInject(group: SceneLookGroup): string {
  return group === 'environment'
    ? /* glsl */ `#include <metalnessmap_fragment>
metalnessFactor = 0.0;`
    : /* glsl */ `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.0, uSceneMute);`;
}

/**
 * 무채색 변환 — 그룹마다 밝기가 다르다. 환경은 중간-어두운 회색 띠로 눌러
 * (배율 0.5·바닥 0.10, 휘도 0.5 위는 기울기 0.25 의 knee) 장비보다 항상
 * 어둡게 두고, 장비는 밝은 쪽(배율 0.95·바닥 0.12)으로 올려 회색 야드 위에
 * 떠 보이게 한다 — 관제 모드의 명도 대비는 여기서 난다. 바닥은 그림자 속이
 * 검게 꺼지지 않게 하고, 푸른 기가 살짝 도는 쪽이 모니터에서 덜 지저분하다.
 */
export function lookFragmentInject(group: SceneLookGroup): string {
  const env = group === 'environment';
  const knee = env ? '0.5' : '0.75';
  const slope = env ? '0.25' : '0.35';
  // 이 값은 **linear** 공간이다(톤매핑·sRGB 전) — 화면 회색 0.45 는 linear 로
  // 약 0.15 라 환경 배율이 작아 보인다. 장비는 화면 0.75(linear 0.5) 근처.
  const gain = env ? '0.22' : '0.95';
  const base = env ? 'vec3(0.03, 0.032, 0.036)' : 'vec3(0.12, 0.12, 0.125)';
  return /* glsl */ `
{
  float lookLum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  lookLum = mix(lookLum, ${knee} + (lookLum - ${knee}) * ${slope}, step(${knee}, lookLum));
  vec3 lookGray = vec3(lookLum) * ${gain} + ${base};
  gl_FragColor.rgb = mix(gl_FragColor.rgb, lookGray, uSceneMute);${env ? '\n  gl_FragColor.rgb *= 1.0 - uSceneDim;' : ''}
}`;
}
