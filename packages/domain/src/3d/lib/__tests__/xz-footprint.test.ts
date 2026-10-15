import { describe, expect, it } from 'vitest';
import {
  convexHullOfStrided,
  convexHullXZ,
  fitFootprintCornersXZ,
  minAreaRectXZ,
  xzRectCorners,
} from '../xz-footprint';

/** 시드 고정 PRNG(mulberry32) — 테스트 결정론. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 평탄 배열 → [x, z] 쌍 목록 */
function pairs(flat: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
  return out;
}

function signedArea(hull: readonly number[]): number {
  let sum = 0;
  const n = hull.length / 2;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    sum += hull[i * 2] * hull[j * 2 + 1] - hull[j * 2] * hull[i * 2 + 1];
  }
  return sum / 2;
}

/** 중심 (0,0), 크기 w×h, θ 회전한 사각형의 꼭짓점 */
function rotatedRect(w: number, h: number, theta: number): [number, number][] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, z]) => [x * c - z * s, x * s + z * c]);
}

function expectSameCorners(
  actual: [number, number][],
  expected: [number, number][],
) {
  expect(actual).toHaveLength(expected.length);
  for (const [x, z] of expected) {
    const hit = actual.some(
      ([ax, az]) => Math.abs(ax - x) < 1e-9 && Math.abs(az - z) < 1e-9,
    );
    expect(hit, `corner (${x}, ${z}) in ${JSON.stringify(actual)}`).toBe(true);
  }
}

describe('convexHullXZ', () => {
  it('사각형 + 안쪽 점 → 꼭짓점 4개, 반시계', () => {
    const hull = convexHullXZ([0, 0, 2, 0, 2, 1, 0, 1, 1, 0.5, 0.3, 0.7]);
    expect(pairs(hull)).toHaveLength(4);
    expect(signedArea(hull)).toBeCloseTo(2, 12);
  });

  it('변 위의 공선점·중복점은 껍질에 오르지 않는다', () => {
    const hull = convexHullXZ([0, 0, 1, 0, 2, 0, 2, 0, 2, 2, 0, 2, 0, 1]);
    expect(pairs(hull)).toHaveLength(4);
  });

  it('한 직선 위의 점들은 양 끝점만, 점 하나는 그 점, 빈 입력은 빈 배열', () => {
    expect(convexHullXZ([0, 0, 1, 1, 2, 2, 3, 3])).toEqual([0, 0, 3, 3]);
    expect(convexHullXZ([5, 7])).toEqual([5, 7]);
    expect(convexHullXZ([5, 7, 5, 7, 5, 7])).toEqual([5, 7]);
    expect(convexHullXZ([])).toEqual([]);
  });
});

