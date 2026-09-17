import { describe, expect, it } from 'vitest';
import {
  markerPercent,
  markerSeekLeadMs,
  msAtFraction,
  sparklinePath,
  timelineAxisMs,
  timelineTicks,
} from '../play3d-format';

describe('timelineTicks / msAtFraction / markerPercent', () => {
  it('눈금은 0 과 축 끝을 포함해 n+1 개', () => {
    expect(timelineTicks(8000, 4)).toEqual([0, 2000, 4000, 6000, 8000]);
    expect(timelineTicks(0, 4)).toEqual([0]);
  });
  it('클릭 비율 → 씬 시간, 범위 밖은 clamp', () => {
    expect(msAtFraction(0.5, 10_000)).toBe(5000);
    expect(msAtFraction(-1, 10_000)).toBe(0);
    expect(msAtFraction(2, 10_000)).toBe(10_000);
    expect(msAtFraction(Number.NaN, 10_000)).toBe(0);
    expect(msAtFraction(0.5, 0)).toBe(0);
  });
  it('마커 위치 %', () => {
    expect(markerPercent(2500, 10_000)).toBe(25);
    expect(markerPercent(20_000, 10_000)).toBe(100);
    expect(markerPercent(500, 0)).toBe(0);
  });
});

describe('sparklinePath', () => {
  it('스텝 경로 — 이전 값을 다음 시각까지 끌고 간 뒤 올린다', () => {
    const d = sparklinePath(
      [
        { t: 0, v: 0 },
        { t: 5000, v: 1 },
        { t: 10_000, v: 2 },
      ],
      10_000,
      2,
      20,
    );
    expect(d).toBe('M0.00,20.00 H50.00 V10.00 H100.00 V0.00');
  });
  it('점이 없거나 축이 0 이면 빈 문자열, 최대 0 은 1 로 본다', () => {
    expect(sparklinePath([], 1000, 1, 20)).toBe('');
    expect(sparklinePath([{ t: 0, v: 0 }], 0, 1, 20)).toBe('');
    expect(sparklinePath([{ t: 0, v: 0 }], 1000, 0, 20)).toBe('M0.00,20.00');
  });
});

describe('timelineAxisMs / markerSeekLeadMs', () => {
  it('길이가 있으면 길이, 없으면 위치·마지막 사건·1초 중 최대', () => {
    expect(timelineAxisMs(90_000, 5, 5)).toBe(90_000);
    expect(timelineAxisMs(null, 200, 7000)).toBe(7000);
    expect(timelineAxisMs(0, 200, 300)).toBe(1000);
  });
  it('리플레이는 프레임 길이(기본 5초), 시뮬레이션은 0.5초', () => {
    expect(markerSeekLeadMs('replay', 2000)).toBe(2000);
    expect(markerSeekLeadMs('replay', undefined)).toBe(5000);
    expect(markerSeekLeadMs('simulation', 2000)).toBe(500);
  });
});
