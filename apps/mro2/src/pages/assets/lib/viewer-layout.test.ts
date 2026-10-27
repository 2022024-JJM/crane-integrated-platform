import { describe, expect, it } from 'vitest';
import {
  VIEWER_MIN_ASPECT,
  VIEWER_SIDE_PANEL_PX,
  clampViewerHeight,
} from './viewer-layout';

describe('clampViewerHeight', () => {
  it('높이를 모르면 undefined, 폭을 모르면 높이 그대로', () => {
    expect(clampViewerHeight(undefined, 1000)).toBeUndefined();
    expect(clampViewerHeight(600, undefined)).toBe(600);
    expect(clampViewerHeight(600, VIEWER_SIDE_PANEL_PX)).toBe(600);
  });
  it('캔버스가 세로로 길어지면 비율 상한으로 자른다', () => {
    const grid = 1000 + VIEWER_SIDE_PANEL_PX; // 캔버스 1000px
    expect(clampViewerHeight(900, grid)).toBe(
      Math.floor(1000 / VIEWER_MIN_ASPECT),
    );
    expect(clampViewerHeight(500, grid)).toBe(500);
  });
});
