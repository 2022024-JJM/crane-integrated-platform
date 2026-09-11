import { describe, expect, it } from 'vitest';
import {
  SUN_HORIZON_ELEVATION,
  computeMoonIllumination,
  computeMoonPosition,
  computeSunDayEvents,
  computeSunPosition,
} from '../solar-position';

// 한화오션 거제 옥포 / 필리 조선소 — scene-site-geo 와 같은 좌표.
const GEOJE = { lat: 34.872, lon: 128.696 };
const PHILLY = { lat: 39.8895, lon: -75.1827 };

describe('computeSunPosition', () => {
  it('필라델피아 하지 남중 — 고도 ≈ 90° − 위도 + 23.44°, 방위 ≈ 남', () => {
    // 남중 ≈ 13:02 EDT = 17:02 UTC (경도 보정 +0.7min, 균시차 −1.5min).
    const noon = Date.UTC(2026, 5, 21, 17, 2, 0);
    const pos = computeSunPosition(noon, PHILLY.lat, PHILLY.lon);
    expect(pos).not.toBeNull();
    expect(pos!.elevation).toBeCloseTo(90 - PHILLY.lat + 23.44, 0);
    expect(Math.abs(pos!.azimuth - 180)).toBeLessThan(2);
  });

  it('거제 동지 남중 — 고도 ≈ 90° − 위도 − 23.44°', () => {
    // 남중 ≈ 12:23 KST = 03:23 UTC (경도 보정 +25min, 균시차 +2min).
    const noon = Date.UTC(2026, 11, 21, 3, 23, 0);
    const pos = computeSunPosition(noon, GEOJE.lat, GEOJE.lon);
    expect(pos!.elevation).toBeCloseTo(90 - GEOJE.lat - 23.44, 0);
    expect(Math.abs(pos!.azimuth - 180)).toBeLessThan(2);
  });

  it('자정에는 지평선 아래 — 밤이다', () => {
    // 거제 여름 자정 = 15:00 UTC. 남중 고도의 음수 근처(-31°).
    const midnight = Date.UTC(2026, 5, 21, 15, 0, 0);
    const pos = computeSunPosition(midnight, GEOJE.lat, GEOJE.lon);
    expect(pos!.elevation).toBeLessThan(-25);
  });

  it('춘분엔 정동에서 떠 정서로 진다', () => {
    const events = computeSunDayEvents(
      Date.UTC(2026, 2, 19, 15, 0, 0), // 거제 3/20 자정
      GEOJE.lat,
      GEOJE.lon,
    );
    expect(events?.sunrise).not.toBeNull();
    expect(events?.sunset).not.toBeNull();
    const rise = computeSunPosition(events!.sunrise!, GEOJE.lat, GEOJE.lon);
    const set = computeSunPosition(events!.sunset!, GEOJE.lat, GEOJE.lon);
    expect(Math.abs(rise!.azimuth - 90)).toBeLessThan(3);
    expect(Math.abs(set!.azimuth - 270)).toBeLessThan(3);
  });

  it('방위는 [0, 360) 안에서 하루 동안 동→남→서로 돈다 (북반구)', () => {
    const dayStart = Date.UTC(2026, 8, 10, 15, 0, 0); // 거제 9/11 자정
    const morning = computeSunPosition(
      dayStart + 8 * 3_600_000,
      GEOJE.lat,
      GEOJE.lon,
    )!;
    const afternoon = computeSunPosition(
      dayStart + 16 * 3_600_000,
      GEOJE.lat,
      GEOJE.lon,
    )!;
    expect(morning.azimuth).toBeGreaterThan(60);
    expect(morning.azimuth).toBeLessThan(180);
    expect(afternoon.azimuth).toBeGreaterThan(180);
    expect(afternoon.azimuth).toBeLessThan(300);
    for (const p of [morning, afternoon]) {
      expect(p.azimuth).toBeGreaterThanOrEqual(0);
      expect(p.azimuth).toBeLessThan(360);
      expect(Math.abs(p.elevation)).toBeLessThanOrEqual(90);
    }
  });

  it('잘못된 입력은 null — NaN 시각, 범위 밖 위경도', () => {
    expect(computeSunPosition(Number.NaN, 0, 0)).toBeNull();
    expect(computeSunPosition(0, 91, 0)).toBeNull();
    expect(computeSunPosition(0, 0, -181)).toBeNull();
    expect(computeSunPosition(0, Number.POSITIVE_INFINITY, 0)).toBeNull();
  });
});

