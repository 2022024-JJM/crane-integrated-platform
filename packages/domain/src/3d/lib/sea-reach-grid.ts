/**
 * 바다 도달 격자 — "이 위치에 바다가 실제로 닿는가" 를 XZ 격자로 계산한다.
 * three 의존이 없는 순수 로직이고, 지도 메시를 읽어 이 격자를 채우는 쪽은
 * sea-reach-mask.ts 다.
 *
 * 수면 아래 잠김 안개(sea-submersion.ts)는 월드 y 만으로는 정할 수 없다.
 * 드라이독·육지 안쪽 저지대는 수면보다 낮아도 벽과 땅에 막혀 물이 없다.
 * 그래서 지도를 위에서 본 덮개(cover) 격자를 만들고 열린 바다에서 물을
 * 퍼뜨려(flood fill) 닿는 칸만 잠긴 곳으로 본다.
 *
 * 칸의 덮개 상태는 셋이다.
 *  - NONE    : 지면이 없다(열린 바다).
 *  - BELOW   : 지면이 있고 그 칸의 가장 높은 곳도 수면 아래다.
 *  - BARRIER : 칸 안에 수면 이상인 곳이 있다(육지·안벽·도크 게이트).
 *
 * 물은 NONE 칸 전부와 격자 테두리의 BELOW 칸에서 출발해 BARRIER 가 아닌
 * 칸으로 4방향으로 퍼진다. NONE 을 전부 출발점으로 두는 이유: 다리·잔교가
 * 위에서 보면 수로를 끊지만 물은 그 밑으로 통한다 — 지면 없는 칸은 막혀
 * 보여도 바다다. 벽은 8방향으로 이어진 칸 줄이 되므로(가장자리를 반 칸
 * 간격으로 찍는다) 4방향 확산은 대각선 벽도 새지 않는다.
 *
 * BARRIER 칸은 벽 자신과 벽에 붙은 바닥 띠(칸 크기 이내)를 함께 담는다. 벽
 * 양쪽 중 어느 쪽 규칙을 따를지는 이웃으로 정한다(resolveSeaReach):
 * 마른 분지에 붙은 칸은 마른 곳, 물에만 붙은 칸은 잠긴 곳이다.
 */

export const SEA_COVER_NONE = 0;
export const SEA_COVER_BELOW = 1;
export const SEA_COVER_BARRIER = 2;

/** 마스크 값 — 텍스처 R 채널(0‥255)로 그대로 올라간다. */
export const SEA_REACH_DRY = 0;
export const SEA_REACH_WET = 255;

/**
 * 법선의 y 성분 절댓값이 이보다 작으면 벽이다. 벽은 위에서 본 면적이 없어
 * 가장자리만 찍고, 앞뒤(머티리얼 side)를 가리지 않는다 — 어느 쪽을 보든 물을
 * 막는다.
 */
export const SEA_WALL_NORMAL_Y = 0.2;

/** 가장자리를 찍는 간격(칸 단위). 0.5 면 지나는 칸이 8방향으로 이어진다. */
const EDGE_STEP_CELLS = 0.5;

/**
 * 격자 좌표계 — 월드 XZ 축에 나란하다. 칸 (i, j) 는 x 가
 * [minX + i·cellSize, minX + (i+1)·cellSize), z 가 같은 식인 정사각형이다.
 */
export interface SeaReachFrame {
  /** 격자 (0,0) 칸 모서리의 월드 x, z. */
  minX: number;
  minZ: number;
  cellSize: number;
  width: number;
  height: number;
}

export interface SeaReachFrameInput {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  /** 바라는 칸 크기(m). 격자가 maxCells 를 넘으면 그만큼 커진다. */
  cellSize: number;
  /** 한 변의 최대 칸 수. */
  maxCells: number;
}

/** 범위를 덮는 격자를 만든다. 범위·칸 크기가 유한한 양수가 아니면 null. */
export function createSeaReachFrame(
  input: SeaReachFrameInput,
): SeaReachFrame | null {
  const { minX, minZ, maxX, maxZ, cellSize, maxCells } = input;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minZ) ||
    !Number.isFinite(spanX) ||
    !Number.isFinite(spanZ) ||
    !Number.isFinite(cellSize) ||
    !Number.isFinite(maxCells) ||
    spanX <= 0 ||
    spanZ <= 0 ||
    cellSize <= 0 ||
    maxCells < 1
  ) {
    return null;
  }
  const limit = Math.floor(maxCells);
  const cell = Math.max(cellSize, spanX / limit, spanZ / limit);
  return {
    minX,
    minZ,
    cellSize: cell,
    width: Math.min(limit, Math.max(1, Math.ceil(spanX / cell))),
    height: Math.min(limit, Math.max(1, Math.ceil(spanZ / cell))),
  };
}

/**
 * 월드 (x, z, 1) → 마스크 uv 의 3×3 행렬(행 우선 9개). 셰이더의
 * `seaReachTransform` 유니폼이다.
 */
