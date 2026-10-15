/**
 * 바닥(XZ) 발자국 기하 — 선택 박스가 대상의 실제 방향으로 눕도록 볼록 껍질과
 * 최소 면적 사각형을 구한다(selection-bounding-box.ts 가 쓴다).
 *
 * 점 목록은 `[x0, z0, x1, z1, ...]` 평탄 배열이다. 지도 GLB 는 정점이 수백만
 * 개라 껍질은 두 번의 순회로 만든다 — 첫 순회로 8방향 극점 팔각형을 잡고,
 * 둘째 순회에서 그 안쪽에 엄격히 든 점을 버린다(Akl–Toussaint). 남은 점만
 * 정렬하므로 정렬 비용이 정점 수에 끌려가지 않는다.
 */

/** 볼록 껍질 위의 최소 면적 사각형. 축 u·v 는 단위 벡터이고 v 는 u 를 +90° 돌린 것. */
export interface XZRect {
  /** u 축 (cos θ, sin θ) — XZ 평면 각 θ 는 atan2(z, x) 기준. */
  ux: number;
  uz: number;
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  area: number;
}

const cross = (
  ax: number,
  az: number,
  bx: number,
  bz: number,
  px: number,
  pz: number,
) => (bx - ax) * (pz - az) - (bz - az) * (px - ax);

/**
 * 평탄 점 배열의 볼록 껍질(반시계, 공선점 제거). 넓이가 없으면(점 하나·한 직선
 * 위) 양 끝점만 — 점이 하나뿐이면 그 점만 — 돌려준다.
 */
export function convexHullXZ(points: ArrayLike<number>): number[] {
  const n = Math.floor(points.length / 2);
  const order: number[] = [];
  for (let i = 0; i < n; i += 1) order.push(i);
  order.sort(
    (a, b) =>
      points[a * 2] - points[b * 2] || points[a * 2 + 1] - points[b * 2 + 1],
  );
  const sorted: number[] = [];
  for (const i of order) sorted.push(points[i * 2], points[i * 2 + 1]);
  return hullOfSorted(sorted);
}

/** x, 다음 z 오름차순으로 정렬된 평탄 점 배열의 볼록 껍질(Andrew 단조 사슬). */
function hullOfSorted(sorted: readonly number[]): number[] {
  const n = sorted.length / 2;
  if (n === 0) return [];
  const chain: number[] = [];
  const build = (indices: Iterable<number>) => {
    const start = chain.length;
    for (const i of indices) {
      const x = sorted[i * 2];
      const z = sorted[i * 2 + 1];
      while (
        chain.length - start >= 4 &&
        cross(
          chain[chain.length - 4],
          chain[chain.length - 3],
          chain[chain.length - 2],
          chain[chain.length - 1],
          x,
          z,
        ) <= 0
      ) {
        chain.length -= 2;
      }
      chain.push(x, z);
    }
    // 마지막 점은 다음 사슬의 첫 점이라 뺀다.
    chain.length -= 2;
  };
  const forward: number[] = [];
  for (let i = 0; i < n; i += 1) forward.push(i);
  build(forward);
  build(forward.reverse());

  if (chain.length < 6) {
    // 공선·중복뿐 — 정렬 순서의 양 끝점이 선분의 끝이다.
    const fx = sorted[0];
    const fz = sorted[1];
    const lx = sorted[n * 2 - 2];
    const lz = sorted[n * 2 - 1];
    return fx === lx && fz === lz ? [fx, fz] : [fx, fz, lx, lz];
  }
  return chain;
}

/**
 * 16비트 이하 정수 배열이면 (x, z) 를 32비트 키 하나로 묶을 오프셋 — 양자화
 * GLB(KHR_mesh_quantization)의 위치가 이것이다. 키를 숫자 정렬하면 x, 다음 z
 * 순서가 되고 같은 점이 붙어 한 번에 걸러진다. 그 밖의 배열은 null.
 */
function integerPackOffset(array: ArrayLike<number>): number | null {
  if (array instanceof Int16Array) return 32768;
  if (array instanceof Int8Array) return 128;
  if (
    array instanceof Uint16Array ||
    array instanceof Uint8Array ||
    array instanceof Uint8ClampedArray
  ) {
    return 0;
  }
  return null;
}

