/**
 * 태양·달 위치 — 시각(UTC epoch)과 위경도로 방위·고도를 구한다.
 *
 * 3D 씬의 낮/밤 표현(scene-render-preset.tsx `SceneLighting` 의 solar 모드)이
 * 이 값으로 조명 방향·세기·하늘 밝기를 정한다. 정밀 천체력(VSOP·ELP)이
 * 아니라 저차 근사(Meeus 의 축약식 — 태양 ±0.3°, 달 ±1° 수준)다. 그림자
 * 방향과 낮/밤 전환을 보여주는 데는 충분하고, 항법·측량 용도가 아니다.
 *
 * 의존성 0 — three 도 React 도 쓰지 않는다. 라디안·도 변환은 여기서 끝내고
 * 밖에는 **도(deg) 나침반 방위(0=북·90=동, SavedLightingInfo 규약)** 로
 * 돌려준다. 호출자가 sunDirectionFromAngles 에 그대로 넣을 수 있게 하기
 * 위해서다.
 */

export interface CelestialPosition {
  /** 나침반 방위(도, [0,360)). 0=북, 90=동, 180=남, 270=서. */
  azimuth: number;
  /** 지평선 기준 고도(도, [-90, 90]). 음수 = 지평선 아래. */
  elevation: number;
}

export interface MoonPosition extends CelestialPosition {
  /** 지구 중심 거리(km). */
  distanceKm: number;
}

export interface MoonIllumination {
  /** 조명 비율 0(삭)~1(망). */
  fraction: number;
  /** 위상 0(삭)→0.25(상현)→0.5(망)→0.75(하현)→1. */
  phase: number;
}

export interface SunDayEvents {
  /** 일출 UTC epoch(ms). 그날 뜨지 않으면 null(극야·백야). */
  sunrise: number | null;
  /** 일몰 UTC epoch(ms). */
  sunset: number | null;
  /** 남중(고도 최대) 시각. */
  solarNoon: number;
  /** 남중 고도(도). */
  noonElevation: number;
}

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
// J2000.0(2000-01-01 12:00 UT) 기준 일수로 바꾸는 상수.
const J1970 = 2_440_588;
const J2000 = 2_451_545;
/** 황도 경사. */
const OBLIQUITY = RAD * 23.4397;
/** 태양 평균 거리(km) — 달 위상 계산용. */
const SUN_DISTANCE_KM = 149_598_000;
/**
 * 일출·일몰 판정 고도(도). 대기 굴절(0.57°)과 태양 반지름(0.27°)을 합친
 * 관례값 — 태양 윗가장자리가 지평선에 걸리는 순간.
 */
export const SUN_HORIZON_ELEVATION = -0.833;

function toDays(timeMs: number): number {
  return timeMs / DAY_MS - 0.5 + J1970 - J2000;
}

function rightAscension(l: number, b: number): number {
  return Math.atan2(
    Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY),
    Math.cos(l),
  );
}

function declination(l: number, b: number): number {
  return Math.asin(
    Math.sin(b) * Math.cos(OBLIQUITY) +
      Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l),
  );
}

/** 남쪽 기준·서쪽 양수(라디안). 호출자가 나침반 방위로 바꾼다. */
function azimuthFromSouth(H: number, phi: number, dec: number): number {
  return Math.atan2(
    Math.sin(H),
    Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi),
  );
}

function altitude(H: number, phi: number, dec: number): number {
  return Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H),
  );
}

function siderealTime(d: number, lw: number): number {
  return RAD * (280.16 + 360.9856235 * d) - lw;
}

function sunCoords(d: number): { dec: number; ra: number } {
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C =
    RAD *
    (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = RAD * 102.9372;
  const L = M + C + P + Math.PI;
  return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}

function moonCoords(d: number): { dec: number; ra: number; dist: number } {
  const L = RAD * (218.316 + 13.176396 * d);
  const M = RAD * (134.963 + 13.064993 * d);
  const F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M);
  const b = RAD * 5.128 * Math.sin(F);
  const dist = 385_001 - 20_905 * Math.cos(M);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist };
}

function toCompassDegrees(azimuthFromSouthRad: number): number {
  const deg = azimuthFromSouthRad / RAD + 180;
  return ((deg % 360) + 360) % 360;
}

