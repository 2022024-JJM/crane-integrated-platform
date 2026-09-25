import { describe, expect, it } from 'vitest';
import {
  acesFilmicToneMap,
  linearToSrgb,
  toDisplayPixels,
  toLinearFloatPixels,
  type RgbTriplet,
} from '../minimap-image';

/** 선형 회색 → 화면 sRGB 8bit(three ACESFilmic + sRGB 와 같은 경로). */
function greyToSrgb8(x: number): number {
  return Math.round(linearToSrgb(acesFilmicToneMap(x, x, x)[0]) * 255);
}

describe('acesFilmicToneMap', () => {
  it('three 의 ACESFilmicToneMapping 과 같은 값 — 회색 0.18 → 127, 0.05 → 50', () => {
    expect(Math.abs(greyToSrgb8(0.18) - 127)).toBeLessThanOrEqual(2);
    expect(Math.abs(greyToSrgb8(0.05) - 50)).toBeLessThanOrEqual(2);
  });

  it('채도 있는 입력도 three 와 비트 수준으로 같다 — (0.5,0.1,0.05)', () => {
    // 열 우선 mat3 을 그대로 곱한 독립 계산값. 행렬을 전치하면 어긋난다.
    const [r, g, b] = acesFilmicToneMap(0.5, 0.1, 0.05);
    expect(r).toBeCloseTo(0.5894725, 6);
    expect(g).toBeCloseTo(0.1095887, 6);
    expect(b).toBeCloseTo(0.0463403, 6);
  });

  it('입력 상한 경계쌍 — float16 최대값과 그 위·무한대는 같은 출력', () => {
    const atMax = acesFilmicToneMap(65504, 65504, 65504);
    expect(acesFilmicToneMap(65505, 65505, 65505)).toEqual(atMax);
    expect(
      acesFilmicToneMap(
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
      ),
    ).toEqual(atMax);
    expect(atMax[0]).toBeLessThanOrEqual(1);
  });

  it('회색 입력은 회색 출력(행렬의 행 합이 1)', () => {
    const [r, g, b] = acesFilmicToneMap(0.4, 0.4, 0.4);
    expect(r).toBeCloseTo(g, 4);
    expect(g).toBeCloseTo(b, 4);
  });

  it('행렬이 채널을 섞는다 — 순색 입력의 다른 채널이 채널별 곡선과 다르다', () => {
    const red = acesFilmicToneMap(1, 0, 0);
    const grey = acesFilmicToneMap(1, 1, 1);
    expect(red[0]).not.toBeCloseTo(grey[0], 3);
    expect(red[0]).toBeGreaterThan(0);
  });

  it('0→0, 단조 증가, 큰 입력·무한대는 1 이하', () => {
    expect(acesFilmicToneMap(0, 0, 0)).toEqual([0, 0, 0]);
    let prev = -1;
    for (const x of [0, 0.01, 0.05, 0.18, 0.5, 1, 2, 5, 20]) {
      const v = acesFilmicToneMap(x, x, x)[0];
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
    for (const x of [100, 1e6, Number.POSITIVE_INFINITY]) {
      const [r, g, b] = acesFilmicToneMap(x, x, x);
      expect(r).toBeLessThanOrEqual(1);
      expect(g).toBeLessThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(1);
      expect(r).toBeGreaterThan(0.95);
      expect(Number.isNaN(r)).toBe(false);
    }
  });

  it('음수·NaN 입력은 0', () => {
    expect(acesFilmicToneMap(-1, -0.5, Number.NEGATIVE_INFINITY)).toEqual([
      0, 0, 0,
    ]);
    expect(acesFilmicToneMap(Number.NaN, Number.NaN, Number.NaN)).toEqual([
      0, 0, 0,
    ]);
    // 채널 하나만 오염돼도 나머지는 정상.
    const [r, g] = acesFilmicToneMap(0.5, Number.NaN, 0.5);
    expect(r).toBeGreaterThan(0);
    expect(g).toBeGreaterThanOrEqual(0);
  });

  it('out 튜플을 주면 그것을 채워 돌려준다', () => {
    const out: RgbTriplet = [9, 9, 9];
    const result = acesFilmicToneMap(0.2, 0.2, 0.2, out);
    expect(result).toBe(out);
    expect(out[0]).toBeLessThan(1);
  });
});

describe('linearToSrgb', () => {
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
    expect(toDisplayPixels(new Float32Array(4), 2, 1)).toBeNull();
    expect(toDisplayPixels(new Float32Array(0), 0, 0)).toBeNull();
    expect(toDisplayPixels(new Float32Array(4), 1.5, 1)).toBeNull();
    expect(toDisplayPixels(new Float32Array(8), 1, 1)).toBeNull();
  });

  it('행을 뒤집고(readPixels 아래→위) 알파를 255 로 채운다', () => {
    // 2×2, 아래 행이 먼저: [row1: 검정, 검정], [row0: 흰, 흰]
    const src = new Float32Array([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0, //
      1,
      1,
      1,
      0,
      1,
      1,
      1,
      0,
    ]);
    const out = toDisplayPixels(src, 2, 2)!;
    // 출력 row0 = 입력 마지막 행(흰 — 톤매핑을 거쳐 밝은 값), row1 = 검정
    expect(out[0]).toBeGreaterThan(200);
    expect(out[3]).toBe(255);
    expect(Array.from(out.slice(8, 12))).toEqual([0, 0, 0, 255]);
    // 입력은 불변
    expect(src[3]).toBe(0);
    expect(src[8]).toBe(1);
  });

  it('픽셀마다 acesFilmicToneMap + sRGB 와 같은 값이다', () => {
    const src = new Float32Array([0.18, 0.05, 0.6, 1]);
    const out = toDisplayPixels(src, 1, 1)!;
    const mapped = acesFilmicToneMap(0.18, 0.05, 0.6);
    expect(out[0]).toBe(Math.round(linearToSrgb(mapped[0]) * 255));
    expect(out[1]).toBe(Math.round(linearToSrgb(mapped[1]) * 255));
    expect(out[2]).toBe(Math.round(linearToSrgb(mapped[2]) * 255));
    expect(out[3]).toBe(255);
  });

  it('결정적이다 — 같은 입력은 언제 처리해도 같은 출력', () => {
    const src = new Float32Array([0.25, 0.25, 0.25, 1]);
    expect(Array.from(toDisplayPixels(src, 1, 1)!)).toEqual(
      Array.from(toDisplayPixels(src, 1, 1)!),
    );
  });

  it('흰색 입력은 거의 흰색, 검정은 검정, HDR 값은 255 를 넘지 않고 NaN 은 0', () => {
    const white = toDisplayPixels(new Float32Array([1, 1, 1, 1]), 1, 1)!;
    expect(white[0]).toBeGreaterThan(200);
    const black = toDisplayPixels(new Float32Array([0, 0, 0, 1]), 1, 1)!;
    expect(black[0]).toBe(0);
    const hdr = toDisplayPixels(new Float32Array([50, 50, 50, 1]), 1, 1)!;
    expect(hdr[0]).toBe(255);
    const bad = toDisplayPixels(
      new Float32Array([Number.NaN, -1, Number.NaN, 1]),
      1,
      1,
    )!;
    expect(Array.from(bad)).toEqual([0, 0, 0, 255]);
  });
});

describe('toLinearFloatPixels', () => {
  it('Float32 는 같은 인스턴스를 그대로 돌려준다', () => {
    const src = new Float32Array([0.5, 1.5, 0, 1]);
    expect(toLinearFloatPixels(src)).toBe(src);
  });

  it('8bit 폴백은 0~255 를 0~1 로 편다 — 경계 0·255 정확', () => {
    const out = toLinearFloatPixels(new Uint8Array([0, 255, 51, 128]));
    expect(out).toBeInstanceOf(Float32Array);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(1);
    expect(out[2]).toBeCloseTo(0.2, 6);
    expect(out[3]).toBeCloseTo(128 / 255, 6);
  });

  it('빈 버퍼는 빈 버퍼', () => {
    expect(toLinearFloatPixels(new Uint8Array(0))).toHaveLength(0);
  });
});