export function seaReachUvTransform(frame: SeaReachFrame): number[] {
  const spanX = frame.width * frame.cellSize;
  const spanZ = frame.height * frame.cellSize;
  return [
    1 / spanX,
    0,
    -frame.minX / spanX,
    0,
    1 / spanZ,
    -frame.minZ / spanZ,
    0,
    0,
    1,
  ];
}

export type SeaTriangleSide = 'front' | 'back' | 'double';

/** 삼각형 하나 — 월드 좌표 정점 셋과 그리는 면. */
export interface SeaTriangle {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  cx: number;
  cy: number;
  cz: number;
  side: SeaTriangleSide;
  /** 거울상 변환(행렬식 음수) — 렌더러가 앞면 판정을 뒤집는다. */
  mirrored: boolean;
}

function mark(
  cover: Uint8Array,
  frame: SeaReachFrame,
  i: number,
  j: number,
  y: number,
  seaLevel: number,
): void {
  if (i < 0 || j < 0 || i >= frame.width || j >= frame.height) return;
  const state = y >= seaLevel ? SEA_COVER_BARRIER : SEA_COVER_BELOW;
  const k = j * frame.width + i;
  if (state > cover[k]) cover[k] = state;
}

function markEdge(
  cover: Uint8Array,
  frame: SeaReachFrame,
  seaLevel: number,
  u0: number,
  v0: number,
  y0: number,
  u1: number,
  v1: number,
  y1: number,
): number {
  // 격자 밖으로 길게 뻗은 가장자리는 격자 안 구간만 찍는다.
  let from = 0;
  let to = 1;
  const clip = (start: number, delta: number, limit: number): boolean => {
    if (delta === 0) return start >= 0 && start < limit;
    const a = (0 - start) / delta;
    const b = (limit - start) / delta;
    from = Math.max(from, Math.min(a, b));
    to = Math.min(to, Math.max(a, b));
    return from <= to;
  };
  if (!clip(u0, u1 - u0, frame.width)) return 0;
  if (!clip(v0, v1 - v0, frame.height)) return 0;
  const length = Math.hypot(u1 - u0, v1 - v0) * (to - from);
  const steps = Math.max(1, Math.ceil(length / EDGE_STEP_CELLS));
  const span = to - from;
  for (let step = 0; step <= steps; step += 1) {
    const ratio = from + (step / steps) * span;
    mark(
      cover,
      frame,
      Math.floor(u0 + (u1 - u0) * ratio),
      Math.floor(v0 + (v1 - v0) * ratio),
      y0 + (y1 - y0) * ratio,
      seaLevel,
    );
  }
  return steps + 1;
}

/**
 * 삼각형 하나를 덮개 격자에 찍는다. 살핀 칸 수를 돌려준다(건너뛰었으면 0) —
 * 호출자가 일의 양을 세어 나눠 돌리는 데 쓴다.
 *
 * - 위에서 보이는 면(위를 향한 앞면, 양면, 아래를 향한 뒷면)은 칸 중심을
 *   표본으로 면적을 채우고 가장자리도 찍는다.
 * - 벽은 가장자리만 찍는다.
 * - 위에서 보이지 않는 면(슬래브 밑면, 지도에 딸려 온 아래 향한 평면)은
 *   건너뛴다 — 컬링돼 화면에 없는 면이 바다를 막으면 안 된다.
 * - 좌표가 유한하지 않거나 넓이가 없는 삼각형, 격자 밖 삼각형은 건너뛴다.
 */
export function markSeaTriangle(
  cover: Uint8Array,
  frame: SeaReachFrame,
  triangle: SeaTriangle,
  seaLevel: number,
): number {
  const { ax, ay, az, bx, by, bz, cx, cy, cz } = triangle;
  const e1x = bx - ax;
  const e1y = by - ay;
  const e1z = bz - az;
  const e2x = cx - ax;
  const e2y = cy - ay;
  const e2z = cz - az;
  const nx = e1y * e2z - e1z * e2y;
  let ny = e1z * e2x - e1x * e2z;
  const nz = e1x * e2y - e1y * e2x;
  const length = Math.hypot(nx, ny, nz);
  if (!Number.isFinite(length) || length <= 0) return 0;
  if (triangle.mirrored) ny = -ny;

  const wall = Math.abs(ny) / length < SEA_WALL_NORMAL_Y;
  if (!wall) {
    const topVisible =
      triangle.side === 'double' ||
      (ny > 0 ? triangle.side === 'front' : triangle.side === 'back');
    if (!topVisible) return 0;
  }

  const inv = 1 / frame.cellSize;
  const ua = (ax - frame.minX) * inv;
  const va = (az - frame.minZ) * inv;
  const ub = (bx - frame.minX) * inv;
  const vb = (bz - frame.minZ) * inv;
  const uc = (cx - frame.minX) * inv;
  const vc = (cz - frame.minZ) * inv;

  const minU = Math.min(ua, ub, uc);
  const maxU = Math.max(ua, ub, uc);
  const minV = Math.min(va, vb, vc);
  const maxV = Math.max(va, vb, vc);
  if (maxU < 0 || maxV < 0 || minU >= frame.width || minV >= frame.height) {
    return 0;
  }

  let examined = 0;
  if (!wall) {
    const denominator = (vb - vc) * (ua - uc) + (uc - ub) * (va - vc);
    if (denominator !== 0) {
      const i0 = Math.max(0, Math.floor(minU));
      const i1 = Math.min(frame.width - 1, Math.floor(maxU));
      const j0 = Math.max(0, Math.floor(minV));
      const j1 = Math.min(frame.height - 1, Math.floor(maxV));
      examined += (i1 - i0 + 1) * (j1 - j0 + 1);
      for (let j = j0; j <= j1; j += 1) {
        const v = j + 0.5;
        for (let i = i0; i <= i1; i += 1) {
          const u = i + 0.5;
          const wa =
            ((vb - vc) * (u - uc) + (uc - ub) * (v - vc)) / denominator;
          const wb =
            ((vc - va) * (u - uc) + (ua - uc) * (v - vc)) / denominator;
          const wc = 1 - wa - wb;
          if (wa < 0 || wb < 0 || wc < 0) continue;
          mark(cover, frame, i, j, wa * ay + wb * by + wc * cy, seaLevel);
        }
      }
    }
  }

  examined += markEdge(cover, frame, seaLevel, ua, va, ay, ub, vb, by);
  examined += markEdge(cover, frame, seaLevel, ub, vb, by, uc, vc, cy);
  examined += markEdge(cover, frame, seaLevel, uc, vc, cy, ua, va, ay);
  return examined;
}

