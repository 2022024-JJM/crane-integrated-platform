import { describe, expect, it } from 'vitest';
import type { SplitLayout } from '@crane/domain/3d';
import {
  computeSplitRects,
  SPLIT_GAP_PX,
  toGlViewport,
} from '../split-rects';

function view(id: string) {
  return {
    id,
    name: id,
    position: [0, 10, 0] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  };
}

const grid2x2: SplitLayout = {
  rows: 2,
  cols: 2,
  tiles: [
    { slot: 0, view: view('a'), row: 0, col: 0 },
    { slot: 1, view: view('b'), row: 0, col: 1 },
    { slot: 2, view: view('c'), row: 1, col: 0 },
    { slot: 3, view: view('d'), row: 1, col: 1 },
  ],
};

const sideBySide: SplitLayout = {
  rows: 1,
  cols: 2,
  tiles: [
    { slot: 0, view: view('a'), row: 0, col: 0 },
    { slot: 1, view: view('b'), row: 0, col: 1 },
  ],
};

describe('computeSplitRects — 2×2', () => {
  it('타일이 간격을 두고 캔버스를 정확히 채운다 (짝수 픽셀)', () => {
    const rects = computeSplitRects(grid2x2, 1000, 600);
    expect(rects).toEqual([
      { x: 0, y: 0, width: 499, height: 299 },
      { x: 501, y: 0, width: 499, height: 299 },
      { x: 0, y: 301, width: 499, height: 299 },
      { x: 501, y: 301, width: 499, height: 299 },
    ]);
    // 오른쪽·아래 끝이 캔버스 끝과 같다.
    expect(rects[3].x + rects[3].width).toBe(1000);
    expect(rects[3].y + rects[3].height).toBe(600);
    // 사이 간격은 SPLIT_GAP_PX.
    expect(rects[1].x - (rects[0].x + rects[0].width)).toBe(SPLIT_GAP_PX);
  });

  it('홀수 픽셀·소수 크기도 정수 경계이고 겹치지 않는다', () => {
    const rects = computeSplitRects(grid2x2, 1001.5, 601.25);
    for (const rect of rects) {
      expect(Number.isInteger(rect.x)).toBe(true);
      expect(Number.isInteger(rect.width)).toBe(true);
    }
    expect(rects[0].x + rects[0].width).toBeLessThanOrEqual(rects[1].x);
    expect(rects[0].y + rects[0].height).toBeLessThanOrEqual(rects[2].y);
  });
});

describe('computeSplitRects — 1×2·간격·경계', () => {
  it('좌우 2분할은 세로를 다 쓴다', () => {
    const rects = computeSplitRects(sideBySide, 800, 400);
    expect(rects[0]).toEqual({ x: 0, y: 0, width: 399, height: 400 });
    expect(rects[1]).toEqual({ x: 401, y: 0, width: 399, height: 400 });
  });

  it('간격 0 이면 딱 반으로 나뉜다', () => {
    const rects = computeSplitRects(sideBySide, 800, 400, 0);
    expect(rects[0].width).toBe(400);
    expect(rects[1].x).toBe(400);
  });

  it('크기 0·음수·비유한은 전부 0 크기 사각형 (음수 폭 없음)', () => {
    for (const [w, h] of [
      [0, 0],
      [-10, 100],
      [Number.NaN, 100],
      [100, Infinity],
    ]) {
      const rects = computeSplitRects(sideBySide, w, h);
      for (const rect of rects) {
        expect(rect.width).toBeGreaterThanOrEqual(0);
        expect(rect.height).toBeGreaterThanOrEqual(0);
      }
      expect(rects.some((r) => r.width === 0 || r.height === 0)).toBe(true);
    }
  });

  it('간격보다 좁은 캔버스에서도 음수 크기가 나오지 않는다', () => {
    const rects = computeSplitRects(sideBySide, 1, 1);
    for (const rect of rects) {
      expect(rect.width).toBeGreaterThanOrEqual(0);
      expect(rect.height).toBeGreaterThanOrEqual(0);
    }
  });

  it('배치의 행·열 밖 index 는 0 크기다 (방어)', () => {
    const broken: SplitLayout = {
      rows: 1,
      cols: 1,
      tiles: [{ slot: 3, view: view('z'), row: 1, col: 1 }],
    };
    expect(computeSplitRects(broken, 100, 100)[0]).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });
});

describe('toGlViewport', () => {
  it('세로를 뒤집는다 — 위쪽 타일이 GL 에선 위쪽(큰 y)', () => {
    expect(
      toGlViewport({ x: 10, y: 0, width: 100, height: 40 }, 100),
    ).toEqual({ x: 10, y: 60, width: 100, height: 40 });
    expect(
      toGlViewport({ x: 0, y: 60, width: 100, height: 40 }, 100),
    ).toEqual({ x: 0, y: 0, width: 100, height: 40 });
  });
});
