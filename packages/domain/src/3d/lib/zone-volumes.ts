import type { Box3, BufferGeometry, Matrix4, Mesh, Vector3 } from 'three';
import {
  CONTAINED,
  INTERSECTED,
  NOT_INTERSECTED,
  type MeshBVH,
} from 'three-mesh-bvh';

/**
 * 모델 영역(원형, 침범 감지)의 기하 프리미티브. 영역은 Y 를 무시한 **무한
 * 수직 원기둥**이라 모든 판정이 XZ 평면의 원 ↔ 도형 2D 문제로 내려온다.
 * 스케줄링(어느 영역·모델을 언제 볼지)은 features 의 scene-zone-runtime 이
 * 맡고, 여기는 답만 낸다. collision-volumes 와 같은 규칙 — three-mesh-bvh
 * 접점은 이 파일뿐, BVH 는 빌드하지 않고 없으면 `null`, 프레임당 할당 0.
 *
 * 메쉬 판정은 **원기둥을 메쉬 로컬로 보내지 않는다** — 메쉬가 X·Z 축으로
 * 기울어 있으면 로컬 공간에서 원기둥이 수직이 아니게 되어 2D 로 풀 수 없다.
 * 대신 BVH 노드 박스·삼각형을 `matrixWorld` 의 X·Z 두 행으로 월드 XZ 에
 * 투영해 원과 비교한다(회전·비균일 스케일 모두 정확).
 */

type BvhGeometry = BufferGeometry & { boundsTree?: MeshBVH };

/** 반경으로 쓸 수 있는 값 — 유한 양수. sanitize 가 같은 규칙으로 거른다. */
export function isValidZoneRadius(r: unknown): r is number {
  return typeof r === 'number' && Number.isFinite(r) && r > 0;
}

/** 점 (x,z) 가 원 안(경계 포함)인지. */
export function pointInCircleXZ(
  x: number,
  z: number,
  cx: number,
  cz: number,
  r: number,
): boolean {
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz <= r * r;
}

/**
 * 월드 AABB 의 XZ 사각형과 원의 교차(경계 포함). 원 중심을 사각형에 clamp 한
 * 점이 사각형에서 중심에 가장 가까운 점이다. Y 는 보지 않는다.
 */
export function circleIntersectsBoxXZ(
  box: Box3,
  cx: number,
  cz: number,
  r: number,
): boolean {
  if (!Number.isFinite(cx) || !Number.isFinite(cz) || !isValidZoneRadius(r)) {
    return false;
  }
  const qx = cx < box.min.x ? box.min.x : cx > box.max.x ? box.max.x : cx;
  const qz = cz < box.min.z ? box.min.z : cz > box.max.z ? box.max.z : cz;
  const dx = qx - cx;
  const dz = qz - cz;
  return dx * dx + dz * dz <= r * r;
}

/** 선분 ab 와 점 p 의 XZ 거리 제곱. */
export function segmentDistanceSqXZ(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  px: number,
  pz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = 0;
  if (len2 > 0) {
    t = ((px - ax) * dx + (pz - az) * dz) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
  }
  const qx = ax + t * dx - px;
  const qz = az + t * dz - pz;
  return qx * qx + qz * qz;
}

/**
 * XZ 평면의 삼각형과 원의 교차(경계 포함). ① 정점이 원 안 ② 원 중심이
 * 삼각형 안 ③ 어느 변이 원과 닿음 — 셋 중 하나면 교차다. 퇴화 삼각형
 * (면적 0)은 ② 를 건너뛰고 변 거리로만 판정해 예외 없이 답한다.
 */
export function triangleIntersectsCircleXZ(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx2: number,
  cz2: number,
  cx: number,
  cz: number,
  r: number,
): boolean {
  const r2 = r * r;
  if (
    pointInCircleXZ(ax, az, cx, cz, r) ||
    pointInCircleXZ(bx, bz, cx, cz, r) ||
    pointInCircleXZ(cx2, cz2, cx, cz, r)
  ) {
    return true;
  }
  const abx = bx - ax;
  const abz = bz - az;
  const bcx = cx2 - bx;
  const bcz = cz2 - bz;
  const cax = ax - cx2;
  const caz = az - cz2;
  const area2 = abx * bcz - abz * bcx;
  if (Math.abs(area2) >= 1e-12) {
    const s1 = abx * (cz - az) - abz * (cx - ax);
    const s2 = bcx * (cz - bz) - bcz * (cx - bx);
    const s3 = cax * (cz - cz2) - caz * (cx - cx2);
    if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) {
      return true;
    }
  }
  return (
    segmentDistanceSqXZ(ax, az, bx, bz, cx, cz) <= r2 ||
    segmentDistanceSqXZ(bx, bz, cx2, cz2, cx, cz) <= r2 ||
    segmentDistanceSqXZ(cx2, cz2, ax, az, cx, cz) <= r2
  );
}

