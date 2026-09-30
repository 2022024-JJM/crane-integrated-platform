import {
  bearingToWorldAzimuth,
  computeMoonIllumination,
  computeMoonPosition,
  computeSunPosition,
  SCENE_TRUE_NORTH_DEFAULT,
  type CelestialPosition,
  type MoonIllumination,
  type MoonPosition,
  type SceneSiteGeo,
} from '@crane/domain/3d';
import { clampToRange } from '@crane/core/lib/utils';
import {
  YARD_LIGHT_AZIMUTH,
  YARD_LIGHT_ELEVATION,
  classifySkyPhase,
  resolveSkyLighting,
  type SkyLighting,
  type SkyLightingBase,
  type SkyLightingOptions,
  type SkyPhase,
} from './sky-lighting';

/**
 * 시각 + 현장 위치 → 그 순간의 조명 스냅샷. 천문(domain solar-position)과
 * 조명 곡선(sky-lighting)을 합쳐 SceneLighting·UI 가 같은 답을 보게 하는
 * 단일 진입점이다.
 */

/**
 * 방향광이 따라갈 천체 고도의 하한(도). 낮게 잡을수록 그림자가 길어지는데
 * 10° 는 물체 높이의 5.7배 — 시점 추종 shadow frustum(scene-render-preset)
 * 이 잘림 없이 감당하는 선이다. 수동 패드 하한 SCENE_SUN_ELEVATION_MIN(20°)
 * 보다 낮은 이유: 수동은 사용자가 고르는 값이라 보수적으로 두고, solar 는
 * 실제 일출·일몰의 긴 그림자를 어느 정도 보여주기 위해서다. 세기는 이와
 * 무관하게 실제 고도 곡선(SUN_KEY_FADE)을 따라 0 으로 내려간다.
 */
export const KEY_LIGHT_ELEVATION_MIN = 10;
/**
 * 천체 방위·고도 양자화 단위(도). 태양은 0.05° 를 약 12초에 움직인다 —
 * 이 단위로 자르면 정지 화면에서 방향이 매 프레임 미세하게 달라져 shadow
 * map 을 계속 다시 그리는 일이 없고(SceneLighting 의 "달라진 프레임에만
 * 쓰기" 판정이 비트 일치에 기댄다), 0.05° 는 화면에서 구분되지 않는다.
 */
export const CELESTIAL_ANGLE_STEP = 0.05;

export interface SolarLightingSnapshot {
  timeMs: number;
  sun: CelestialPosition;
  moon: MoonPosition;
  moonIllumination: MoonIllumination;
  sky: SkyLighting;
  phase: SkyPhase;
  /**
   * 방향광이 향할 **월드** 방위·고도(도). 태양 방향(진북만큼 돌린 뒤
   * KEY_LIGHT_ELEVATION_MIN 클램프)과 작업등 마스트 방향(월드 고정)을 세기
   * 비율(sky.keyYardBlend)로 섞은 뒤 CELESTIAL_ANGLE_STEP 로 양자화한 값 —
   * sunDirectionFromAngles 에 그대로 넣는다(고도가 이미 하한 이상이라
   * 재클램프는 무해). `sun`·`moon` 의 방위는 지리 방위 그대로다.
   */
  keyAzimuth: number;
  keyElevation: number;
}

type Vec3 = readonly [number, number, number];

/** 월드 방위·고도(도) → 단위 벡터. sun-direction.ts 와 같은 규약(0 = −Z, 90 = +X). */
function directionFromAngles(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = azimuthDeg * (Math.PI / 180);
  const el = elevationDeg * (Math.PI / 180);
  const cosEl = Math.cos(el);
  return [Math.sin(az) * cosEl, Math.sin(el), -Math.cos(az) * cosEl];
}

/** 단위 벡터 → 방위·고도(도). directionFromAngles 의 역. */
function anglesFromDirection(v: Vec3): { azimuth: number; elevation: number } {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  const elevation =
    Math.asin(clampToRange(v[1] / len, -1, 1)) * (180 / Math.PI);
  const azimuth = Math.atan2(v[0], -v[2]) * (180 / Math.PI);
  return { azimuth: ((azimuth % 360) + 360) % 360, elevation };
}

export function quantizeAngle(
  deg: number,
  step: number = CELESTIAL_ANGLE_STEP,
): number {
  if (!Number.isFinite(deg) || !(step > 0)) return deg;
  return Math.round(deg / step) * step;
}

export interface SolarLightingOptions extends SkyLightingOptions {
  /**
   * 씬의 진북(월드 방위, 도 — resolveTrueNorth). 태양을 방향광 월드 방향으로
   * 바꿀 때만 쓴다. 작업등 마스트 방향은 씬 연출값이라 돌리지 않는다.
   * 기본 SCENE_TRUE_NORTH_DEFAULT(−Z 가 북).
   */
  trueNorth?: number;
}

export function resolveSolarLighting(
  timeMs: number,
  geo: Pick<SceneSiteGeo, 'latitude' | 'longitude'>,
  base: SkyLightingBase,
  options: SolarLightingOptions = {},
): SolarLightingSnapshot | null {
  const { trueNorth: rawTrueNorth, ...skyOptions } = options;
  // 비유한 진북은 기본값으로 — 그대로 더하면 방위가 0(북)으로 굳는다.
  const trueNorth =
    typeof rawTrueNorth === 'number' && Number.isFinite(rawTrueNorth)
      ? rawTrueNorth
      : SCENE_TRUE_NORTH_DEFAULT;
  const sun = computeSunPosition(timeMs, geo.latitude, geo.longitude);
  const moon = computeMoonPosition(timeMs, geo.latitude, geo.longitude);
  if (!sun || !moon) return null;
  const moonIllumination = computeMoonIllumination(timeMs);
  const sky = resolveSkyLighting(
    {
      sunElevation: sun.elevation,
      moonElevation: moon.elevation,
      moonFraction: moonIllumination.fraction,
    },
    base,
    skyOptions,
  );

  // 방향광 방향 — 태양(고도 하한 클램프)과 마스트 방향을 세기 비율로 섞는다.
  // 두 벡터 모두 고도 ≥ KEY_LIGHT_ELEVATION_MIN 이라 합이 0 이 되지 않는다.
  const sunDir = directionFromAngles(
    bearingToWorldAzimuth(sun.azimuth, trueNorth),
    clampToRange(sun.elevation, KEY_LIGHT_ELEVATION_MIN, 90),
  );
  const yardDir = directionFromAngles(YARD_LIGHT_AZIMUTH, YARD_LIGHT_ELEVATION);
  const w = sky.keyYardBlend;
  const key = anglesFromDirection([
    sunDir[0] * (1 - w) + yardDir[0] * w,
    sunDir[1] * (1 - w) + yardDir[1] * w,
    sunDir[2] * (1 - w) + yardDir[2] * w,
  ]);
  const azimuth = quantizeAngle(key.azimuth);
  return {
    timeMs,
    sun,
    moon,
    moonIllumination,
    sky,
    phase: classifySkyPhase(sun.elevation, sun.azimuth),
    keyAzimuth: ((azimuth % 360) + 360) % 360,
    keyElevation: quantizeAngle(
      clampToRange(key.elevation, KEY_LIGHT_ELEVATION_MIN, 90),
    ),
  };
}
