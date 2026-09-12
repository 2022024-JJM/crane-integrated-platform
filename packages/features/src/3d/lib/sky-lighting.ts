import { clampToRange } from '@crane/core/lib/utils';

/**
 * 태양·달 고도 → 조명·하늘 파라미터 (낮/황혼/밤 곡선).
 *
 * SceneLighting 의 solar 모드가 매 프레임 이 값을 방향광·환경광·배경
 * 밝기에 쓴다. 천체 위치(domain solar-position)와 조명 세기(여기)를 나눈
 * 이유: 천문 계산은 사실이고 조명 곡선은 **취향과 용도**의 문제라 따로
 * 조율돼야 한다.
 *
 * 밤은 **야간 작업등**이 밝힌다(2026-09-11). 처음엔 달빛+어두운 환경광만
 * 두었는데 관제 화면으로는 너무 어두웠다 — 실제 조선소 야드는 밤에도 고소
 * 조명(마스트 투광등)이 켜져 있어 장비가 환하다. 그래서 해가 지면
 * 따뜻한 백색 투광등이 고정 방향(마스트, YARD_LIGHT_AZIMUTH/ELEVATION)에서
 * 켜지고 환경광도 난색으로 오른다. 하늘(EXR 배경)만 어두워져 "밤인데
 * 조명이 켜진 야드" 로 읽힌다. 작업등은 옵션(useSceneClockStore.yardLights)
 * 이라 끄면 달·별빛 수준의 어두운 밤(NIGHT_*_DARK)이 된다.
 *
 * 방향광은 하나뿐이다(shadow map 하나). 박명에 태양이 지고 작업등이 켜지는
 * 동안은 두 세기의 **합**을 세기로, 세기 비율(keyYardBlend)로 방향·색을
 * 섞는다 — 그림자가 낮은 태양 방향에서 마스트 방향으로 수십 분에 걸쳐
 * 천천히 돌아가고, 어느 순간에도 튀지 않는다(solar-lighting 이 방향을 섞는다).
 *
 * ui 가 아니라 lib 에 있는 이유: 컴포넌트 파일의 함수 export 는
 * react-refresh 규칙에 걸리고(scene-shadow.ts 와 같은 사정), 순수 함수라
 * 여기서 테스트한다.
 */

export type RgbTuple = readonly [number, number, number];

export interface SkyLightingInput {
  /** 태양 고도(도). 지평선 아래는 음수. */
  sunElevation: number;
  /** 달 고도(도). */
  moonElevation: number;
  /** 달 조명 비율 0(삭)~1(망). */
  moonFraction: number;
}

/** 낮 기준 세기 — SCENE_LIGHTING 의 값을 그대로 넘긴다(결합 방지). */
export interface SkyLightingBase {
  sunIntensity: number;
  ambientIntensity: number;
}

/**
 * 낮 기준 조명 세기의 **단일 소스**. scene-render-preset.tsx 의
 * SCENE_LIGHTING 이 이 값을 읽고(값 이력·조율 규칙은 그쪽 주석), solar 모드
 * 곡선과 UI 상태 훅(use-scene-sun-state)도 같은 값을 넣는다 — 한낮의
 * solar 결과가 수동 모드의 기존 화면과 정확히 같아지는 근거다.
 */
export const SCENE_LIGHTING_BASE: SkyLightingBase = {
  sunIntensity: 3.6,
  ambientIntensity: 0.9,
};

/**
 * 환경맵(IBL) 세기 — scene-environment.tsx 가 마운트 때 걸고, solar 모드의
 * SceneLighting 이 하늘 밝기(skyIntensity)를 곱한 값으로 매 프레임 맞춘다.
 * 값의 근거는 scene-environment.tsx 주석(0.18 — 반사만 얹고 조명은 안 바꾸는
 * 세기).
 */
export const SCENE_ENVIRONMENT_INTENSITY = 0.18;

export interface SkyLightingOptions {
  /** 야간 작업등(투광등) 점등 여부. 기본 true. */
  yardLights?: boolean;
}

