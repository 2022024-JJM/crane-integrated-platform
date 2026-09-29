import { describe, expect, it } from 'vitest';
import {
  formatRulerValue,
  isRulerLabelVisible,
  pickRulerInterval,
  pixelsPerUnitAtDistance,
  resolveRulerInterval,
  rulerAxisPoints,
  rulerGuidePoints,
  rulerLabelStride,
  rulerPlacementFromPoints,
  rulerTicks,
  RULER_LABEL_MIN_SPACING_PX,
  RULER_MAX_TICKS,
} from '../ruler';
import { RULER_MIN_LENGTH } from '../../model/ruler-types';

function values(ticks: ReturnType<typeof rulerTicks>): number[] {
  return ticks.map((tick) => tick.value);
}

describe('rulerTicks — 눈금 위치', () => {
  it('시작 값 0 이면 0 부터 간격마다, 끝점이 배수면 끝점까지 선다', () => {
    const ticks = rulerTicks({ lengthM: 300, interval: 100 });
    expect(values(ticks)).toEqual([0, 100, 200, 300]);
    expect(ticks.map((t) => t.distance)).toEqual([0, 100, 200, 300]);
    expect(ticks.map((t) => t.index)).toEqual([0, 1, 2, 3]);
  });

  it('길이가 간격의 배수가 아니면 마지막 배수에서 멈춘다', () => {
    expect(values(rulerTicks({ lengthM: 750, interval: 100 }))).toEqual([
      0, 100, 200, 300, 400, 500, 600, 700,
    ]);
  });

  it('길이가 간격보다 짧으면 시작 눈금 하나만 선다', () => {
    expect(values(rulerTicks({ lengthM: 40, interval: 100 }))).toEqual([0]);
  });

  it('시작 값이 있으면 시작점이 아니라 간격의 배수 값에 선다', () => {
    const ticks = rulerTicks({ lengthM: 300, interval: 100, startValue: 150 });
    expect(values(ticks)).toEqual([200, 300, 400]);
    expect(ticks.map((t) => t.distance)).toEqual([50, 150, 250]);
    expect(ticks.map((t) => t.index)).toEqual([2, 3, 4]);
  });

  it('시작 값이 배수면 시작점에도 선다', () => {
    expect(
      values(rulerTicks({ lengthM: 200, interval: 100, startValue: 200 })),
    ).toEqual([200, 300, 400]);
  });

  it('음수 시작 값은 0 을 지나 이어진다', () => {
    const ticks = rulerTicks({ lengthM: 250, interval: 100, startValue: -150 });
    expect(values(ticks)).toEqual([-100, 0, 100]);
    expect(ticks.map((t) => t.distance)).toEqual([50, 150, 250]);
  });

  it('범위 안에 배수가 없으면 빈 배열', () => {
    expect(rulerTicks({ lengthM: 30, interval: 100, startValue: 10 })).toEqual(
      [],
    );
  });

  it('소수 간격의 끝 눈금을 부동소수 오차로 잃지 않는다 (0.1 × 3)', () => {
    const ticks = rulerTicks({ lengthM: 0.3, interval: 0.1 });
    expect(ticks).toHaveLength(4);
    expect(ticks[3].value).toBeCloseTo(0.3, 12);
    // 거리는 길이를 넘지 않는다.
    expect(ticks[3].distance).toBeLessThanOrEqual(0.3);
  });

  it('잘못된 길이·간격(0·음수·NaN·Infinity)은 빈 배열', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(rulerTicks({ lengthM: bad, interval: 100 })).toEqual([]);
      expect(rulerTicks({ lengthM: 100, interval: bad })).toEqual([]);
    }
  });

  it('비유한 시작 값은 0 으로 본다', () => {
    expect(
      values(
        rulerTicks({ lengthM: 200, interval: 100, startValue: Number.NaN }),
      ),
    ).toEqual([0, 100, 200]);
  });
});

