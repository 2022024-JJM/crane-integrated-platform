import { describe, expect, it } from 'vitest';
import {
  TERRAIN_LOD_HYSTERESIS,
  TERRAIN_LOD_THRESHOLD_PX,
  selectTerrainLod,
  terrainLodPixelFactor,
} from '../terrain-lod';

// 실제 씬 파라미터: fov 75, 1080p × DPR 1.5 = 세로 1620 device px.
const FACTOR = terrainLodPixelFactor(75, 1620);
const ERRORS = [0, 2, 4, 8] as const;

/** 레벨 N 의 오차가 정확히 임계 px 가 되는 거리. */
const thresholdDistance = (level: number) =>
  (ERRORS[level] * FACTOR) / TERRAIN_LOD_THRESHOLD_PX;

describe('terrainLodPixelFactor', () => {
  it('fov 75·세로 1620px 기준 계수는 height/(2·tan37.5°) 다', () => {
    expect(FACTOR).toBeCloseTo(1620 / (2 * Math.tan((75 * Math.PI) / 360)), 6);
  });

  it('비정상 입력(fov 0·180, height 0)은 0 — 호출측이 원본 유지로 방어', () => {
    expect(terrainLodPixelFactor(0, 1620)).toBe(0);
    expect(terrainLodPixelFactor(180, 1620)).toBe(0);
    expect(terrainLodPixelFactor(75, 0)).toBe(0);
  });
});

describe('selectTerrainLod', () => {
  it('가까우면 원본(0), 멀어질수록 거친 레벨', () => {
    expect(selectTerrainLod(ERRORS, 100, FACTOR, 0)).toBe(0);
    // LOD1(2m) 경계 너머 + 마진.
    const d1 = thresholdDistance(1) * (1 + TERRAIN_LOD_HYSTERESIS) + 1;
    expect(selectTerrainLod(ERRORS, d1, FACTOR, 0)).toBe(1);
    const d3 = thresholdDistance(3) * (1 + TERRAIN_LOD_HYSTERESIS) + 1;
    expect(selectTerrainLod(ERRORS, d3, FACTOR, 0)).toBe(3);
  });

  it('경계 정확값: 임계 바로 안은 유지(0), 마진 밖은 전환 — 쌍 검증', () => {
    const d1 = thresholdDistance(1);
    // 임계 거리 바로 위 — 이상적으론 LOD1 이지만 마진 안이라 0 유지.
    expect(selectTerrainLod(ERRORS, d1 + 0.01, FACTOR, 0)).toBe(0);
    // 마진(15%) 밖 — 전환.
    expect(
      selectTerrainLod(ERRORS, d1 * (1 + TERRAIN_LOD_HYSTERESIS) + 0.01, FACTOR, 0),
    ).toBe(1);
  });

  it('히스테리시스: 이미 거친 레벨이면 마진 안 거리에서도 유지된다', () => {
    const d1 = thresholdDistance(1);
    // 마진 안(전환은 안 되는 구간)이지만 이미 1 이면 1 유지 — 떨림 방지.
    expect(selectTerrainLod(ERRORS, d1 + 0.01, FACTOR, 1)).toBe(1);
  });

  it('세밀해지는 방향은 즉시 — 임계 안으로 들어오면 바로 내린다', () => {
    const d1 = thresholdDistance(1);
    expect(selectTerrainLod(ERRORS, d1 - 1, FACTOR, 1)).toBe(0);
    expect(selectTerrainLod(ERRORS, 100, FACTOR, 3)).toBe(0);
  });

  it('잘못된 입력 방어: 거리·계수 0 이하, 빈 오차 목록, 범위 밖 current', () => {
    expect(selectTerrainLod(ERRORS, 0, FACTOR, 2)).toBe(0);
    expect(selectTerrainLod(ERRORS, -5, FACTOR, 2)).toBe(0);
    expect(selectTerrainLod(ERRORS, 1000, 0, 2)).toBe(0);
    expect(selectTerrainLod([], 1000, FACTOR, 2)).toBe(0);
    expect(selectTerrainLod(ERRORS, 100, FACTOR, 99)).toBe(0);
    expect(selectTerrainLod(ERRORS, 100, FACTOR, -1)).toBe(0);
  });

  it('레벨을 건너뛴 전환도 허용된다(1→3, 탑뷰 순간 이동)', () => {
    const d3 = thresholdDistance(3) * (1 + TERRAIN_LOD_HYSTERESIS) + 1;
    expect(selectTerrainLod(ERRORS, d3, FACTOR, 1)).toBe(3);
  });
});