export interface SkyLighting {
  /** 0(밤)~1(낮). 환경광·UI 아이콘 판정에 쓴다. */
  daylight: number;
  /** 배경(EXR)·환경맵 밝기 배율. 낮 1, 밤 NIGHT_SKY_INTENSITY. */
  skyIntensity: number;
  /** 태양이 방향광에 기여하는 세기(고도 곡선). */
  sunIntensity: number;
  /** 야간 작업등이 방향광에 기여하는 세기(점등 곡선 × 옵션). */
  yardIntensity: number;
  /** 방향광 세기 = sunIntensity + yardIntensity. */
  keyIntensity: number;
  /** 방향광 색 — 두 기여의 세기 가중 혼합. */
  keyColor: RgbTuple;
  /**
   * 방향광 방향에서 작업등(마스트 방향)이 차지하는 비중 0(태양 방향)~1
   * (마스트 방향). 세기 비율이라 두 세기가 모두 0 이면 밤(1)로 본다.
   */
  keyYardBlend: number;
  ambientIntensity: number;
  ambientColor: RgbTuple;
  /**
   * 보조 투광등(필 라이트, 그림자 없음) 세기·색 — 주 마스트 반대편
   * (FILL_LIGHT_AZIMUTH/ELEVATION)에서 그림자 면을 들어 올린다. 낮엔 0.
   */
  fillIntensity: number;
  fillColor: RgbTuple;
  /**
   * 밤 반구광 — 위(하늘)는 남색, 아래(조명 받은 바닥의 반사)는 난색.
   * 면의 방향에 따라 색이 달라져 밤 장비에 입체감을 준다. 낮엔 0.
   */
  hemisphereIntensity: number;
  hemisphereSkyColor: RgbTuple;
  hemisphereGroundColor: RgbTuple;
  /**
   * 밤하늘 틴트 돔 불투명도 0~1 — EXR 배경을 배율로만 어둡게 하면 회색으로
   * 죽어 남색을 덧입힌다(색은 NIGHT_SKY_TINT_COLOR). 낮엔 0.
   */
  skyTintOpacity: number;
  /** 하늘의 태양 표식(스프라이트) 불투명도 0~1. */
  sunVisibility: number;
  /** 달 표식 불투명도 0~1. */
  moonVisibility: number;
}

/**
 * 태양 방향광 세기가 0→1 로 오르는 고도 구간(도). 해가 지평선 위에 있는
 * 동안은 거의 전부 "완전한 낮" — 아침·저녁이 어둡게 느껴진다는 피드백으로
 * 2026-09-12 에 [-3, 10] → [-3, 4] 로 좁혔다. 어두워지는 것은 일몰 직전
 * 몇 분뿐이고, 그림자 방향만 태양을 따라 돈다.
 */
export const SUN_KEY_FADE: readonly [number, number] = [-3, 4];
/**
 * 낮은 태양의 지면 조도 보상. 방향광 세기는 고도와 무관한데 지면·수평면이
 * 받는 빛은 sin(고도)에 비례해 아침·저녁·겨울 정오가 어두워 보인다.
 * 그래서 sin(기준 고도)/sin(고도) 만큼 세기를 올린다 — 기준 고도는 수동
 * 모드 기본값(SCENE_SUN_ELEVATION_DEFAULT ≈ 78.7°)이라 그 높이의 태양이
 * 곧 기존 화면이다. 상한은 수직면(크레인 측면)이 타지 않는 선.
 */
export const SUN_COMPENSATION_REF_ELEVATION = 78.69006752597979;
export const SUN_COMPENSATION_MAX = 1.6;
/** 낮 판정(daylight) 구간 — 시민 박명(−6°)에서 시작해 3° 에서 완전한 낮. */
export const DAYLIGHT_FADE: readonly [number, number] = [-6, 3];
/** 하늘 밝기 구간. 해가 지평선 위면 하늘은 낮 그대로다. */
export const SKY_FADE: readonly [number, number] = [-8, 1];
/**
 * 야간 작업등 점등 구간(태양 고도). 5° 아래부터 켜지기 시작해 −5° 에
 * 완전 점등 — 실제 야드가 해 질 무렵 조명을 켜는 것과 같고, 태양 세기가
 * 0 이 되는 −3° 를 안에 품어 인계가 매끄럽다.
 */
