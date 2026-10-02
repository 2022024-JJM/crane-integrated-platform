import { describe, expect, it } from 'vitest';
import {
  ASSET_BUDGET,
  evaluateAssetBudget,
  formatBytes,
  formatCount,
  formatMeters,
  formatSignedCount,
  pickGridStep,
  toMeterSize,  formatDimensions,
} from '../asset-format';

const stats = (patch = {}) => ({
  triangles: 0,
  vertices: 0,
  meshes: 0,
  materials: 0,
  textures: 0,
  drawCalls: 0,
  nodes: 0,
  textureMemoryBytes: 0,
  size: null,
  lodLevels: 1,
  animations: 0,
  ...patch,
});

describe('formatBytes', () => {
  it('1024 진법으로 단위를 올린다', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(150 * 1024)).toBe('150 KB');
    expect(formatBytes(5 * 1024 ** 3)).toBe('5.0 GB');
    // 가장 큰 단위에서 멈춘다.
    expect(formatBytes(5000 * 1024 ** 3)).toBe('5000 GB');
  });

  it('없는 값·NaN 은 —, 음수는 0', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(undefined)).toBe('—');
    expect(formatBytes(Number.NaN)).toBe('—');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatBytes(-5)).toBe('0 B');
  });
});

describe('formatCount', () => {
  it('구간 경계에서 표기가 바뀐다', () => {
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1000)).toBe('1.0K');
    expect(formatCount(9999)).toBe('10.0K');
    expect(formatCount(10_000)).toBe('10K');
    expect(formatCount(999_999)).toBe('1000K');
    expect(formatCount(1_000_000)).toBe('1.00M');
    expect(formatCount(null)).toBe('—');
    expect(formatCount(Number.NaN)).toBe('—');
  });
});

describe('formatSignedCount', () => {
  it('부호를 붙이고 0 은 ±0', () => {
    expect(formatSignedCount(1200)).toBe('+1.2K');
    expect(formatSignedCount(-340)).toBe('−340');
    expect(formatSignedCount(0)).toBe('±0');
  });
});

describe('formatMeters', () => {
  it('100 m 이상은 소수 한 자리, 미만은 두 자리', () => {
    expect(formatMeters(99.994)).toBe('99.99 m');
    expect(formatMeters(100)).toBe('100.0 m');
    expect(formatMeters(0.5)).toBe('0.50 m');
    expect(formatMeters(Number.NaN)).toBe('—');
  });
});

describe('toMeterSize', () => {
  it('축마다 기본 스케일을 곱한다', () => {
    expect(toMeterSize([130, 64, 43], [0.1, 0.1, 0.1])).toEqual([13, 6.4, 4.3]);
  });
});

describe('pickGridStep', () => {
  it('1·2·5 × 10ⁿ 에서 고른다', () => {
    expect(pickGridStep(10)).toBe(1);
    expect(pickGridStep(25)).toBe(2);
    expect(pickGridStep(60)).toBe(5);
    expect(pickGridStep(137)).toBe(10);
    expect(pickGridStep(13_000)).toBe(1000);
    expect(pickGridStep(0.5)).toBeCloseTo(0.05);
  });

  it('0·음수·NaN 은 1', () => {
    expect(pickGridStep(0)).toBe(1);
    expect(pickGridStep(-3)).toBe(1);
    expect(pickGridStep(Number.NaN)).toBe(1);
  });
});

describe('evaluateAssetBudget', () => {
  it('상한 정확값은 통과, +1 은 경고', () => {
    expect(
      evaluateAssetBudget('model', stats({ triangles: ASSET_BUDGET.triangles })),
    ).toEqual([]);
    expect(
      evaluateAssetBudget('model', stats({ triangles: ASSET_BUDGET.triangles + 1 })),
    ).toEqual([
      {
        metric: 'triangles',
        value: ASSET_BUDGET.triangles + 1,
        limit: ASSET_BUDGET.triangles,
      },
    ]);
  });

  it('지도는 삼각형·드로우콜·노드 기준에서 빼고 텍스처 메모리만 본다', () => {
    const heavy = stats({
      triangles: 5_000_000,
      drawCalls: 500,
      nodes: 500,
      textureMemoryBytes: ASSET_BUDGET.textureMemoryBytes + 1,
    });
    expect(evaluateAssetBudget('map', heavy).map((w) => w.metric)).toEqual([
      'textureMemory',
    ]);
    expect(evaluateAssetBudget('model', heavy).map((w) => w.metric)).toEqual([
      'triangles',
      'drawCalls',
      'nodes',
      'textureMemory',
    ]);
  });

  it('형상이 없는 종류(도면·CAD·배경)는 예산이 없다', () => {
    const heavy = stats({ triangles: 9e9, textureMemoryBytes: 9e12 });
    expect(evaluateAssetBudget('drawing', heavy)).toEqual([]);
    expect(evaluateAssetBudget('cad', heavy)).toEqual([]);
    expect(evaluateAssetBudget('environment', heavy)).toEqual([]);
  });
});

describe('formatDimensions', () => {
  it('폭 × 깊이 × 높이 순으로, 단위는 끝에 한 번', () => {
    // 입력은 [X, Y(높이), Z].
    expect(formatDimensions([18, 4.12, 4.23])).toBe('18.00 × 4.23 × 4.12 m');
  });

  it('100 m 이상은 소수 한 자리 — 경계 정확값 포함', () => {
    expect(formatDimensions([99.994, 100, 254.84])).toBe(
      '99.99 × 254.8 × 100.0 m',
    );
  });

  it('값이 하나라도 비정상이면 —', () => {
    expect(formatDimensions([1, Number.NaN, 1])).toBe('—');
    expect(formatDimensions([Infinity, 1, 1])).toBe('—');
  });

  it('0 크기도 그대로 적는다', () => {
    expect(formatDimensions([0, 0, 0])).toBe('0.00 × 0.00 × 0.00 m');
  });
});