describe('resolveRulerInterval — 눈금 개수 상한', () => {
  it('개수가 상한과 같으면 간격을 그대로 둔다', () => {
    // 0..199 → 200 개.
    const lengthM = RULER_MAX_TICKS - 1;
    expect(resolveRulerInterval({ lengthM, interval: 1 })).toBe(1);
    expect(rulerTicks({ lengthM, interval: 1 })).toHaveLength(RULER_MAX_TICKS);
  });

  it('상한을 하나 넘으면 간격을 정수 배로 올린다', () => {
    // 0..200 → 201 개 → 2 배.
    const lengthM = RULER_MAX_TICKS;
    expect(resolveRulerInterval({ lengthM, interval: 1 })).toBe(2);
    const ticks = rulerTicks({ lengthM, interval: 1 });
    expect(ticks.length).toBeLessThanOrEqual(RULER_MAX_TICKS);
    // 남는 눈금은 원래 눈금 자리(간격의 배수)에 그대로 선다.
    expect(ticks.every((t) => t.value % 1 === 0)).toBe(true);
    expect(ticks[1].value).toBe(2);
  });

  it('극단적으로 촘촘한 입력도 상한 안으로 들어온다', () => {
    const ticks = rulerTicks({ lengthM: 1000, interval: 0.001 });
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.length).toBeLessThanOrEqual(RULER_MAX_TICKS);
  });

  it('호출자가 넘긴 상한을 쓴다', () => {
    expect(
      resolveRulerInterval({ lengthM: 100, interval: 10, maxTicks: 11 }),
    ).toBe(10);
    expect(
      resolveRulerInterval({ lengthM: 100, interval: 10, maxTicks: 10 }),
    ).toBe(20);
  });

  it('잘못된 입력은 0', () => {
    expect(resolveRulerInterval({ lengthM: 0, interval: 10 })).toBe(0);
    expect(resolveRulerInterval({ lengthM: 10, interval: Number.NaN })).toBe(0);
  });
});

describe('pickRulerInterval — 기본 간격', () => {
  it('고를 수 있는 간격(50·100) 중 칸이 4개 이상 들어가는 가장 큰 값을 고른다', () => {
    expect(pickRulerInterval(1000)).toBe(100);
    expect(pickRulerInterval(300)).toBe(50);
  });

  it('경계 — 정확히 4칸이면 그 간격, 조금 모자라면 아래 간격', () => {
    expect(pickRulerInterval(400)).toBe(100);
    expect(pickRulerInterval(399.9)).toBe(50);
    expect(pickRulerInterval(200)).toBe(50);
  });

  it('짧아서 어느 간격도 4칸이 안 되면 가장 작은 간격', () => {
    expect(pickRulerInterval(199.9)).toBe(50);
    expect(pickRulerInterval(30)).toBe(50);
  });

  it('잘못된 길이(0·음수·NaN·Infinity)는 가장 작은 간격', () => {
    expect(pickRulerInterval(0)).toBe(50);
    expect(pickRulerInterval(-5)).toBe(50);
    expect(pickRulerInterval(Number.NaN)).toBe(50);
    expect(pickRulerInterval(Number.POSITIVE_INFINITY)).toBe(50);
  });
});

describe('rulerPlacementFromPoints — 두 점 → 배치', () => {
  it('+X 방향은 회전 0', () => {
    expect(rulerPlacementFromPoints([0, 5, 0], [100, 5, 0])).toEqual({
      position: [0, 5, 0],
      rotation: [0, 0, 0],
      length: 100,
    });
  });

  it('로컬 +X 가 끝점을 향한다 — −Z 는 90°, −X 는 180°, +Z 는 270°', () => {
    expect(rulerPlacementFromPoints([0, 0, 0], [0, 0, -50])?.rotation).toEqual([
      0, 90, 0,
    ]);
    expect(rulerPlacementFromPoints([0, 0, 0], [-50, 0, 0])?.rotation).toEqual([
      0, 180, 0,
    ]);
    expect(rulerPlacementFromPoints([0, 0, 0], [0, 0, 50])?.rotation).toEqual([
      0, 270, 0,
    ]);
  });

  it('길이는 수평 거리다 — 끝점의 높이는 쓰지 않고 시작점 높이에 놓인다', () => {
    const placement = rulerPlacementFromPoints([10, 5, 20], [13, 99, 24]);
    expect(placement).toEqual({
      position: [10, 5, 20],
      rotation: [0, 306.9, 0],
      length: 5,
    });
  });

  it('좌표·길이는 3자리, 회전은 1자리로 반올림한다', () => {
    const placement = rulerPlacementFromPoints(
      [1.23456, 2.34567, 3.45678],
      [2.23456, 0, 4.45678],
    );
    expect(placement?.position).toEqual([1.235, 2.346, 3.457]);
    expect(placement?.length).toBe(1.414);
    expect(placement?.rotation).toEqual([0, 315, 0]);
  });

  it('같은 자리(길이 0)·최소 길이 미만은 null', () => {
    expect(rulerPlacementFromPoints([1, 2, 3], [1, 2, 3])).toBeNull();
    // 높이만 다른 두 점도 수평 길이는 0 이다.
    expect(rulerPlacementFromPoints([1, 2, 3], [1, 50, 3])).toBeNull();
    expect(
      rulerPlacementFromPoints([0, 0, 0], [RULER_MIN_LENGTH / 2, 0, 0]),
    ).toBeNull();
  });

  it('경계 — 최소 길이와 같으면 만든다', () => {
    expect(
      rulerPlacementFromPoints([0, 0, 0], [RULER_MIN_LENGTH, 0, 0]),
    ).not.toBeNull();
  });

  it('좌표에 NaN·Infinity 가 섞이면 null', () => {
    expect(rulerPlacementFromPoints([Number.NaN, 0, 0], [1, 0, 0])).toBeNull();
    expect(
      rulerPlacementFromPoints([0, 0, 0], [1, 0, Number.POSITIVE_INFINITY]),
    ).toBeNull();
  });
});

