import { describe, expect, it } from 'vitest';
import {
  centerCropRect,
  findOpaqueBounds,
  fitRectInSquare,
  THUMBNAIL_FILL,
} from '../thumbnail-crop';

/** width×height 투명 픽셀에 주어진 좌표만 알파를 채운다. */
function pixels(
  width: number,
  height: number,
  opaque: [x: number, y: number, alpha?: number][],
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y, alpha = 255] of opaque) {
    data[(y * width + x) * 4 + 3] = alpha;
  }
  return data;
}

describe('findOpaqueBounds', () => {
  it('전부 투명하면 null', () => {
    expect(findOpaqueBounds(pixels(4, 3, []), 4, 3)).toBeNull();
    expect(findOpaqueBounds(new Uint8ClampedArray(0), 0, 0)).toBeNull();
  });

  it('불투명한 픽셀을 감싸는 사각형을 낸다', () => {
    const data = pixels(8, 6, [
      [2, 1],
      [5, 4],
      [3, 2],
    ]);
    expect(findOpaqueBounds(data, 8, 6)).toEqual({
      x: 2,
      y: 1,
      width: 4,
      height: 4,
    });
  });

  it('픽셀 하나도 1×1 사각형이다', () => {
    expect(findOpaqueBounds(pixels(5, 5, [[4, 4]]), 5, 5)).toEqual({
      x: 4,
      y: 4,
      width: 1,
      height: 1,
    });
  });

  it('문턱 이하의 희미한 알파(가장자리 번짐)는 물체로 세지 않는다', () => {
    const data = pixels(6, 6, [
      [0, 0, 8],
      [3, 3, 9],
    ]);
    expect(findOpaqueBounds(data, 6, 6)).toEqual({
      x: 3,
      y: 3,
      width: 1,
      height: 1,
    });
  });

  it('화면 가장자리에 닿은 물체도 범위를 벗어나지 않는다', () => {
    const data = pixels(4, 4, [
      [0, 0],
      [3, 3],
    ]);
    expect(findOpaqueBounds(data, 4, 4)).toEqual({
      x: 0,
      y: 0,
      width: 4,
      height: 4,
    });
  });
});

describe('fitRectInSquare', () => {
  it('긴 변이 채움 비율에 맞고 가운데에 놓인다', () => {
    const wide = fitRectInSquare({ width: 400, height: 100 }, 512);
    expect(wide.width).toBeCloseTo(512 * THUMBNAIL_FILL);
    expect(wide.height).toBeCloseTo((512 * THUMBNAIL_FILL) / 4);
    expect(wide.x + wide.width / 2).toBeCloseTo(256);
    expect(wide.y + wide.height / 2).toBeCloseTo(256);

    const tall = fitRectInSquare({ width: 50, height: 500 }, 512);
    expect(tall.height).toBeCloseTo(512 * THUMBNAIL_FILL);
  });

  it('작은 물체는 키우고 큰 물체는 줄인다 — 결과 크기가 같다', () => {
    const small = fitRectInSquare({ width: 20, height: 10 }, 512);
    const large = fitRectInSquare({ width: 2000, height: 1000 }, 512);
    expect(small.width).toBeCloseTo(large.width);
    expect(small.height).toBeCloseTo(large.height);
  });

  it('크기 0 인 사각형에도 유한한 자리를 낸다', () => {
    const rect = fitRectInSquare({ width: 0, height: 0 }, 512);
    expect(Object.values(rect).every(Number.isFinite)).toBe(true);
  });
});

describe('centerCropRect', () => {
  it('원본이 더 넓으면 좌우를 같은 만큼 잘라 낸다', () => {
    expect(centerCropRect({ width: 2000, height: 500 }, 1.6)).toEqual({
      x: 600,
      y: 0,
      width: 800,
      height: 500,
    });
  });

  it('원본이 더 좁으면 위아래를 같은 만큼 잘라 낸다', () => {
    expect(centerCropRect({ width: 400, height: 1000 }, 1.6)).toEqual({
      x: 0,
      y: 375,
      width: 400,
      height: 250,
    });
  });

  it('비율이 이미 같으면 원본 전체다', () => {
    expect(centerCropRect({ width: 640, height: 400 }, 1.6)).toEqual({
      x: 0,
      y: 0,
      width: 640,
      height: 400,
    });
  });

  it('잘라 낸 자리는 원본을 벗어나지 않고 요청한 비율이다', () => {
    for (const [width, height] of [
      [1, 1],
      [3, 1000],
      [1920, 1080],
      [1080, 1920],
    ]) {
      for (const aspect of [0.25, 1, 1.6, 4]) {
        const rect = centerCropRect({ width, height }, aspect);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1e-9);
        expect(rect.y + rect.height).toBeLessThanOrEqual(height + 1e-9);
        expect(rect.width / rect.height).toBeCloseTo(aspect, 9);
      }
    }
  });

  it('크기가 0·음수·NaN 이면 원본을 그대로 돌려준다(나누지 않는다)', () => {
    expect(centerCropRect({ width: 0, height: 0 }, 1.6)).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
    expect(centerCropRect({ width: 100, height: 0 }, 1.6)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 0,
    });
    expect(centerCropRect({ width: -5, height: 10 }, 1.6).width).toBe(-5);
    expect(centerCropRect({ width: Number.NaN, height: 10 }, 1.6).x).toBe(0);
  });

  it('비율이 0·음수·NaN·Infinity 면 원본 전체다', () => {
    const full = { x: 0, y: 0, width: 300, height: 200 };
    for (const aspect of [0, -1, Number.NaN, Infinity, -Infinity]) {
      expect(centerCropRect({ width: 300, height: 200 }, aspect)).toEqual(full);
    }
  });
});