export const YARD_LIGHT_FADE: readonly [number, number] = [-5, 2];
/**
 * 작업등 세기 = 낮 태양 세기 × 이 비율(3.6 → 2.16). 낮보다 어둡되 장비가
 * 환하다. 0.45 로 시작했다가 "밤이 너무 어둡다" 피드백으로 올렸다
 * (2026-09-11, 보조 투광등·반구광과 함께).
 */
export const YARD_LIGHT_INTENSITY_RATIO = 0.6;
/** 작업등 색 — 따뜻한 백색 LED/메탈할라이드. */
export const YARD_LIGHT_COLOR: RgbTuple = [1, 0.93, 0.8];
/**
 * 작업등(마스트) 방향 — 고정. 남서쪽 높은 각도라 그림자가 짧게 북동으로
 * 떨어지고 "위에서 비추는" 인상이 난다. 씬에 조명 기구 데이터가 없어 한
 * 방향으로 대표한다.
 */
export const YARD_LIGHT_AZIMUTH = 210;
export const YARD_LIGHT_ELEVATION = 62;
/**
 * 보조 투광등(필 라이트) — 주 마스트의 거의 반대편(북북동), 조금 낮은 각도.
 * 야드에는 마스트가 여럿이라 한 방향 그림자 면이 새까맣지 않다는 사실을
 * 대표한다. 그림자는 만들지 않는다(shadow map 은 주 방향광 하나).
 */
export const FILL_LIGHT_AZIMUTH = 20;
export const FILL_LIGHT_ELEVATION = 50;
/** 보조 투광등 세기 = 주 작업등 세기 × 이 비율. */
export const FILL_LIGHT_INTENSITY_RATIO = 0.5;
/** 밤 반구광 세기 — 작업등 켜짐/꺼짐. */
export const NIGHT_HEMISPHERE_INTENSITY_LIT = 0.55;
export const NIGHT_HEMISPHERE_INTENSITY_DARK = 0.12;
/** 밤 반구광 색 — 위는 하늘 남색, 아래는 조명 받은 바닥의 난색 반사. */
export const NIGHT_HEMISPHERE_SKY_COLOR: RgbTuple = [0.4, 0.5, 0.8];
export const NIGHT_HEMISPHERE_GROUND_COLOR: RgbTuple = [1, 0.86, 0.66];
/**
 * 밤하늘 틴트 — sRGB hex(three Color 가 선형으로 바꾼다). 짙은 남색으로,
 * 어두워진 EXR(회색 구름)이 비쳐 "구름 낀 밤하늘" 이 된다.
 */
export const NIGHT_SKY_TINT_COLOR = '#182040';
export const NIGHT_SKY_TINT_ALPHA = 0.62;
/** 틴트가 오르는 태양 고도 구간 — 4° 아래부터 시작해 −8° 에 완전. */
export const NIGHT_SKY_TINT_FADE: readonly [number, number] = [-8, 4];
/** 천체 표식이 지평선을 넘으며 나타나는 구간. */
export const BODY_VISIBILITY_FADE: readonly [number, number] = [-1, 2];

/**
 * 밤 하늘·환경맵 배율. 0 이면 배경이 검게 꺼져 수평선이 사라진다. 작업등
 * 켜진 야드 위 하늘은 광공해로 완전히 검지 않고, 위에 남색 틴트가 덮이므로
 * 구름 결이 비칠 만큼 남긴다.
 */
export const NIGHT_SKY_INTENSITY = 0.12;
/** 작업등 켜진 밤의 환경광 — 난색, 낮과 거의 같은 세기(그림자 면이 죽지 않게). */
export const NIGHT_AMBIENT_INTENSITY_LIT = 0.85;
export const NIGHT_AMBIENT_COLOR_LIT: RgbTuple = [0.96, 0.92, 0.85];
/** 작업등 끈 밤의 환경광 — 달·별빛 수준의 푸른 바닥값(형체만 남는다). */
export const NIGHT_AMBIENT_INTENSITY_DARK = 0.28;
export const NIGHT_AMBIENT_COLOR_DARK: RgbTuple = [0.55, 0.66, 0.95];
/** 낮 환경광 색 — 기존 화면과 같은 무채색. */
export const DAY_AMBIENT_COLOR: RgbTuple = [1, 1, 1];
/**
 * 지평선 태양 색(노을) → 백색 전환 구간. 노을은 일출·일몰 직후 몇 분에만 —
 * 넓게 잡으면(옛 [0,25]) 오후 내내 누렇게 어두워 보였다.
 */