describe('formatRulerValue — 숫자 표기', () => {
  it('단위를 붙이거나 숫자만 보인다', () => {
    expect(formatRulerValue(800, 100, false)).toBe('800m');
    expect(formatRulerValue(800, 100, true)).toBe('800');
  });

  it('간격의 소수 자릿수를 따른다(최대 2자리)', () => {
    expect(formatRulerValue(2.5, 0.5, false)).toBe('2.5m');
    expect(formatRulerValue(3, 0.5, false)).toBe('3.0m');
    expect(formatRulerValue(0.75, 0.25, true)).toBe('0.75');
    expect(formatRulerValue(0.125, 0.125, true)).toBe('0.13');
  });

  it('부동소수 잡음과 -0 을 지운다', () => {
    expect(formatRulerValue(0.1 * 3, 0.1, true)).toBe('0.3');
    expect(formatRulerValue(-0, 100, false)).toBe('0m');
    expect(formatRulerValue(-0.0001, 0.1, true)).toBe('0.0');
  });

  it('음수 값을 그대로 보인다', () => {
    expect(formatRulerValue(-100, 100, false)).toBe('-100m');
  });

  it('비유한 값은 빈 문자열, 잘못된 간격은 정수 표기', () => {
    expect(formatRulerValue(Number.NaN, 100, false)).toBe('');
    expect(formatRulerValue(12.6, 0, true)).toBe('13');
  });
});

describe('rulerLabelStride / isRulerLabelVisible — 숫자 건너뛰기', () => {
  it('간격이 충분히 넓으면 전부 보인다', () => {
    expect(rulerLabelStride(RULER_LABEL_MIN_SPACING_PX)).toBe(1);
    expect(rulerLabelStride(500)).toBe(1);
  });

  it('좁아질수록 2·5·10… 배수로 건너뛴다', () => {
    expect(rulerLabelStride(RULER_LABEL_MIN_SPACING_PX - 0.01)).toBe(2);
    expect(rulerLabelStride(RULER_LABEL_MIN_SPACING_PX / 2)).toBe(2);
    expect(rulerLabelStride(RULER_LABEL_MIN_SPACING_PX / 2 - 0.01)).toBe(5);
    expect(rulerLabelStride(RULER_LABEL_MIN_SPACING_PX / 5)).toBe(5);
    expect(rulerLabelStride(RULER_LABEL_MIN_SPACING_PX / 10)).toBe(10);
  });

  it('가장 큰 배수로도 겹치면 전부 숨긴다(0)', () => {
    expect(rulerLabelStride(RULER_LABEL_MIN_SPACING_PX / 100 - 0.01)).toBe(0);
    expect(rulerLabelStride(0)).toBe(0);
    expect(rulerLabelStride(-3)).toBe(0);
    expect(rulerLabelStride(Number.NaN)).toBe(0);
  });

  it('호출자가 넘긴 최소 간격을 쓴다', () => {
    expect(rulerLabelStride(10, 10)).toBe(1);
    expect(rulerLabelStride(10, 11)).toBe(2);
  });

  it('배수의 눈금만 보인다 — 음수 인덱스와 0 포함', () => {
    expect(isRulerLabelVisible(0, 5)).toBe(true);
    expect(isRulerLabelVisible(5, 5)).toBe(true);
    expect(isRulerLabelVisible(-10, 5)).toBe(true);
    expect(isRulerLabelVisible(3, 5)).toBe(false);
    expect(isRulerLabelVisible(-3, 5)).toBe(false);
    expect(isRulerLabelVisible(7, 1)).toBe(true);
  });

  it('배수 0 이하는 전부 숨김', () => {
    expect(isRulerLabelVisible(0, 0)).toBe(false);
    expect(isRulerLabelVisible(4, -2)).toBe(false);
  });
});