describe('computeMoonIllumination', () => {
  it('망(2026-01-03) 은 ≈1, 삭(2026-01-18) 은 ≈0', () => {
    const full = computeMoonIllumination(Date.UTC(2026, 0, 3, 10, 0, 0));
    expect(full.fraction).toBeGreaterThan(0.97);
    expect(Math.abs(full.phase - 0.5)).toBeLessThan(0.03);

    const newMoon = computeMoonIllumination(Date.UTC(2026, 0, 18, 20, 0, 0));
    expect(newMoon.fraction).toBeLessThan(0.03);
    // 삭은 0 또는 1 근처 — 랩 경계.
    expect(Math.min(newMoon.phase, 1 - newMoon.phase)).toBeLessThan(0.03);
  });

  it('상현(2026-01-26) 은 ≈0.5', () => {
    const quarter = computeMoonIllumination(Date.UTC(2026, 0, 26, 5, 0, 0));
    expect(quarter.fraction).toBeGreaterThan(0.4);
    expect(quarter.fraction).toBeLessThan(0.6);
  });

  it('NaN 시각은 0/0', () => {
    expect(computeMoonIllumination(Number.NaN)).toEqual({
      fraction: 0,
      phase: 0,
    });
  });
});

describe('computeMoonPosition', () => {
  it('망의 밤엔 달이 높이 떠 있고 해는 지평선 아래', () => {
    // 2026-01-03 거제 자정 = 01-02 15:00 UTC (망 10:03 UTC 로부터 5h).
    const midnight = Date.UTC(2026, 0, 3, 15, 0, 0);
    const moon = computeMoonPosition(midnight, GEOJE.lat, GEOJE.lon)!;
    const sun = computeSunPosition(midnight, GEOJE.lat, GEOJE.lon)!;
    expect(moon.elevation).toBeGreaterThan(40);
    expect(sun.elevation).toBeLessThan(-40);
    expect(moon.distanceKm).toBeGreaterThan(356_000);
    expect(moon.distanceKm).toBeLessThan(407_000);
  });

  it('잘못된 입력은 null', () => {
    expect(computeMoonPosition(Number.NaN, 0, 0)).toBeNull();
    expect(computeMoonPosition(0, 0, 999)).toBeNull();
  });
});

describe('computeSunDayEvents', () => {
  it('거제 하지 — 일출 ≈05:10 KST, 일몰 ≈19:40 KST, 남중 고도 ≈78.5°', () => {
    const dayStart = Date.UTC(2026, 5, 20, 15, 0, 0); // 6/21 00:00 KST
    const events = computeSunDayEvents(dayStart, GEOJE.lat, GEOJE.lon)!;
    const kst = (ms: number) => (ms - dayStart) / 3_600_000;
    expect(kst(events.sunrise!)).toBeGreaterThan(4.9);
    expect(kst(events.sunrise!)).toBeLessThan(5.4);
    expect(kst(events.sunset!)).toBeGreaterThan(19.4);
    expect(kst(events.sunset!)).toBeLessThan(19.9);
    expect(events.noonElevation).toBeCloseTo(90 - GEOJE.lat + 23.44, 0);
    expect(events.solarNoon).toBeGreaterThan(events.sunrise!);
    expect(events.solarNoon).toBeLessThan(events.sunset!);
  });

  it('일출·일몰 시각의 고도는 판정 고도(-0.833°)에 초 단위로 붙는다', () => {
    const dayStart = Date.UTC(2026, 8, 10, 15, 0, 0);
    const events = computeSunDayEvents(dayStart, GEOJE.lat, GEOJE.lon)!;
    for (const ms of [events.sunrise!, events.sunset!]) {
      const el = computeSunPosition(ms, GEOJE.lat, GEOJE.lon)!.elevation;
      expect(Math.abs(el - SUN_HORIZON_ELEVATION)).toBeLessThan(0.02);
    }
  });

  it('극야(북위 80° 12월)엔 일출·일몰이 null 이고 남중 고도는 음수', () => {
    const dayStart = Date.UTC(2026, 11, 21, 0, 0, 0);
    const events = computeSunDayEvents(dayStart, 80, 0)!;
    expect(events.sunrise).toBeNull();
    expect(events.sunset).toBeNull();
    expect(events.noonElevation).toBeLessThan(0);
  });

  it('백야(북위 80° 6월)엔 일출·일몰이 null 이고 남중 고도는 양수', () => {
    const dayStart = Date.UTC(2026, 5, 21, 0, 0, 0);
    const events = computeSunDayEvents(dayStart, 80, 0)!;
    expect(events.sunrise).toBeNull();
    expect(events.sunset).toBeNull();
    expect(events.noonElevation).toBeGreaterThan(0);
  });

  it('잘못된 입력은 null', () => {
    expect(computeSunDayEvents(Number.NaN, 0, 0)).toBeNull();
    expect(computeSunDayEvents(0, 100, 0)).toBeNull();
  });
});