/**
 * 정점 배열의 XZ 볼록 껍질. 정점 i 의 x 는 `array[i * stride + xIndex]`,
 * z 는 `array[i * stride + zIndex]` 다 — three 의 BufferAttribute(stride =
 * itemSize)·InterleavedBufferAttribute(stride = data.stride, 인덱스에 offset)를
 * 복사 없이 읽는다. 성분 하나라도 비유한값인 정점은 버린다 — `yIndex` 를 주면
 * y 도 본다. 유효한 정점이 없으면 빈 배열.
 *
 * 지도 한 장이 수백만 정점이라 콜백 없이 배열을 직접 두 번 돈다.
 */
export function convexHullOfStrided(
  array: ArrayLike<number>,
  count: number,
  stride: number,
  xIndex: number,
  zIndex: number,
  yIndex?: number,
): number[] {
  const isValid = (o: number, x: number, z: number) =>
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    (yIndex === undefined || Number.isFinite(array[o + yIndex]));
  // 8방향(반시계: +x, +x+z, +z, −x+z, −x, −x−z, −z, +x−z) 극점과 그 점수.
  let s0 = -Infinity;
  let s1 = -Infinity;
  let s2 = -Infinity;
  let s3 = -Infinity;
  let s4 = -Infinity;
  let s5 = -Infinity;
  let s6 = -Infinity;
  let s7 = -Infinity;
  const ex = new Array<number>(16).fill(0);
  let valid = 0;
  for (let i = 0, o = 0; i < count; i += 1, o += stride) {
    const x = array[o + xIndex];
    const z = array[o + zIndex];
    if (!isValid(o, x, z)) continue;
    valid += 1;
    if (x > s0) {
      s0 = x;
      ex[0] = x;
      ex[1] = z;
    }
    if (x + z > s1) {
      s1 = x + z;
      ex[2] = x;
      ex[3] = z;
    }
    if (z > s2) {
      s2 = z;
      ex[4] = x;
      ex[5] = z;
    }
    if (z - x > s3) {
      s3 = z - x;
      ex[6] = x;
      ex[7] = z;
    }
    if (-x > s4) {
      s4 = -x;
      ex[8] = x;
      ex[9] = z;
    }
    if (-x - z > s5) {
      s5 = -x - z;
      ex[10] = x;
      ex[11] = z;
    }
    if (-z > s6) {
      s6 = -z;
      ex[12] = x;
      ex[13] = z;
    }
    if (x - z > s7) {
      s7 = x - z;
      ex[14] = x;
      ex[15] = z;
    }
  }
  if (valid === 0) return [];

  // 팔각형이 넓이를 가질 때만 거른다 — 퇴화(점·선분)면 안쪽이 없다.
  let doubleArea = 0;
  for (let k = 0; k < 8; k += 1) {
    const j = (k + 1) % 8;
    doubleArea += ex[k * 2] * ex[j * 2 + 1] - ex[j * 2] * ex[k * 2 + 1];
  }
  const canFilter = doubleArea > 0;
  // 변마다 직선식 A·x + B·z + C (> 0 이 안쪽 — cross 를 전개한 것). 같은 점이
  // 두 방향의 극점이면 그 변은 제약이 없어 뺀다.
  const lines: number[] = [];
  for (let k = 0; k < 8; k += 1) {
    const j = (k + 1) % 8;
    const ax = ex[k * 2];
    const az = ex[k * 2 + 1];
    const dx = ex[j * 2] - ax;
    const dz = ex[j * 2 + 1] - az;
    if (dx === 0 && dz === 0) continue;
    lines.push(-dz, dx, dz * ax - dx * az);
  }
  const lineCount = lines.length;
  const strictlyInside = (x: number, z: number) => {
    for (let k = 0; k < lineCount; k += 3) {
      if (lines[k] * x + lines[k + 1] * z + lines[k + 2] <= 0) return false;
    }
    return true;
  };

  // 정수 배열 — 건물 벽 정점은 투영하면 거의 전부 발자국 경계 위라 팔각형이
  // 잘 거르지 못한다. 비교 함수 정렬 대신 묶은 키를 숫자 정렬하고 중복을 뺀다.
  const packOffset = integerPackOffset(array);
  if (packOffset !== null) {
    const keys = new Uint32Array(valid);
    let m = 0;
    for (let i = 0, o = 0; i < count; i += 1, o += stride) {
      const x = array[o + xIndex];
      const z = array[o + zIndex];
      if (canFilter && strictlyInside(x, z)) continue;
      keys[m] = (x + packOffset) * 65536 + (z + packOffset);
      m += 1;
    }
    const sortedKeys = keys.subarray(0, m).sort();
    const sorted: number[] = [];
    let previous = -1;
    for (const key of sortedKeys) {
      if (key === previous) continue;
      previous = key;
      sorted.push(
        Math.floor(key / 65536) - packOffset,
        (key % 65536) - packOffset,
      );
    }
    return hullOfSorted(sorted);
  }

  const candidates: number[] = [];
  for (let i = 0, o = 0; i < count; i += 1, o += stride) {
    const x = array[o + xIndex];
    const z = array[o + zIndex];
    if (!isValid(o, x, z)) continue;
    if (canFilter && strictlyInside(x, z)) continue;
    candidates.push(x, z);
  }
  return convexHullXZ(candidates);
}

