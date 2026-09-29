import {
  BackSide,
  DoubleSide,
  Vector3,
  type BufferGeometry,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';
import { SEA_LEVEL_Y } from '../model/sea-level';
import { collectCollidableMeshes } from './collision-volumes';
import {
  createSeaReachFrame,
  markSeaTriangle,
  resolveSeaReach,
  seaReachUvTransform,
  type SeaReachFrame,
  type SeaTriangle,
  type SeaTriangleSide,
} from './sea-reach-grid';

/**
 * 바다 도달 마스크 빌더 — 씬의 지도 메시를 읽어 덮개 격자를 채우고
 * (sea-reach-grid.ts) "바다가 닿는 위치" 마스크를 만든다. 잠김 안개
 * (sea-submersion.ts)가 이 마스크를 월드 XZ 로 조회해, 수면보다 낮아도 물이
 * 닿지 않는 곳(드라이독·육지 안 저지대)의 모델과 지형에는 안개를 걸지 않는다.
 *
 * GPU 탑뷰 렌더가 아니라 삼각형을 직접 찍는 이유: 도크 게이트처럼 두께 없는
 * 벽은 위에서 본 면적이 없어 렌더에 한 픽셀도 남지 않는다. 벽을 놓치면
 * 도크가 통째로 바다로 샌다.
 *
 * 지도 한 벌이 백만 삼각형대라 한 번에 돌리면 수백 ms 멈춘다. 제너레이터로
 * 만들어 호출자(features 의 sea-reach-controller)가 시간 예산에 맞춰 나눠
 * 돌린다.
 *
 * 메시는 collectCollidableMeshes 로 모은다 — 항상 LOD0 이라 결과가 카메라
 * 거리에 따라 달라지지 않는다.
 */

/** 칸 크기(m). 좁은 틈(이보다 좁은 수로)은 막힌 것으로 본다. */
export const SEA_REACH_CELL_SIZE = 2;
/** 범위 지도 둘레로 격자를 넓히는 여유(m). 격자 밖은 바다로 본다. */
export const SEA_REACH_MARGIN = 200;
/** 격자 한 변의 최대 칸 수 — 넘으면 칸이 커진다. */
export const SEA_REACH_MAX_CELLS = 4096;

/** 정점 이만큼마다 호출자에게 제어를 돌려준다. */
const VERTEX_CHUNK = 1 << 15;
/**
 * 삼각형은 일의 양(살핀 칸 수 + 삼각형당 기본값)이 이만큼 쌓일 때마다 제어를
 * 돌려준다 — 개수로 끊으면 야드 슬래브처럼 큰 삼각형이 몰린 구간이 길어진다.
 */
const WORK_CHUNK = 1 << 16;
const WORK_PER_TRIANGLE = 8;

export interface SeaReachSource {
  root: Object3D;
  /**
   * 격자의 범위를 정하는 지도인지(바닥 지도). 하나도 없으면 전부가 범위를
   * 정한다. 범위 밖 지도(주변 지형)는 격자 안에 걸친 부분만 찍힌다.
   */
  bounds: boolean;
}

export interface SeaReachMask {
  /** 칸마다 0(마른 곳) 또는 255(바다가 닿는 곳). 행 우선, 첫 행이 v=0. */
  data: Uint8Array;
  width: number;
  height: number;
  /** 월드 (x, z, 1) → uv. 행 우선 9개. */
  transform: number[];
}

export interface SeaReachBuildOptions {
  seaLevel?: number;
  cellSize?: number;
  margin?: number;
  maxCells?: number;
}

function resolveSide(material: Material | Material[]): SeaTriangleSide {
  const materials = Array.isArray(material) ? material : [material];
  let side: SeaTriangleSide | null = null;
  for (const item of materials) {
    const next: SeaTriangleSide =
      item.side === DoubleSide
        ? 'double'
        : item.side === BackSide
          ? 'back'
          : 'front';
    if (side !== null && side !== next) return 'double';
    side = next;
  }
  return side ?? 'front';
}

interface XzBounds {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

function emptyBounds(): XzBounds {
  return {
    minX: Infinity,
    minZ: Infinity,
    maxX: -Infinity,
    maxZ: -Infinity,
  };
}

const corner = new Vector3();

/**
 * 메시가 격자와 겹칠 수 있는지 — boundingBox 의 여덟 모서리를 월드로 올린
 * 느슨한 범위로 본다. 격자 밖 지형 타일을 정점을 읽기 전에 통째로 건너뛴다.
 */
function overlapsFrame(mesh: Mesh, frame: SeaReachFrame): boolean {
  const box = (mesh.geometry as BufferGeometry).boundingBox;
  if (!box) return false;
  const bounds = emptyBounds();
  for (let index = 0; index < 8; index += 1) {
    corner
      .set(
        index & 1 ? box.max.x : box.min.x,
        index & 2 ? box.max.y : box.min.y,
        index & 4 ? box.max.z : box.min.z,
      )
      .applyMatrix4(mesh.matrixWorld);
    if (corner.x < bounds.minX) bounds.minX = corner.x;
    if (corner.x > bounds.maxX) bounds.maxX = corner.x;
    if (corner.z < bounds.minZ) bounds.minZ = corner.z;
    if (corner.z > bounds.maxZ) bounds.maxZ = corner.z;
  }
  return (
    bounds.maxX >= frame.minX &&
    bounds.maxZ >= frame.minZ &&
    bounds.minX <= frame.minX + frame.width * frame.cellSize &&
    bounds.minZ <= frame.minZ + frame.height * frame.cellSize
  );
}

/**
 * 메시 정점의 월드 좌표. 정점은 삼각형 여럿이 나눠 쓰므로 한 번만 계산해
 * 둔다. getX 는 양자화(normalized)·interleaved 속성을 풀어 준다. `bounds` 를
 * 주면 유한한 정점으로 XZ 범위를 넓힌다.
 */
function* worldPositions(
  mesh: Mesh,
  bounds: XzBounds | null,
): Generator<void, Float32Array> {
  const position = (mesh.geometry as BufferGeometry).getAttribute('position');
  const e = mesh.matrixWorld.elements;
  const world = new Float32Array(position.count * 3);
  for (let v = 0; v < position.count; v += 1) {
    const x = position.getX(v);
    const y = position.getY(v);
    const z = position.getZ(v);
    const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
    const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
    world[v * 3] = wx;
    world[v * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
    world[v * 3 + 2] = wz;
    if (bounds && Number.isFinite(wx) && Number.isFinite(wz)) {
      if (wx < bounds.minX) bounds.minX = wx;
      if (wx > bounds.maxX) bounds.maxX = wx;
      if (wz < bounds.minZ) bounds.minZ = wz;
      if (wz > bounds.maxZ) bounds.maxZ = wz;
    }
    if ((v + 1) % VERTEX_CHUNK === 0) yield;
  }
  return world;
}

/**
 * 지도 루트들에서 마스크를 만든다. 찍을 메시가 없거나 범위가 서지 않으면
 * null — 호출자는 "막는 지형이 없다(전부 바다)" 로 다룬다.
 */
export function* buildSeaReachMask(
  sources: readonly SeaReachSource[],
  options: SeaReachBuildOptions = {},
): Generator<void, SeaReachMask | null> {
  const seaLevel = options.seaLevel ?? SEA_LEVEL_Y;

  const entries: { mesh: Mesh; bounds: boolean }[] = [];
  const scratch: Mesh[] = [];
  for (const source of sources) {
    source.root.updateWorldMatrix(true, true);
    for (const mesh of collectCollidableMeshes(source.root, scratch)) {
      entries.push({ mesh, bounds: source.bounds });
    }
    yield;
  }
  if (entries.length === 0) return null;

  // 범위는 정점으로 잰다 — boundingBox 를 회전시킨 범위는 비스듬히 놓인
  // 지도에서 실제의 두 배 넘게 부풀어 격자(메모리·시간)가 그만큼 커진다.
  // 이때 계산한 월드 좌표는 찍을 때 다시 쓴다.
  const hasBoundsEntry = entries.some((entry) => entry.bounds);
  const bounds = emptyBounds();
  const measured = new Map<Mesh, Float32Array>();
  for (const entry of entries) {
    if (hasBoundsEntry && !entry.bounds) continue;
    measured.set(entry.mesh, yield* worldPositions(entry.mesh, bounds));
  }
  const margin = options.margin ?? SEA_REACH_MARGIN;
  const frame = createSeaReachFrame({
    minX: bounds.minX - margin,
    minZ: bounds.minZ - margin,
    maxX: bounds.maxX + margin,
    maxZ: bounds.maxZ + margin,
    cellSize: options.cellSize ?? SEA_REACH_CELL_SIZE,
    maxCells: options.maxCells ?? SEA_REACH_MAX_CELLS,
  });
  if (!frame) return null;
  yield;

  const cover = new Uint8Array(frame.width * frame.height);
  const triangle: SeaTriangle = {
    ax: 0,
    ay: 0,
    az: 0,
    bx: 0,
    by: 0,
    bz: 0,
    cx: 0,
    cy: 0,
    cz: 0,
    side: 'front',
    mirrored: false,
  };

  let work = 0;
  for (const { mesh } of entries) {
    let world = measured.get(mesh);
    if (world) {
      measured.delete(mesh);
    } else {
      if (!overlapsFrame(mesh, frame)) continue;
      world = yield* worldPositions(mesh, null);
    }

    triangle.side = resolveSide(mesh.material);
    triangle.mirrored = mesh.matrixWorld.determinant() < 0;
    const index = (mesh.geometry as BufferGeometry).index;
    const count = index ? index.count : world.length / 3;
    for (let t = 0; t + 2 < count; t += 3) {
      const a = (index ? index.getX(t) : t) * 3;
      const b = (index ? index.getX(t + 1) : t + 1) * 3;
      const c = (index ? index.getX(t + 2) : t + 2) * 3;
      triangle.ax = world[a];
      triangle.ay = world[a + 1];
      triangle.az = world[a + 2];
      triangle.bx = world[b];
      triangle.by = world[b + 1];
      triangle.bz = world[b + 2];
      triangle.cx = world[c];
      triangle.cy = world[c + 1];
      triangle.cz = world[c + 2];
      work +=
        WORK_PER_TRIANGLE + markSeaTriangle(cover, frame, triangle, seaLevel);
      if (work >= WORK_CHUNK) {
        work = 0;
        yield;
      }
    }
  }

  const data = yield* resolveSeaReach(cover, frame.width, frame.height);
  return {
    data,
    width: frame.width,
    height: frame.height,
    transform: seaReachUvTransform(frame),
  };
}

/** 월드 XZ 의 마스크 값 — 격자 밖은 바다(255). 테스트·진단용. */
export function sampleSeaReachMask(
  mask: SeaReachMask,
  x: number,
  z: number,
): number {
  const m = mask.transform;
  const u = m[0] * x + m[1] * z + m[2];
  const v = m[3] * x + m[4] * z + m[5];
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return 255;
  const i = Math.floor(u * mask.width);
  const j = Math.floor(v * mask.height);
  return mask.data[j * mask.width + i];
}
