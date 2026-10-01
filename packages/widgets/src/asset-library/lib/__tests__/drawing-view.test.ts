import { describe, expect, it } from 'vitest';
import {
  actualSizeDrawingView,
  clampDrawingScale,
  DRAWING_SCALE_MAX,
  DRAWING_SCALE_MIN,
  fitDrawingView,
  zoomDrawingAt,
} from '../drawing-view';

const viewport = { width: 1000, height: 600 };

describe('clampDrawingScale', () => {
  it('한계 정확값은 통과하고 그 밖은 잘린다', () => {
    expect(clampDrawingScale(DRAWING_SCALE_MIN)).toBe(DRAWING_SCALE_MIN);
    expect(clampDrawingScale(DRAWING_SCALE_MAX)).toBe(DRAWING_SCALE_MAX);
    expect(clampDrawingScale(DRAWING_SCALE_MIN / 2)).toBe(DRAWING_SCALE_MIN);
    expect(clampDrawingScale(DRAWING_SCALE_MAX * 2)).toBe(DRAWING_SCALE_MAX);
  });

  it('NaN·Infinity 는 1', () => {
    expect(clampDrawingScale(Number.NaN)).toBe(1);
    expect(clampDrawingScale(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('fitDrawingView', () => {
  it('여백 안에 전체가 들어오고 가운데에 놓인다', () => {
    const view = fitDrawingView(viewport, { width: 2000, height: 1000 }, 50);
    // 가로 900/2000 = 0.45, 세로 500/1000 = 0.5 → 좁은 쪽.
    expect(view.scale).toBeCloseTo(0.45);
    expect(view.x).toBeCloseTo(50);
    expect(view.y).toBeCloseTo((600 - 450) / 2);
  });

  it('작은 도면은 확대해 채운다', () => {
    const view = fitDrawingView(viewport, { width: 100, height: 100 }, 0);
    expect(view.scale).toBe(6);
  });

  it('크기를 모르는 도면(0·음수)은 원점·100%', () => {
    for (const content of [
      { width: 0, height: 100 },
      { width: 100, height: -1 },
      { width: Number.NaN, height: 100 },
    ]) {
      expect(fitDrawingView(viewport, content)).toEqual({ x: 0, y: 0, scale: 1 });
    }
  });

  it('뷰포트가 여백보다 작아도 유한한 배율을 낸다', () => {
    const view = fitDrawingView({ width: 10, height: 10 }, { width: 100, height: 100 });
    expect(view.scale).toBe(DRAWING_SCALE_MIN);
    expect(Number.isFinite(view.x)).toBe(true);
  });
});

describe('zoomDrawingAt', () => {
  it('고정한 점 아래의 도면 위치가 움직이지 않는다', () => {
    const view = { x: 40, y: -20, scale: 0.5 };
    const point = { x: 300, y: 200 };
    const toContent = (v: typeof view) => ({
      x: (point.x - v.x) / v.scale,
      y: (point.y - v.y) / v.scale,
    });
    const zoomed = zoomDrawingAt(view, 2, point);
    expect(zoomed.scale).toBe(1);
    expect(toContent(zoomed).x).toBeCloseTo(toContent(view).x);
    expect(toContent(zoomed).y).toBeCloseTo(toContent(view).y);
  });

  it('한계에 닿아 배율이 바뀌지 않으면 같은 참조를 돌려준다', () => {
    const atMax = { x: 0, y: 0, scale: DRAWING_SCALE_MAX };
    expect(zoomDrawingAt(atMax, 2, { x: 5, y: 5 })).toBe(atMax);
    const atMin = { x: 0, y: 0, scale: DRAWING_SCALE_MIN };
    expect(zoomDrawingAt(atMin, 0.5, { x: 5, y: 5 })).toBe(atMin);
  });

  it('한계를 넘는 배율은 한계에서 멈춘다', () => {
    const view = { x: 0, y: 0, scale: DRAWING_SCALE_MAX / 2 };
    expect(zoomDrawingAt(view, 10, { x: 0, y: 0 }).scale).toBe(DRAWING_SCALE_MAX);
  });
});

describe('actualSizeDrawingView', () => {
  it('100% 로 가운데에 놓는다(도면이 더 크면 음수 좌표)', () => {
    expect(actualSizeDrawingView(viewport, { width: 400, height: 200 })).toEqual({
      x: 300,
      y: 200,
      scale: 1,
    });
    expect(actualSizeDrawingView(viewport, { width: 2000, height: 600 }).x).toBe(-500);
  });
});