/**
 * 영역 중심의 월드 좌표 — 루트 `matrixWorld` 의 평행이동(원점) + 월드 축
 * 오프셋. Y 는 루트 높이 그대로(바닥 원을 놓는 높이). 오프셋을 루트 yaw
 * 기준으로 돌리려면 이 함수 한 곳만 바꾼다.
 */
export function zoneCenterWorld(
  matrixWorld: Matrix4,
  offset: readonly [number, number] | undefined,
  target: Vector3,
): Vector3 {
  const e = matrixWorld.elements;
  return target.set(
    e[12] + (offset ? offset[0] : 0),
    e[13],
    e[14] + (offset ? offset[1] : 0),
  );
}

// ---- 메쉬 ↔ 수직 원기둥 (shapecast) ----
// 콜백은 클로저 할당을 피하려고 모듈 상태를 읽는다. 재진입 없음(동기).
let _m0 = 1;
let _m4 = 0;
let _m8 = 0;
let _m12 = 0;
let _m2 = 0;
let _m6 = 0;
let _m10 = 1;
let _m14 = 0;
let _cx = 0;
let _cz = 0;
let _r = 0;
let _r2 = 0;

function loadXZRows(matrixWorld: Matrix4): void {
  const e = matrixWorld.elements;
  _m0 = e[0];
  _m4 = e[4];
  _m8 = e[8];
  _m12 = e[12];
  _m2 = e[2];
  _m6 = e[6];
  _m10 = e[10];
  _m14 = e[14];
}

function projX(x: number, y: number, z: number): number {
  return _m0 * x + _m4 * y + _m8 * z + _m12;
}

function projZ(x: number, y: number, z: number): number {
  return _m2 * x + _m6 * y + _m10 * z + _m14;
}

function intersectsBounds(box: Box3): number {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  let inside = 0;
  for (let i = 0; i < 8; i += 1) {
    const x = i & 1 ? box.max.x : box.min.x;
    const y = i & 2 ? box.max.y : box.min.y;
    const z = i & 4 ? box.max.z : box.min.z;
    const px = projX(x, y, z);
    const pz = projZ(x, y, z);
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (pz < minZ) minZ = pz;
    if (pz > maxZ) maxZ = pz;
    const dx = px - _cx;
    const dz = pz - _cz;
    if (dx * dx + dz * dz <= _r2) inside += 1;
  }
  // 원은 볼록 — 투영된 8 꼭짓점이 전부 안이면 노드 전체가 안이다.
  if (inside === 8) return CONTAINED;
  // 투영 꼭짓점의 AABB 로 보수적 거름(실제 투영 헐보다 크므로 놓치지 않는다).
  const qx = _cx < minX ? minX : _cx > maxX ? maxX : _cx;
  const qz = _cz < minZ ? minZ : _cz > maxZ ? maxZ : _cz;
  const dx = qx - _cx;
  const dz = qz - _cz;
  return dx * dx + dz * dz <= _r2 ? INTERSECTED : NOT_INTERSECTED;
}

function intersectsTriangle(
  tri: { a: Vector3; b: Vector3; c: Vector3 },
  _index: number,
  contained: boolean,
): boolean {
  if (contained) return true;
  return triangleIntersectsCircleXZ(
    projX(tri.a.x, tri.a.y, tri.a.z),
    projZ(tri.a.x, tri.a.y, tri.a.z),
    projX(tri.b.x, tri.b.y, tri.b.z),
    projZ(tri.b.x, tri.b.y, tri.b.z),
    projX(tri.c.x, tri.c.y, tri.c.z),
    projZ(tri.c.x, tri.c.y, tri.c.z),
    _cx,
    _cz,
    _r,
  );
}

const SHAPECAST_CALLBACKS = { intersectsBounds, intersectsTriangle };

/**
 * 메쉬의 삼각형이 하나라도 월드 수직 원기둥(중심 cx,cz · 반경 r · 높이 무한)에
 * 닿는지. BVH 가 없으면 `null`(판정 불가) — 빌드·재시도는 호출자가 정한다.
 * AABB/OBB 로 대신 답하지 않는다: 회전한 긴 붐의 박스는 원을 크게 덮어
 * 오탐이 되고, 침범 기록은 영구 행이라 지연보다 오탐이 나쁘다.
 * 반경·중심이 무효면 트리를 건드리지 않고 `false`.
 */
export function meshIntersectsVerticalCylinder(
  mesh: Mesh,
  cx: number,
  cz: number,
  r: number,
): boolean | null {
  const tree = (mesh.geometry as BvhGeometry).boundsTree;
  if (!tree) return null;
  if (!isValidZoneRadius(r) || !Number.isFinite(cx) || !Number.isFinite(cz)) {
    return false;
  }
  loadXZRows(mesh.matrixWorld);
  _cx = cx;
  _cz = cz;
  _r = r;
  _r2 = r * r;
  return tree.shapecast(SHAPECAST_CALLBACKS);
}