describe('convexHullOfStrided', () => {
  it('stride·인덱스로 XZ 만 읽는다 — 무작위 점에서 직접 껍질과 같다', () => {
    const rand = prng(7);
    const count = 2000;
    const xyz = new Float32Array(count * 3);
    const xz: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const x = Math.fround(rand() * 100 - 50);
      const y = Math.fround(rand() * 999);
      const z = Math.fround(rand() * 40 - 20);
      xyz.set([x, y, z], i * 3);
      xz.push(x, z);
    }
    expect(convexHullOfStrided(xyz, count, 3, 0, 2)).toEqual(convexHullXZ(xz));
  });

  it('interleaved(stride 6, offset 3) 배열도 같은 결과', () => {
    const rand = prng(11);
    const count = 300;
    const data = new Float32Array(count * 6);
    const xz: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const x = Math.fround(rand() * 10);
      const z = Math.fround(rand() * 10);
      data.set([rand(), rand(), rand(), x, rand(), z], i * 6);
      xz.push(x, z);
    }
    expect(convexHullOfStrided(data, count, 6, 3, 5)).toEqual(convexHullXZ(xz));
  });

  it('Int16(양자화) 빠른 길은 정수 비교 정렬 결과와 같다 — 극값 ±32767·−32768 포함', () => {
    const rand = prng(3);
    const count = 5000;
    const ints = new Int16Array(count * 3);
    const xz: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const x = Math.round(rand() * 65535) - 32768;
      const z = Math.round(rand() * 65535) - 32768;
      ints.set([x, 0, z], i * 3);
      xz.push(x, z);
    }
    ints.set([-32768, 0, 32767], 0);
    ints.set([32767, 0, -32768], 3);
    xz.splice(0, 4, -32768, 32767, 32767, -32768);
    expect(convexHullOfStrided(ints, count, 3, 0, 2)).toEqual(convexHullXZ(xz));
  });

  it('Uint8·Int8·Uint16 배열도 빠른 길로 같은 껍질', () => {
    const square = [0, 0, 0, 10, 0, 0, 10, 0, 10, 0, 0, 10, 5, 0, 5];
    const expected = convexHullXZ([0, 0, 10, 0, 10, 10, 0, 10, 5, 5]);
    expect(convexHullOfStrided(new Uint8Array(square), 5, 3, 0, 2)).toEqual(
      expected,
    );
    expect(convexHullOfStrided(new Uint16Array(square), 5, 3, 0, 2)).toEqual(
      expected,
    );
    const negative = new Int8Array(square.map((v) => v - 128 + 118));
    expect(convexHullOfStrided(negative, 5, 3, 0, 2)).toEqual(
      convexHullXZ([-10, -10, 0, -10, 0, 0, -10, 0, -5, -5]),
    );
  });

  it('건물 벽처럼 대부분 경계 위의 중복 정점이어도 꼭짓점 4개', () => {
    // 위·아래 두 겹 + 변마다 중간 정점(벽 분할) — 팔각형이 거르지 못하는 점들.
    const pts: number[] = [];
    for (const y of [0, 5]) {
      for (let t = 0; t <= 10; t += 1) {
        pts.push(t, y, 0, t, y, 4, 0, y, t * 0.4, 10, y, t * 0.4);
      }
    }
    const hull = convexHullOfStrided(
      new Int16Array(pts),
      pts.length / 3,
      3,
      0,
      2,
    );
    expectSameCorners(pairs(hull), [
      [0, 0],
      [10, 0],
      [10, 4],
      [0, 4],
    ]);
  });

  it('NaN·Infinity 정점은 버리고, 전부 비유한값이면 빈 배열', () => {
    const data = new Float32Array([
      0,
      0,
      0,
      1,
      0,
      0,
      NaN,
      0,
      99,
      0,
      0,
      1,
      Infinity,
      0,
      -Infinity,
    ]);
    expectSameCorners(pairs(convexHullOfStrided(data, 5, 3, 0, 2)), [
      [0, 0],
      [1, 0],
      [0, 1],
    ]);
    expect(
      convexHullOfStrided(new Float32Array([NaN, 0, NaN]), 1, 3, 0, 2),
    ).toEqual([]);
  });

  it('yIndex 를 주면 y 가 비유한값인 정점도 버리고, 안 주면 x·z 만 본다', () => {
    const data = new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1, 50, NaN, 50]);
    expect(pairs(convexHullOfStrided(data, 4, 3, 0, 2, 1))).toHaveLength(3);
    expect(
      pairs(convexHullOfStrided(data, 4, 3, 0, 2)).some(([x]) => x === 50),
    ).toBe(true);
  });

  it('정점 0개는 빈 배열, 모두 한 점이면 그 점(팔각형 퇴화)', () => {
    expect(convexHullOfStrided(new Float32Array(0), 0, 3, 0, 2)).toEqual([]);
    expect(
      convexHullOfStrided(new Int16Array([3, 1, 4, 3, 2, 4]), 2, 3, 0, 2),
    ).toEqual([3, 4]);
  });
});