/** 한 번에 처리하는 칸 수 — 이만큼마다 호출자에게 제어를 돌려준다. */
const RESOLVE_CHUNK_CELLS = 1 << 17;

/**
 * 덮개 격자에서 바다 도달 마스크를 만든다. 제너레이터라 호출자가 시간 예산에
 * 맞춰 나눠 돌린다(끝까지 돌리면 return 값이 마스크).
 *
 * 1. 물 퍼뜨리기 — NONE 칸 전부와 테두리의 BELOW 칸에서 출발, BARRIER 가
 *    아닌 칸으로 4방향.
 * 2. 닿지 않은 BELOW 칸은 마른 분지(드라이독·육지 안 저지대)다.
 * 3. BARRIER 칸은 8방향 이웃으로 정한다 — 마른 분지에 붙어 있으면 마른 곳
 *    (도크 벽·게이트와 그 옆 바닥 띠), 아니고 물에 붙어 있으면 잠긴 곳(안벽과
 *    그 옆 해저 띠), 둘 다 아니면(육지 안쪽) 마른 곳.
 */
export function* resolveSeaReach(
  cover: Uint8Array,
  width: number,
  height: number,
): Generator<void, Uint8Array> {
  const size = width * height;
  const wet = new Uint8Array(size);
  const stack = new Int32Array(size);
  let top = 0;

  const seed = (k: number) => {
    if (wet[k] !== 0 || cover[k] === SEA_COVER_BARRIER) return;
    wet[k] = 1;
    stack[top] = k;
    top += 1;
  };

  for (let k = 0; k < size; k += 1) {
    if (cover[k] === SEA_COVER_NONE) seed(k);
    if ((k + 1) % RESOLVE_CHUNK_CELLS === 0) yield;
  }
  for (let i = 0; i < width; i += 1) {
    seed(i);
    seed((height - 1) * width + i);
  }
  for (let j = 0; j < height; j += 1) {
    seed(j * width);
    seed(j * width + width - 1);
  }
  yield;

  let processed = 0;
  while (top > 0) {
    top -= 1;
    const k = stack[top];
    const i = k % width;
    if (i > 0) seed(k - 1);
    if (i < width - 1) seed(k + 1);
    if (k >= width) seed(k - width);
    if (k < size - width) seed(k + width);
    processed += 1;
    if (processed % RESOLVE_CHUNK_CELLS === 0) yield;
  }

  const mask = new Uint8Array(size);
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      const k = j * width + i;
      if (wet[k] !== 0) {
        mask[k] = SEA_REACH_WET;
        continue;
      }
      if (cover[k] !== SEA_COVER_BARRIER) continue;
      let touchesWet = false;
      let touchesDry = false;
      for (let dj = -1; dj <= 1 && !touchesDry; dj += 1) {
        const nj = j + dj;
        if (nj < 0 || nj >= height) continue;
        for (let di = -1; di <= 1; di += 1) {
          const ni = i + di;
          if (ni < 0 || ni >= width || (di === 0 && dj === 0)) continue;
          const n = nj * width + ni;
          if (wet[n] !== 0) {
            touchesWet = true;
          } else if (cover[n] === SEA_COVER_BELOW) {
            touchesDry = true;
            break;
          }
        }
      }
      if (touchesWet && !touchesDry) mask[k] = SEA_REACH_WET;
    }
    if ((j * width) % RESOLVE_CHUNK_CELLS < width) yield;
  }
  return mask;
}
