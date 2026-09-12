import { describe, expect, it } from 'vitest';
import {
  CELESTIAL_ANGLE_STEP,
  KEY_LIGHT_ELEVATION_MIN,
  quantizeAngle,
  resolveSolarLighting,
} from '../solar-lighting';
import {
  SCENE_LIGHTING_BASE,
  YARD_LIGHT_AZIMUTH,
  YARD_LIGHT_ELEVATION,
} from '../sky-lighting';

const GEOJE = { latitude: 34.872, longitude: 128.696 };
const PHILLY = { latitude: 39.8895, longitude: -75.1827 };

describe('quantizeAngle', () => {
  it('기본 단위(0.05°)로 반올림한다', () => {
    expect(quantizeAngle(123.4567)).toBeCloseTo(123.45, 10);
    expect(quantizeAngle(123.476)).toBeCloseTo(123.5, 10);
    expect(quantizeAngle(0.024)).toBe(0);
  });

  it('단위 정확값은 그대로', () => {
    expect(quantizeAngle(10)).toBe(10);
    expect(quantizeAngle(CELESTIAL_ANGLE_STEP * 7)).toBeCloseTo(0.35, 12);
  });

  it('NaN·0 이하 단위는 손대지 않는다', () => {
    expect(quantizeAngle(Number.NaN)).toBeNaN();
    expect(quantizeAngle(1.234, 0)).toBe(1.234);
    expect(quantizeAngle(1.234, -1)).toBe(1.234);
  });
});