function isValidGeo(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

/** 태양 위치. 입력이 유효하지 않으면 null. */
export function computeSunPosition(
  timeMs: number,
  latitude: number,
  longitude: number,
): CelestialPosition | null {
  if (!Number.isFinite(timeMs) || !isValidGeo(latitude, longitude)) {
    return null;
  }
  const lw = RAD * -longitude;
  const phi = RAD * latitude;
  const d = toDays(timeMs);
  const c = sunCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  return {
    azimuth: toCompassDegrees(azimuthFromSouth(H, phi, c.dec)),
    elevation: altitude(H, phi, c.dec) / RAD,
  };
}

/** 달 위치. 입력이 유효하지 않으면 null. */
export function computeMoonPosition(
  timeMs: number,
  latitude: number,
  longitude: number,
): MoonPosition | null {
  if (!Number.isFinite(timeMs) || !isValidGeo(latitude, longitude)) {
    return null;
  }
  const lw = RAD * -longitude;
  const phi = RAD * latitude;
  const d = toDays(timeMs);
  const c = moonCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  const h = altitude(H, phi, c.dec);
  return {
    azimuth: toCompassDegrees(azimuthFromSouth(H, phi, c.dec)),
    elevation: h / RAD,
    distanceKm: c.dist,
  };
}

/** 달 조명 비율·위상. 위치와 무관(지구 중심 기준). */
export function computeMoonIllumination(timeMs: number): MoonIllumination {
  if (!Number.isFinite(timeMs)) {
    return { fraction: 0, phase: 0 };
  }
  const d = toDays(timeMs);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const phi = Math.acos(
    Math.sin(s.dec) * Math.sin(m.dec) +
      Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra),
  );
  const inc = Math.atan2(
    SUN_DISTANCE_KM * Math.sin(phi),
    m.dist - SUN_DISTANCE_KM * Math.cos(phi),
  );
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) -
      Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra),
  );
  return {
    fraction: (1 + Math.cos(inc)) / 2,
    phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI,
  };
}

/**
 * 하루(dayStartMs 부터 24h)의 일출·일몰·남중. 시각 슬라이더의 프리셋
 * (일출/정오/일몰)이 쓴다.
 *
 * 해석적 공식 대신 **1분 간격 스캔 + 이분법**이다 — 하루 1440 회 계산은
 * 무시할 비용이고, 극지방 백야·극야(교차 없음)를 자연스럽게 null 로 낸다.
 * 정밀도는 초 단위(이분법 12회 → 1440min/2^12 ≈ 21s).
 */
export function computeSunDayEvents(
  dayStartMs: number,
  latitude: number,
  longitude: number,
): SunDayEvents | null {
  if (!Number.isFinite(dayStartMs) || !isValidGeo(latitude, longitude)) {
    return null;
  }
  const MINUTE = 60_000;
  const elevationAt = (ms: number) =>
    computeSunPosition(ms, latitude, longitude)?.elevation ?? Number.NaN;

  let sunrise: number | null = null;
  let sunset: number | null = null;
  let solarNoon = dayStartMs;
  let noonElevation = Number.NEGATIVE_INFINITY;

  let prevMs = dayStartMs;
  let prev = elevationAt(prevMs);
  if (prev > noonElevation) {
    noonElevation = prev;
    solarNoon = prevMs;
  }
  for (let i = 1; i <= 1440; i += 1) {
    const ms = dayStartMs + i * MINUTE;
    const el = elevationAt(ms);
    if (el > noonElevation) {
      noonElevation = el;
      solarNoon = ms;
    }
    const wasBelow = prev < SUN_HORIZON_ELEVATION;
    const isBelow = el < SUN_HORIZON_ELEVATION;
    if (wasBelow !== isBelow) {
      // 교차 구간을 이분법으로 좁힌다.
      let lo = prevMs;
      let hi = ms;
      for (let k = 0; k < 12; k += 1) {
        const mid = (lo + hi) / 2;
        if (elevationAt(mid) < SUN_HORIZON_ELEVATION === wasBelow) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      const crossing = Math.round((lo + hi) / 2);
      if (wasBelow && sunrise === null) sunrise = crossing;
      if (!wasBelow && sunset === null) sunset = crossing;
    }
    prevMs = ms;
    prev = el;
  }

  return { sunrise, sunset, solarNoon, noonElevation };
}
