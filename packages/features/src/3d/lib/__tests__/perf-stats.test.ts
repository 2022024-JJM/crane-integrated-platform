import { describe, expect, it } from 'vitest';
import {
  PERF_EMA_ALPHA,
  WORST_FRAME_WINDOW_MS,
  createWorstFrameTracker,
  formatMs,
  formatPerfLine,
  formatTris,
  updateEma,
  type ScenePerfSample,
} from '../perf-stats';

describe('updateEma', () => {
  it('첫 샘플(prev=null)은 샘플값 그대로 시작한다', () => {
    expect(updateEma(null, 16.7)).toBe(16.7);
    expect(updateEma(null, 0)).toBe(0);
  });

  it('한 스텝은 prev + α(sample − prev) 정확값이다', () => {
    expect(updateEma(10, 20, 0.1)).toBeCloseTo(11, 10);
    expect(updateEma(10, 20, 0.5)).toBeCloseTo(15, 10);
  });

  it('같은 샘플을 반복하면 그 값으로 수렴한다 (α=0.1, 50스텝에 1ms 이내)', () => {
    let ema = updateEma(null, 100);
    for (let i = 0; i < 50; i += 1) {
      ema = updateEma(ema, 0);
    }
    // 0.9^50 × 100 ≈ 0.515
    expect(ema).toBeLessThan(1);
    expect(ema).toBeGreaterThan(0);
  });

  it('기본 α 는 PERF_EMA_ALPHA 다', () => {
    expect(updateEma(0, 10)).toBeCloseTo(10 * PERF_EMA_ALPHA, 10);
  });

  it('비유한 샘플(NaN/Infinity)은 무시하고 prev 를 유지한다', () => {
    expect(updateEma(12, Number.NaN)).toBe(12);
    expect(updateEma(12, Number.POSITIVE_INFINITY)).toBe(12);
    // prev 도 없으면 0 — HUD 표시가 NaN 문자열로 깨지지 않게.
    expect(updateEma(null, Number.NaN)).toBe(0);
  });
});

describe('createWorstFrameTracker', () => {
  it('빈 추적기의 worst 는 0 이다', () => {
    expect(createWorstFrameTracker().worst(0)).toBe(0);
  });

  it('창 안의 최대 dt 를 돌려준다 (뒤에 온 작은 값에 가려지지 않음)', () => {
    const tracker = createWorstFrameTracker();
    tracker.push(0, 10);
    tracker.push(100, 30);
    tracker.push(200, 5);
    expect(tracker.worst(200)).toBe(30);
  });

  it('창 경계 정확값: 만료 직전까지 유지, 창을 넘는 순간 다음 최대가 드러난다', () => {
    const tracker = createWorstFrameTracker();
    tracker.push(100, 30);
    tracker.push(200, 5);
    // at=1099: 30 의 나이 999ms → 아직 창 안.
    expect(tracker.worst(1099)).toBe(30);
    // at=1100: 나이 1000ms → 만료, 남은 최대 5.
    expect(tracker.worst(1100)).toBe(5);
  });

  it('내림차순으로 쌓인 값은 만료마다 차례로 드러난다 (덱 유지 검증)', () => {
    const tracker = createWorstFrameTracker();
    tracker.push(0, 50);
    tracker.push(100, 30);
    tracker.push(200, 10);
    expect(tracker.worst(999)).toBe(50);
    expect(tracker.worst(1000)).toBe(30);
    expect(tracker.worst(1100)).toBe(10);
    expect(tracker.worst(1200)).toBe(0);
  });

  it('창 길이는 windowMs 인자로 바꿀 수 있고 기본은 WORST_FRAME_WINDOW_MS 다', () => {
    expect(WORST_FRAME_WINDOW_MS).toBe(1000);
    const tracker = createWorstFrameTracker(100);
    tracker.push(0, 40);
    expect(tracker.worst(99)).toBe(40);
    expect(tracker.worst(100)).toBe(0);
  });

  it('비유한 입력(NaN 시각·NaN dt)은 무시된다', () => {
    const tracker = createWorstFrameTracker();
    tracker.push(0, 20);
    tracker.push(Number.NaN, 999);
    tracker.push(100, Number.NaN);
    expect(tracker.worst(100)).toBe(20);
  });
});

describe('formatTris', () => {
  it('백만 이상은 M 두 자리 소수', () => {
    expect(formatTris(2_502_024)).toBe('2.50M');
    expect(formatTris(1_000_000)).toBe('1.00M');
  });

  it('천 이상은 k 한 자리 소수 — 경계 정확값과 그 밖', () => {
    expect(formatTris(1_000)).toBe('1.0k');
    expect(formatTris(999)).toBe('999');
    expect(formatTris(12_345)).toBe('12.3k');
    // 백만 직전은 아직 k 표기다 (반올림으로 1000.0k 가 되는 것 포함, 특성화).
    expect(formatTris(999_999)).toBe('1000.0k');
  });

  it('0·음수·비유한 값은 "0" 으로 방어한다', () => {
    expect(formatTris(0)).toBe('0');
    expect(formatTris(-5)).toBe('0');
    expect(formatTris(Number.NaN)).toBe('0');
  });
});

describe('formatMs', () => {
  it('한 자리 소수 + ms 접미', () => {
    expect(formatMs(16.66)).toBe('16.7ms');
    expect(formatMs(0)).toBe('0.0ms');
  });

  it('음수·비유한 값은 "0.0ms" 로 방어한다', () => {
    expect(formatMs(-1)).toBe('0.0ms');
    expect(formatMs(Number.NaN)).toBe('0.0ms');
    expect(formatMs(Number.POSITIVE_INFINITY)).toBe('0.0ms');
  });
});

describe('formatPerfLine', () => {
  const base: ScenePerfSample = {
    calls: 154,
    triangles: 2_502_024,
    frameMs: 16.66,
    worstMs: 41.2,
    heapMB: 512.4,
  };

  it('전체 형식: calls · tris · ms (worst n) · heap', () => {
    expect(formatPerfLine(base)).toBe(
      '154 calls · 2.50M tris · 16.7ms (worst 41) · 512MB',
    );
  });

  it('heap 이 null(비 Chrome)이면 heap 칸을 통째로 생략한다', () => {
    expect(formatPerfLine({ ...base, heapMB: null })).toBe(
      '154 calls · 2.50M tris · 16.7ms (worst 41)',
    );
  });

  it('worst 가 0 또는 비유한 값이면 0 으로 표시한다', () => {
    expect(formatPerfLine({ ...base, worstMs: 0, heapMB: null })).toBe(
      '154 calls · 2.50M tris · 16.7ms (worst 0)',
    );
    expect(formatPerfLine({ ...base, worstMs: Number.NaN, heapMB: null })).toBe(
      '154 calls · 2.50M tris · 16.7ms (worst 0)',
    );
  });

  it('초기 상태(전부 0)도 깨진 문자열 없이 그려진다', () => {
    expect(
      formatPerfLine({
        calls: 0,
        triangles: 0,
        frameMs: 0,
        worstMs: 0,
        heapMB: null,
      }),
    ).toBe('0 calls · 0 tris · 0.0ms (worst 0)');
  });
});
