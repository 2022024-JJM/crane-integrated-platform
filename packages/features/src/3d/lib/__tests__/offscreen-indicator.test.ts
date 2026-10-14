import { describe, expect, it } from 'vitest';
import {
  OFFSCREEN_EDGE_MARGIN_PX,
  OFFSCREEN_TOP_MARGIN_PX,
  resolveEdgeIndicator,
} from '../offscreen-indicator';

const W = 1000;
const H = 600;
const M = OFFSCREEN_EDGE_MARGIN_PX;
const T = OFFSCREEN_TOP_MARGIN_PX;
/** 여백 안 사각형의 세로 중심 — 위 여백이 커서 화면 중심보다 아래. */
const CY = (T + (H - M)) / 2;

describe('resolveEdgeIndicator', () => {
  it('화면 안(여백 포함 경계)은 그대로, offscreen false', () => {
    expect(resolveEdgeIndicator(500, 300, W, H, false)).toEqual({
      x: 500,
      y: 300,
      angleDeg: 0,
      offscreen: false,
      side: 'left',
    });
    expect(resolveEdgeIndicator(M, T, W, H, false).offscreen).toBe(false);
    expect(resolveEdgeIndicator(M, T - 1, W, H, false).offscreen).toBe(true);
    expect(resolveEdgeIndicator(W - M, H - M, W, H, false).offscreen).toBe(
      false,
    );
  });

  it('여백 바깥 1px 부터 가장자리로 당겨지고 방향을 가리킨다', () => {
    const r = resolveEdgeIndicator(W + 100, CY, W, H, false);
    expect(r.offscreen).toBe(true);
    expect(r.side).toBe('right');
    expect(r.x).toBeCloseTo(W - M, 6);
    expect(r.y).toBeCloseTo(CY, 6);
    expect(r.angleDeg).toBeCloseTo(0, 6);
    const up = resolveEdgeIndicator(500, -50, W, H, false);
    expect(up.side).toBe('top');
    expect(up.y).toBeCloseTo(T, 6);
    expect(up.angleDeg).toBeCloseTo(-90, 6);
    expect(resolveEdgeIndicator(M - 1, 300, W, H, false).offscreen).toBe(true);
  });

  it('모서리 방향은 사각형 모서리 안에 머문다', () => {
    const r = resolveEdgeIndicator(W + 500, H + 300, W, H, false);
    expect(r.x).toBeLessThanOrEqual(W - M + 1e-6);
    expect(r.y).toBeLessThanOrEqual(H - M + 1e-6);
    expect(r.offscreen).toBe(true);
  });

  it('카메라 뒤는 중심 대칭으로 뒤집어 반대편 가장자리, 화면 안 좌표라도 offscreen', () => {
    // 뒤에서 투영된 점이 오른쪽에 보이면 실제는 왼쪽이다.
    const r = resolveEdgeIndicator(900, CY, W, H, true);
    expect(r.offscreen).toBe(true);
    expect(r.x).toBeCloseTo(M, 6);
    expect(r.side).toBe('left');
    expect(r.angleDeg).toBeCloseTo(180, 6);
  });

  it('NaN 투영은 표시하지 않는다', () => {
    expect(resolveEdgeIndicator(NaN, 1, W, H, false).offscreen).toBe(false);
  });
});