/**
 * 볼록 껍질(반시계)의 최소 면적 외접 사각형 — 한 변이 껍질의 한 변에 놓인다
 * (회전 캘리퍼스 정리). 껍질 점이 3개 미만이면 null.
 */
export function minAreaRectXZ(hull: ArrayLike<number>): XZRect | null {
  const n = Math.floor(hull.length / 2);
  if (n < 3) return null;
  let best: XZRect | null = null;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const dx = hull[j * 2] - hull[i * 2];
    const dz = hull[j * 2 + 1] - hull[i * 2 + 1];
    const len = Math.hypot(dx, dz);
    if (len === 0) continue;
    const ux = dx / len;
    const uz = dz / len;
    let uMin = Infinity;
    let uMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    for (let k = 0; k < n; k += 1) {
      const x = hull[k * 2];
      const z = hull[k * 2 + 1];
      const u = x * ux + z * uz;
      const v = -x * uz + z * ux;
      if (u < uMin) uMin = u;
      if (u > uMax) uMax = u;
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    }
    const area = (uMax - uMin) * (vMax - vMin);
    if (!best || area < best.area) {
      best = { ux, uz, uMin, uMax, vMin, vMax, area };
    }
  }
  return best;
}

/**
 * 볼록 껍질에 맞춘 바닥 사각형의 네 꼭짓점(한 바퀴 순서). 최소 면적 사각형이
 * 축 정렬 사각형보다 `minGain` 비율 이상 작을 때만 돌린 사각형이고, 아니면 축
 * 정렬 사각형이다 — 축 정렬 쪽은 껍질의 min/max 값 그대로라 축에 나란한 객체의
 * 박스는 오차가 없다. 껍질이 비면 null.
 */
export function fitFootprintCornersXZ(
  hull: ArrayLike<number>,
  minGain: number,
): [number, number][] | null {
  if (hull.length < 2) return null;
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < hull.length; i += 2) {
    x0 = Math.min(x0, hull[i]);
    x1 = Math.max(x1, hull[i]);
    z0 = Math.min(z0, hull[i + 1]);
    z1 = Math.max(z1, hull[i + 1]);
  }
  const rect = minAreaRectXZ(hull);
  const aabbArea = (x1 - x0) * (z1 - z0);
  if (rect && rect.area < aabbArea * (1 - minGain)) {
    return xzRectCorners(rect);
  }
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
}

/** 사각형의 네 꼭짓점 XZ — (uMin,vMin) → (uMax,vMin) → (uMax,vMax) → (uMin,vMax). */
export function xzRectCorners(rect: XZRect): [number, number][] {
  const { ux, uz } = rect;
  const at = (u: number, v: number): [number, number] => [
    u * ux - v * uz,
    u * uz + v * ux,
  ];
  return [
    at(rect.uMin, rect.vMin),
    at(rect.uMax, rect.vMin),
    at(rect.uMax, rect.vMax),
    at(rect.uMin, rect.vMax),
  ];
}