describe('resolveSolarLighting', () => {
  it('필리 한낮 — 태양이 방향광, 낮 위상, 방향광 고도 ≈ 실제 태양 고도', () => {
    const noon = Date.UTC(2026, 5, 21, 17, 2, 0);
    const snap = resolveSolarLighting(noon, PHILLY, SCENE_LIGHTING_BASE)!;
    expect(snap.sky.keyYardBlend).toBe(0);
    expect(snap.phase).toBe('day');
    expect(snap.keyElevation).toBeCloseTo(snap.sun.elevation, 1);
    expect(snap.keyAzimuth).toBeCloseTo(snap.sun.azimuth, 1);
    // 태양 고도 73.5° — 기준(78.7°)보다 낮아 지면 조도 보상이 조금 붙는다.
    expect(snap.sky.keyIntensity).toBeGreaterThanOrEqual(
      SCENE_LIGHTING_BASE.sunIntensity,
    );
    expect(snap.sky.keyIntensity).toBeLessThan(
      SCENE_LIGHTING_BASE.sunIntensity * 1.1,
    );
  });

  it('거제 한밤 — 밤 위상, 방향광은 작업등 마스트 방향, 하늘 바닥값', () => {
    const midnight = Date.UTC(2026, 5, 21, 15, 0, 0);
    const snap = resolveSolarLighting(midnight, GEOJE, SCENE_LIGHTING_BASE)!;
    expect(snap.phase).toBe('night');
    expect(snap.sky.keyYardBlend).toBe(1);
    expect(snap.sky.daylight).toBe(0);
    expect(snap.sun.elevation).toBeLessThan(-20);
    expect(snap.keyAzimuth).toBeCloseTo(YARD_LIGHT_AZIMUTH, 1);
    expect(snap.keyElevation).toBeCloseTo(YARD_LIGHT_ELEVATION, 1);
  });

  it('작업등을 끈 밤도 방향은 마스트 쪽이고 세기만 0 이다', () => {
    const midnight = Date.UTC(2026, 5, 21, 15, 0, 0);
    const snap = resolveSolarLighting(midnight, GEOJE, SCENE_LIGHTING_BASE, {
      yardLights: false,
    })!;
    expect(snap.sky.keyIntensity).toBe(0);
    expect(snap.keyAzimuth).toBeCloseTo(YARD_LIGHT_AZIMUTH, 1);
    expect(snap.keyElevation).toBeCloseTo(YARD_LIGHT_ELEVATION, 1);
  });

  it('박명엔 방향광이 태양과 마스트 사이를 매끄럽게 돈다 (1분 간격 최대 변화 < 8°)', () => {
    // 거제 9/11 일몰(18:39 KST) 앞뒤 2시간을 1분 간격으로 훑는다.
    const start = Date.UTC(2026, 8, 11, 8, 40, 0);
    let prev = resolveSolarLighting(start, GEOJE, SCENE_LIGHTING_BASE)!;
    for (let m = 1; m <= 120; m += 1) {
      const cur = resolveSolarLighting(
        start + m * 60_000,
        GEOJE,
        SCENE_LIGHTING_BASE,
      )!;
      const dAz = Math.abs(
        ((cur.keyAzimuth - prev.keyAzimuth + 540) % 360) - 180,
      );
      expect(dAz).toBeLessThan(8);
      expect(Math.abs(cur.keyElevation - prev.keyElevation)).toBeLessThan(8);
      prev = cur;
    }
    // 끝(20:40 KST)엔 마스트 방향에 도달해 있다.
    expect(prev.keyAzimuth).toBeCloseTo(YARD_LIGHT_AZIMUTH, 0);
    expect(prev.keyElevation).toBeCloseTo(YARD_LIGHT_ELEVATION, 0);
  });

  it('방향광 고도는 KEY_LIGHT_ELEVATION_MIN 아래로 내려가지 않는다', () => {
    // 일몰 직후 — 태양 고도 −1° 근처. 세기는 남아 있지만 방향은 클램프.
    const dayStart = Date.UTC(2026, 8, 10, 15, 0, 0);
    let found = false;
    for (let m = 0; m < 1440; m += 5) {
      const snap = resolveSolarLighting(
        dayStart + m * 60_000,
        GEOJE,
        SCENE_LIGHTING_BASE,
      )!;
      expect(snap.keyElevation).toBeGreaterThanOrEqual(
        KEY_LIGHT_ELEVATION_MIN - 1e-9,
      );
      expect(snap.keyElevation).toBeLessThanOrEqual(90);
      expect(snap.keyAzimuth).toBeGreaterThanOrEqual(0);
      expect(snap.keyAzimuth).toBeLessThan(360);
      if (
        snap.sky.keyYardBlend === 0 &&
        snap.sun.elevation < KEY_LIGHT_ELEVATION_MIN
      ) {
        found = true;
        expect(snap.keyElevation).toBe(KEY_LIGHT_ELEVATION_MIN);
      }
    }
    expect(found).toBe(true);
  });

  it('방위·고도는 CELESTIAL_ANGLE_STEP 격자 위에 있다', () => {
    const snap = resolveSolarLighting(
      Date.UTC(2026, 8, 11, 2, 17, 33),
      GEOJE,
      SCENE_LIGHTING_BASE,
    )!;
    const onGrid = (v: number) =>
      Math.abs(v / CELESTIAL_ANGLE_STEP - Math.round(v / CELESTIAL_ANGLE_STEP));
    expect(onGrid(snap.keyAzimuth)).toBeLessThan(1e-9);
    expect(onGrid(snap.keyElevation)).toBeLessThan(1e-9);
  });

  it('초 단위로 이어지는 시각의 방향광 각도는 격자 덕에 대부분 비트 일치한다 (shadow 재렌더 억제 근거)', () => {
    // 10초 동안 태양은 0.04° 움직인다 — 0.05° 격자에서 값이 바뀌는 순간은
    // 많아야 한 번이므로 서로 다른 값은 2개 이하다(양자화 없이는 10개).
    const t = Date.UTC(2026, 8, 11, 2, 0, 0);
    const azimuths = new Set<number>();
    const elevations = new Set<number>();
    for (let sec = 0; sec < 10; sec += 1) {
      const snap = resolveSolarLighting(
        t + sec * 1000,
        GEOJE,
        SCENE_LIGHTING_BASE,
      )!;
      azimuths.add(snap.keyAzimuth);
      elevations.add(snap.keyElevation);
    }
    expect(azimuths.size).toBeLessThanOrEqual(2);
    expect(elevations.size).toBeLessThanOrEqual(2);
  });

  it('잘못된 시각·위경도는 null', () => {
    expect(
      resolveSolarLighting(Number.NaN, GEOJE, SCENE_LIGHTING_BASE),
    ).toBeNull();
    expect(
      resolveSolarLighting(
        0,
        { latitude: 95, longitude: 0 },
        SCENE_LIGHTING_BASE,
      ),
    ).toBeNull();
  });
});