describe('minAreaRectXZ', () => {
  it('30° 돌린 2×1 사각형 → 넓이 2, 축이 30°(또는 그 직각)', () => {
    const hull = convexHullXZ(rotatedRect(2, 1, Math.PI / 6).flat());
    const rect = minAreaRectXZ(hull)!;
    expect(rect.area).toBeCloseTo(2, 9);
    // 사각형은 90° 대칭이라 [0, 90) 으로 접어 본다.
    const deg = ((Math.atan2(rect.uz, rect.ux) * 180) / Math.PI + 360) % 90;
    expect(deg).toBeCloseTo(30, 6);
  });

  it('축 정렬 사각형은 축 정렬 넓이 그대로', () => {
    const rect = minAreaRectXZ(convexHullXZ([0, 0, 3, 0, 3, 2, 0, 2]))!;
    expect(rect.area).toBeCloseTo(6, 12);
  });

  it('껍질 점이 3개 미만이면 null', () => {
    expect(minAreaRectXZ([0, 0, 1, 1])).toBeNull();
    expect(minAreaRectXZ([0, 0])).toBeNull();
    expect(minAreaRectXZ([])).toBeNull();
  });

  it('xzRectCorners 는 사각형을 한 바퀴 도는 순서로 꼭짓점을 낸다', () => {
    const corners = xzRectCorners({
      ux: 0,
      uz: 1,
      uMin: 0,
      uMax: 2,
      vMin: 0,
      vMax: 1,
      area: 2,
    });
    // u = +z, v = −x
    expect(corners).toEqual([
      [0, 0],
      [0, 2],
      [-1, 2],
      [-1, 0],
    ]);
  });
});

describe('fitFootprintCornersXZ', () => {
  it('축 정렬 발자국은 min/max 값 그대로의 축 정렬 꼭짓점', () => {
    const hull = convexHullXZ([-0.5, -0.25, 1.5, -0.25, 1.5, 3, -0.5, 3]);
    expect(fitFootprintCornersXZ(hull, 0.1)).toEqual([
      [-0.5, -0.25],
      [1.5, -0.25],
      [1.5, 3],
      [-0.5, 3],
    ]);
  });

  it('39° 돌린 건물(2×1)은 그 방향의 사각형으로 맞춘다', () => {
    const shape = rotatedRect(2, 1, (39 * Math.PI) / 180);
    const corners = fitFootprintCornersXZ(convexHullXZ(shape.flat()), 0.1)!;
    expectSameCorners(corners, shape);
  });

  it('이득이 minGain 미만이면(2° 정사각형, 이득 약 6.5%) 축 정렬로 남는다', () => {
    const shape = rotatedRect(1, 1, (2 * Math.PI) / 180);
    const corners = fitFootprintCornersXZ(convexHullXZ(shape.flat()), 0.1)!;
    const xs = corners.map((c) => c[0]);
    const zs = corners.map((c) => c[1]);
    // 축 정렬 — 꼭짓점 x 값이 두 가지뿐이다.
    expect(new Set(xs).size).toBe(2);
    expect(new Set(zs).size).toBe(2);
  });

  it('minGain 경계 — 45° 정사각형(이득 50%)은 0.49 에서 돌리고 0.51 에서 안 돌린다', () => {
    const hull = convexHullXZ(rotatedRect(1, 1, Math.PI / 4).flat());
    const turned = fitFootprintCornersXZ(hull, 0.49)!;
    const kept = fitFootprintCornersXZ(hull, 0.51)!;
    expectSameCorners(turned, rotatedRect(1, 1, Math.PI / 4));
    expect(new Set(kept.map((c) => c[0])).size).toBe(2);
  });

  it('점 하나·선분은 축 정렬(퇴화) 꼭짓점, 빈 껍질은 null', () => {
    expect(fitFootprintCornersXZ([2, 3], 0.1)).toEqual([
      [2, 3],
      [2, 3],
      [2, 3],
      [2, 3],
    ]);
    expect(fitFootprintCornersXZ([0, 0, 4, 4], 0.1)).toEqual([
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ]);
    expect(fitFootprintCornersXZ([], 0.1)).toBeNull();
  });
});
