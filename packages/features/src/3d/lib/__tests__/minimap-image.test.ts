import { describe, expect, it } from 'vitest';
import {
  MINIMAP_EXPOSURE_MAX,
  MINIMAP_EXPOSURE_MIN,
  MINIMAP_TARGET_LUMINANCE,
  acesFilmic,
  autoExposure,
  linearToSrgb,
  meanLinearLuminance,
  toDisplayPixels,
} from '../minimap-image';

describe('meanLinearLuminance', () => {
  it('빈 버퍼는 0, 흰색은 1, 검정은 0', () => {
    expect(meanLinearLuminance(new Uint8Array(0))).toBe(0);
    expect(
      meanLinearLuminance(new Uint8Array([255, 255, 255, 255])),
    ).toBeCloseTo(1, 10);
    expect(meanLinearLuminance(new Uint8Array([0, 0, 0, 255]))).toBe(0);
  });

  it('알파는 무시하고 픽셀 평균을 낸다', () => {
    const rgba = new Uint8Array([255, 255, 255, 0, 0, 0, 0, 255]);
    expect(meanLinearLuminance(rgba)).toBeCloseTo(0.5, 10);
  });
});

describe('autoExposure', () => {
  it('목표보다 밝으면 1 (낮 화면은 손대지 않음)', () => {
    expect(autoExposure(MINIMAP_TARGET_LUMINANCE)).toBe(MINIMAP_EXPOSURE_MIN);
    expect(autoExposure(0.9)).toBe(MINIMAP_EXPOSURE_MIN);
  });

  it('어두우면 목표/평균, 상한까지', () => {
    expect(autoExposure(MINIMAP_TARGET_LUMINANCE / 2)).toBeCloseTo(2, 10);
    expect(autoExposure(0.0001)).toBe(MINIMAP_EXPOSURE_MAX);
  });

  it('0·음수·NaN 은 상한', () => {
    expect(autoExposure(0)).toBe(MINIMAP_EXPOSURE_MAX);
    expect(autoExposure(-1)).toBe(MINIMAP_EXPOSURE_MAX);
    expect(autoExposure(NaN)).toBe(MINIMAP_EXPOSURE_MAX);
  });
});

describe('acesFilmic / linearToSrgb', () => {
  it('0→0, 단조 증가, 큰 입력은 1 로 수렴', () => {
    expect(acesFilmic(0)).toBe(0);
    expect(acesFilmic(0.5)).toBeGreaterThan(acesFilmic(0.2));
    expect(acesFilmic(100)).toBeLessThanOrEqual(1);
    expect(acesFilmic(100)).toBeGreaterThan(0.95);
    expect(acesFilmic(-1)).toBe(0);
  });

  it('sRGB 전달 함수 경계값', () => {
    expect(linearToSrgb(0)).toBe(0);
    expect(linearToSrgb(1)).toBeCloseTo(1, 10);
    expect(linearToSrgb(0.0031308)).toBeCloseTo(0.0031308 * 12.92, 10);
    expect(linearToSrgb(2)).toBeCloseTo(1, 10);
    expect(linearToSrgb(-1)).toBe(0);
  });
});

describe('toDisplayPixels', () => {
  it('길이 불일치·0 크기·비정수 크기는 null', () => {
    expect(toDisplayPixels(new Uint8Array(4), 2, 1, 1)).toBeNull();
    expect(toDisplayPixels(new Uint8Array(0), 0, 0, 1)).toBeNull();
    expect(toDisplayPixels(new Uint8Array(4), 1.5, 1, 1)).toBeNull();
  });

  it('행을 뒤집고(readPixels 아래→위) 알파를 255 로 채운다', () => {
    // 2×2, 아래 행이 먼저: [row1: 검정, 검정], [row0: 흰, 흰]
    const src = new Uint8Array([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0, //
      255,
      255,
      255,
      0,
      255,
      255,
      255,
      0,
    ]);
    const out = toDisplayPixels(src, 2, 2, 1)!;
    // 출력 row0 = 입력 마지막 행(흰 — 톤매핑을 거쳐 밝은 값), row1 = 검정
    expect(out[0]).toBeGreaterThan(200);
    expect(out[3]).toBe(255);
    expect(Array.from(out.slice(8, 12))).toEqual([0, 0, 0, 255]);
    // 입력은 불변
    expect(src[3]).toBe(0);
  });

  it('노출 배율이 클수록 밝아지고, 0·NaN 노출은 1 로 취급', () => {
    const src = new Uint8Array([64, 64, 64, 255]);
    const neutral = toDisplayPixels(src, 1, 1, 1)!;
    const bright = toDisplayPixels(src, 1, 1, 4)!;
    expect(bright[0]).toBeGreaterThan(neutral[0]);
    expect(toDisplayPixels(src, 1, 1, 0)![0]).toBe(neutral[0]);
    expect(toDisplayPixels(src, 1, 1, NaN)![0]).toBe(neutral[0]);
  });

  it('흰색 입력은 거의 흰색, 검정은 검정', () => {
    const white = toDisplayPixels(
      new Uint8Array([255, 255, 255, 255]),
      1,
      1,
      1,
    )!;
    expect(white[0]).toBeGreaterThan(200);
    const black = toDisplayPixels(new Uint8Array([0, 0, 0, 255]), 1, 1, 1)!;
    expect(black[0]).toBe(0);
  });
});