export const SUN_COLOR_FADE: readonly [number, number] = [-2, 6];
/**
 * 낮 반구광 — 위는 하늘색, 아래는 지면 반사. 그림자 면(태양 반대편)이
 * 새까맣지 않게 하는 낮의 채움광. 수동 모드에는 없고 solar 모드 낮에만.
 */
export const DAY_HEMISPHERE_INTENSITY = 0.45;
export const DAY_HEMISPHERE_SKY_COLOR: RgbTuple = [0.78, 0.87, 1];
export const DAY_HEMISPHERE_GROUND_COLOR: RgbTuple = [0.92, 0.88, 0.8];
/** solar 모드 낮 환경광 배율 — 수동 모드 기준값 대비. "낮은 밝게" 피드백. */
export const DAY_AMBIENT_BOOST = 1.15;
export const SUN_COLOR_HORIZON: RgbTuple = [1, 0.64, 0.38];
export const SUN_COLOR_ZENITH: RgbTuple = [1, 1, 1];

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = clampToRange((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: RgbTuple, b: RgbTuple, t: number): RgbTuple {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/**
 * 잘못된 고도 방어. NaN·무한대는 **낮(90°)** 으로 본다 — 관제 화면이 계산
 * 오류로 캄캄해지는 쪽보다 밝게 남는 쪽이 안전하다.
 */
function sanitizeElevation(value: number): number {
  return Number.isFinite(value) ? clampToRange(value, -90, 90) : 90;
}

export function resolveSkyLighting(
  input: SkyLightingInput,
  base: SkyLightingBase,
  options: SkyLightingOptions = {},
): SkyLighting {
  const sunEl = sanitizeElevation(input.sunElevation);
  const moonEl = sanitizeElevation(input.moonElevation);
  const moonFraction = Number.isFinite(input.moonFraction)
    ? clampToRange(input.moonFraction, 0, 1)
    : 0;
  const yardLights = options.yardLights !== false;

  const daylight = smoothstep(DAYLIGHT_FADE[0], DAYLIGHT_FADE[1], sunEl);
  const skyIntensity =
    NIGHT_SKY_INTENSITY +
    (1 - NIGHT_SKY_INTENSITY) * smoothstep(SKY_FADE[0], SKY_FADE[1], sunEl);

  const sunFactor = smoothstep(SUN_KEY_FADE[0], SUN_KEY_FADE[1], sunEl);
  // 지면 조도 보상(상수 주석). 고도 ≤ 0 은 sin 이 0 이하라 상한으로.
  const sinRef = Math.sin((SUN_COMPENSATION_REF_ELEVATION * Math.PI) / 180);
  const sinEl = Math.sin((Math.max(sunEl, 0.01) * Math.PI) / 180);
  const compensation = clampToRange(sinRef / sinEl, 1, SUN_COMPENSATION_MAX);
  const sunIntensity = base.sunIntensity * sunFactor * compensation;
  const sunColor = lerpRgb(
    SUN_COLOR_HORIZON,
    SUN_COLOR_ZENITH,
    smoothstep(SUN_COLOR_FADE[0], SUN_COLOR_FADE[1], sunEl),
  );

  // 작업등 — 해가 지평선에 가까워지면 켜지기 시작한다(점등 곡선).
  const yardOn = yardLights
    ? 1 - smoothstep(YARD_LIGHT_FADE[0], YARD_LIGHT_FADE[1], sunEl)
    : 0;
  const yardIntensity = base.sunIntensity * YARD_LIGHT_INTENSITY_RATIO * yardOn;

  const keyIntensity = sunIntensity + yardIntensity;
  // 세기 가중 혼합. 둘 다 0(작업등 끈 깊은 밤)이면 방향은 마스트 쪽(1)로
  // 두어 그림자 방향이 태양 쪽으로 되돌아가지 않게 한다.
  const keyYardBlend =
    keyIntensity > 0 ? yardIntensity / keyIntensity : sunFactor > 0 ? 0 : 1;
  const keyColor = lerpRgb(sunColor, YARD_LIGHT_COLOR, keyYardBlend);

  // 환경광 — 밤 값은 작업등 점등 정도로 어두운 밤(푸른 바닥값)과 밝은 밤
  // (난색)을 섞고, 그 값과 낮 값을 daylight 로 잇는다.
  const nightAmbientIntensity = lerp(
    NIGHT_AMBIENT_INTENSITY_DARK,
    NIGHT_AMBIENT_INTENSITY_LIT,
    yardOn,
  );
  const nightAmbientColor = lerpRgb(
    NIGHT_AMBIENT_COLOR_DARK,
    NIGHT_AMBIENT_COLOR_LIT,
    yardOn,
  );
  const ambientIntensity = lerp(
    nightAmbientIntensity,
    base.ambientIntensity * DAY_AMBIENT_BOOST,
    daylight,
  );
  const ambientColor = lerpRgb(nightAmbientColor, DAY_AMBIENT_COLOR, daylight);

  // 보조 투광등·하늘 틴트는 밤에만. 반구광은 밤(작업등/달빛)과 낮(하늘·
  // 지면 채움) 값을 daylight 로 잇는다.
  const fillIntensity = yardIntensity * FILL_LIGHT_INTENSITY_RATIO;
  const nightHemisphere = lerp(
    NIGHT_HEMISPHERE_INTENSITY_DARK,
    NIGHT_HEMISPHERE_INTENSITY_LIT,
    yardOn,
  );
  const hemisphereIntensity = lerp(
    nightHemisphere,
    DAY_HEMISPHERE_INTENSITY,
    daylight,
  );
  const nightHemisphereGround = lerpRgb(
    NIGHT_AMBIENT_COLOR_DARK,
    NIGHT_HEMISPHERE_GROUND_COLOR,
    yardOn,
  );
  const hemisphereSkyColor = lerpRgb(
    NIGHT_HEMISPHERE_SKY_COLOR,
    DAY_HEMISPHERE_SKY_COLOR,
    daylight,
  );
  const hemisphereGroundColor = lerpRgb(
    nightHemisphereGround,
    DAY_HEMISPHERE_GROUND_COLOR,
    daylight,
  );
  const skyTintOpacity =
    NIGHT_SKY_TINT_ALPHA *
    (1 - smoothstep(NIGHT_SKY_TINT_FADE[0], NIGHT_SKY_TINT_FADE[1], sunEl));

  const sunVisibility = smoothstep(
    BODY_VISIBILITY_FADE[0],
    BODY_VISIBILITY_FADE[1],
    sunEl,
  );
  // 달은 낮에도 희미하게 보이되 밤에 또렷하고, 삭에 가까울수록 옅다.
  const moonVisibility =
    smoothstep(BODY_VISIBILITY_FADE[0], BODY_VISIBILITY_FADE[1], moonEl) *
    (0.25 + 0.75 * (1 - daylight)) *
    (0.3 + 0.7 * moonFraction);

  return {
    daylight,
    skyIntensity,
    sunIntensity,
    yardIntensity,
    keyIntensity,
    keyColor,
    keyYardBlend,
    ambientIntensity,
    ambientColor,
    fillIntensity,
    fillColor: YARD_LIGHT_COLOR,
    hemisphereIntensity,
    hemisphereSkyColor,
    hemisphereGroundColor,
    skyTintOpacity,
    sunVisibility,
    moonVisibility,
  };
}

/** 낮/새벽/황혼/밤 — UI 아이콘·문구용. */
export type SkyPhase = 'day' | 'dawn' | 'dusk' | 'night';

/** 낮 판정 고도(도). 이 위는 낮, DAYLIGHT_FADE 하한 아래는 밤, 사이는 박명. */
export const SKY_PHASE_DAY_ELEVATION = 6;

/**
 * 박명은 태양 방위로 새벽/황혼을 가른다 — 동쪽 하늘(방위 < 180°)에
 * 있으면 뜨는 중이다.
 */
export function classifySkyPhase(
  sunElevation: number,
  sunAzimuth: number,
): SkyPhase {
  const el = sanitizeElevation(sunElevation);
  if (el >= SKY_PHASE_DAY_ELEVATION) return 'day';
  if (el < DAYLIGHT_FADE[0]) return 'night';
  const az = Number.isFinite(sunAzimuth) ? ((sunAzimuth % 360) + 360) % 360 : 0;
  return az < 180 ? 'dawn' : 'dusk';
}