describe('pixelsPerUnitAtDistance', () => {
  it('원근 카메라 — fov 90° 에서 거리 d 의 세로 시야는 2d', () => {
    expect(
      pixelsPerUnitAtDistance({ fovDeg: 90, viewportHeightPx: 1000 }, 100),
    ).toBeCloseTo(5, 10);
    // 두 배 멀어지면 절반.
    expect(
      pixelsPerUnitAtDistance({ fovDeg: 90, viewportHeightPx: 1000 }, 200),
    ).toBeCloseTo(2.5, 10);
  });

  it('직교 카메라는 거리와 무관하다', () => {
    const view = { orthoHeight: 500, viewportHeightPx: 1000 };
    expect(pixelsPerUnitAtDistance(view, 1)).toBe(2);
    expect(pixelsPerUnitAtDistance(view, 9999)).toBe(2);
    // 거리가 0 이어도(카메라가 눈금 위) 계산된다.
    expect(pixelsPerUnitAtDistance(view, 0)).toBe(2);
  });

  it('계산할 수 없으면 0', () => {
    expect(
      pixelsPerUnitAtDistance({ fovDeg: 60, viewportHeightPx: 0 }, 100),
    ).toBe(0);
    expect(
      pixelsPerUnitAtDistance({ fovDeg: 60, viewportHeightPx: 1000 }, 0),
    ).toBe(0);
    expect(
      pixelsPerUnitAtDistance({ fovDeg: 0, viewportHeightPx: 1000 }, 100),
    ).toBe(0);
    expect(pixelsPerUnitAtDistance({ viewportHeightPx: 1000 }, 100)).toBe(0);
    expect(
      pixelsPerUnitAtDistance({ orthoHeight: 0, viewportHeightPx: 1000 }, 100),
    ).toBe(0);
    expect(
      pixelsPerUnitAtDistance(
        { fovDeg: 60, viewportHeightPx: 1000 },
        Number.NaN,
      ),
    ).toBe(0);
  });
});

describe('rulerGuidePoints — 보조선', () => {
  const ticks = rulerTicks({ lengthM: 200, interval: 100 });

  it('눈금 점마다 선분 하나 — 점에서 시작해 한쪽으로만 뻗는다', () => {
    expect(rulerGuidePoints(ticks, 20, 'left')).toEqual([
      [0, 0, 0],
      [0, 0, -20],
      [100, 0, 0],
      [100, 0, -20],
      [200, 0, 0],
      [200, 0, -20],
    ]);
  });

  it('선분의 한 끝은 늘 점(Z = 0)이다 — 길이를 바꿔도 반대쪽으로 늘지 않는다', () => {
    for (const length of [1, 20, 500]) {
      const points = rulerGuidePoints(ticks, length, 'left');
      for (let i = 0; i < points.length; i += 2) {
        expect(points[i][2]).toBe(0);
        expect(points[i + 1][2]).toBe(-length);
      }
    }
  });

  it('오른쪽은 +Z, 왼쪽(기본)은 −Z 로 뻗는다', () => {
    expect(rulerGuidePoints(ticks, 20, 'right')[1]).toEqual([0, 0, 20]);
    expect(rulerGuidePoints(ticks, 20, 'left')[1]).toEqual([0, 0, -20]);
    expect(rulerGuidePoints(ticks, 20)).toEqual(
      rulerGuidePoints(ticks, 20, 'left'),
    );
  });

  it('시작 값이 있으면 점의 자리(거리)를 따른다', () => {
    const shifted = rulerTicks({
      lengthM: 200,
      interval: 100,
      startValue: 150,
    });
    expect(rulerGuidePoints(shifted, 10, 'right')).toEqual([
      [50, 0, 0],
      [50, 0, 10],
      [150, 0, 0],
      [150, 0, 10],
    ]);
  });

  it('길이가 0·음수·NaN·Infinity 면 빈 배열', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(rulerGuidePoints(ticks, bad, 'left')).toEqual([]);
    }
  });

  it('눈금이 없으면 빈 배열', () => {
    expect(rulerGuidePoints([], 20, 'left')).toEqual([]);
  });
});

describe('rulerAxisPoints — 선택 표시용 축선', () => {
  it('시작점에서 끝점까지의 두 점', () => {
    expect(rulerAxisPoints(750)).toEqual([
      [0, 0, 0],
      [750, 0, 0],
    ]);
  });

  it('잘못된 길이는 0 으로 본다', () => {
    for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(rulerAxisPoints(bad)).toEqual([
        [0, 0, 0],
        [0, 0, 0],
      ]);
    }
  });
});
