import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix3,
  Matrix4,
  Vector3,
  type Mesh,
  type Object3D,
} from 'three';

/**
 * 운반(훅 ↔ 블록) 런타임의 순수 계산 — `ui/*.tsx` 안에서 수치 계산을 하지
 * 않는다는 규칙대로 여기 둔다. three 객체를 받지만 씬 그래프를 바꾸지는
 * 않는다(읽기만).
 */

/** 부착 태그 값 판정 — 불리언 태그는 0/1 숫자로 버스에 실린다. */
export function isAttachOn(value: number | undefined): boolean {
  return value !== undefined && value >= 0.5;
}

export interface HookNodeExtent {
  /** 노드 원점 월드 위치. */
  origin: Vector3;
  /** 노드 서브트리 월드 AABB 의 위·아래 y. 지오메트리가 없으면 origin.y. */
  top: number;
  bottom: number;
}

const _box = new Box3();

/**
 * 훅 노드의 월드 범위 — 앵커(아래)와 케이블 끝(위)을 노드 지오메트리에서
 * 잰다. 데이터에 훅 블록 높이를 적지 않아도 되게 하려는 것이다(새 GLB 버전
 * 에서 숫자가 틀어지지 않는다). 지오메트리가 없는 Empty 는 원점이 곧 위·아래.
 */
export function measureHookNode(node: Object3D, out: HookNodeExtent): void {
  // matrixWorld 는 렌더 때 갱신된다 — useFrame 에서 읽으면 한 프레임 전 자세라
  // 배속·저 fps 에서 블록이 훅보다 뒤처져 내려놓을 때마다 높이가 쌓인다.
  // 조상·자손까지 이 프레임의 값으로 올려 잰다.
  node.updateWorldMatrix(true, true);
  node.getWorldPosition(out.origin);
  _box.setFromObject(node);
  if (_box.isEmpty()) {
    out.top = out.origin.y;
    out.bottom = out.origin.y;
    return;
  }
  out.top = _box.max.y;
  out.bottom = _box.min.y;
}

/**
 * 훅 앵커 — 노드들의 월드 XZ 평균, y 는 가장 낮은 바닥 + 오프셋. 노드가 두
 * 가닥(로프 둘)이면 그 가운데에 매달린다.
 */
export function computeHookAnchor(
  extents: readonly HookNodeExtent[],
  anchorOffsetY: number,
  out: Vector3,
): Vector3 {
  out.set(0, 0, 0);
  if (extents.length === 0) return out;
  let bottom = Number.POSITIVE_INFINITY;
  for (const e of extents) {
    out.x += e.origin.x;
    out.z += e.origin.z;
    if (e.bottom < bottom) bottom = e.bottom;
  }
  out.x /= extents.length;
  out.z /= extents.length;
  out.y = bottom + anchorOffsetY;
  return out;
}

export interface CarryCandidate {
  id: string;
  position: Vector3;
}

/**
 * 앵커의 XZ 반경 안에서 가장 가까운 후보 — 없으면 null. 높이는 보지 않는다:
 * 훅이 블록 위에 내려와 있는지는 작업 순서(시나리오·현장)가 보장하고, 여기서
 * y 까지 재면 블록 윗면 높이를 데이터에 적어야 한다.
 */
export function pickNearestCandidate(
  anchor: Vector3,
  candidates: readonly CarryCandidate[],
  radius: number,
): CarryCandidate | null {
  if (!(radius > 0)) return null;
  const limit = radius * radius;
  let best: CarryCandidate | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const dx = c.position.x - anchor.x;
    const dz = c.position.z - anchor.z;
    const d = dx * dx + dz * dz;
    if (d > limit || d >= bestDist) continue;
    best = c;
    bestDist = d;
  }
  return best;
}

export interface CableSegment {
  from: Vector3;
  to: Vector3;
  /** 케이블이 매달린 훅 노드 — 레이어가 이 노드의 로프 가닥을 늘린다. */
  node: Object3D | null;
}

/**
 * 케이블 한 가닥 — 노드의 부모(트롤리) 높이에서 노드 서브트리 꼭대기까지
 * 수직선. XZ 는 노드 원점. 부모가 없으면 노드 원점에서 시작(길이 0).
 */
export function computeCableSegment(
  node: Object3D,
  extent: HookNodeExtent,
  out: CableSegment,
): CableSegment {
  out.node = node;
  out.to.set(extent.origin.x, extent.top, extent.origin.z);
  if (node.parent) {
    node.parent.getWorldPosition(out.from);
    out.from.x = extent.origin.x;
    out.from.z = extent.origin.z;
  } else {
    out.from.copy(out.to);
  }
  return out;
}

/** 케이블 길이(y 차). 꼭대기가 부모보다 높으면 0 — 그리지 않는다. */
export function cableLength(segment: CableSegment): number {
  return Math.max(0, segment.from.y - segment.to.y);
}

/**
 * 가닥 연장 — 훅 노드의 로프 가닥 윗끝 단면을 위로 뽑은 관. 권상은 훅 노드를
 * 통째로 내리므로 GLB 로프가 트롤리에서 떨어지는데, 그 틈을 모델 로프와 같은
 * 자리·같은 굵기·같은 재질로 잇는다. 단면을 추정하지 않고 꼭대기 정점에 닿은
 * 옆면 삼각형의 윗변을 그대로 위로 뽑는다 — 가닥 수·굵기·배치가 모델에서 온다.
 *
 * 가정: 훅 노드 서브트리의 가장 높은 정점이 로프 가닥의 윗끝이다(로프가
 * 트롤리 쪽으로 곧게 뻗어 있다). 꼭대기가 판뿐이면(옆면이 없으면) 만들지 않는다.
 */
export interface StrandExtension {
  /** 노드 로컬 x·z, y 는 0(가닥 윗끝)~1. 행렬이 y 를 늘린다. */
  geometry: BufferGeometry;
  /** 윗끝 정점을 가진 메쉬 — 재질·그림자 설정을 그대로 쓴다. */
  source: Mesh;
  /** 가닥 윗끝의 노드 로컬 y. */
  baseY: number;
}

/**
 * 윗끝 판정 허용치 — 서브트리 높이에 대한 비율(양자화·행렬 오차를 흡수)과
 * 높이가 0 인 판에서도 부동소수 잡음을 덮는 하한(노드 로컬 unit).
 */
const STRAND_TOP_TOLERANCE = 1e-3;
const STRAND_TOP_TOLERANCE_MIN = 1e-6;

const _inverse = new Matrix4();
const _relative = new Matrix4();
const _normalMatrix = new Matrix3();
const _point = new Vector3();
const _normal = new Vector3();

interface LocalMesh {
  mesh: Mesh;
  /** 정점 위치(노드 로컬, xyz 연속). */
  positions: Float32Array;
  /** 정점 법선(노드 로컬, 수평으로 눕힘). 법선이 없으면 null. */
  normals: Float32Array | null;
  top: number;
}

function toNodeLocal(mesh: Mesh): LocalMesh | null {
  const position = mesh.geometry.getAttribute('position');
  if (!position || position.count === 0) return null;
  _relative.multiplyMatrices(_inverse, mesh.matrixWorld);
  const positions = new Float32Array(position.count * 3);
  let top = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < position.count; i += 1) {
    _point.fromBufferAttribute(position, i).applyMatrix4(_relative);
    positions[i * 3] = _point.x;
    positions[i * 3 + 1] = _point.y;
    positions[i * 3 + 2] = _point.z;
    if (_point.y > top) top = _point.y;
  }
  const normal = mesh.geometry.getAttribute('normal');
  let normals: Float32Array | null = null;
  if (normal && normal.count === position.count) {
    _normalMatrix.getNormalMatrix(_relative);
    normals = new Float32Array(normal.count * 3);
    for (let i = 0; i < normal.count; i += 1) {
      _normal.fromBufferAttribute(normal, i).applyMatrix3(_normalMatrix);
      _normal.y = 0;
      if (_normal.lengthSq() > 0) _normal.normalize();
      normals[i * 3] = _normal.x;
      normals[i * 3 + 2] = _normal.z;
    }
  }
  return { mesh, positions, normals, top };
}

/**
 * 훅 노드에서 가닥 연장 관을 만든다 — 노드 서브트리에서 가장 높은 정점을 가진
 * 메쉬의, 윗끝 정점 둘을 잇는 옆면 삼각형(정점 셋 중 둘만 윗끝)의 윗변을
 * 사각형으로 뽑는다. 윗변 방향을 삼각형과 반대로 돌아 바깥 면을 유지한다.
 * 만들 것이 없으면 null. 지오메트리의 dispose 는 부른 쪽 몫이다.
 */
export function buildStrandExtension(node: Object3D): StrandExtension | null {
  node.updateWorldMatrix(true, true);
  _inverse.copy(node.matrixWorld).invert();
  const meshes: Mesh[] = [];
  node.traverse((obj) => {
    if ((obj as Mesh).isMesh) meshes.push(obj as Mesh);
  });

  let best: LocalMesh | null = null;
  let bottom = Number.POSITIVE_INFINITY;
  for (const mesh of meshes) {
    const local = toNodeLocal(mesh);
    if (!local) continue;
    for (let i = 1; i < local.positions.length; i += 3) {
      if (local.positions[i] < bottom) bottom = local.positions[i];
    }
    if (!best || local.top > best.top) best = local;
  }
  if (!best) return null;

  const { mesh, positions, normals, top } = best;
  const minTop =
    top -
    Math.max((top - bottom) * STRAND_TOP_TOLERANCE, STRAND_TOP_TOLERANCE_MIN);
  const isTop = (i: number) => positions[i * 3 + 1] >= minTop;
  const index = mesh.geometry.getIndex();
  const vertexOf = (n: number) => (index ? index.getX(n) : n);
  const triangleCount = Math.floor(
    (index ? index.count : positions.length / 3) / 3,
  );
  const uv = mesh.geometry.getAttribute('uv');
  const hasUv = !!uv && uv.count === positions.length / 3;

  const outPositions: number[] = [];
  const outNormals: number[] = [];
  const outUvs: number[] = [];
  const pushVertex = (v: number, y: number, nx: number, nz: number) => {
    outPositions.push(positions[v * 3], y, positions[v * 3 + 2]);
    if (normals && (normals[v * 3] !== 0 || normals[v * 3 + 2] !== 0)) {
      outNormals.push(normals[v * 3], 0, normals[v * 3 + 2]);
    } else {
      outNormals.push(nx, 0, nz);
    }
    if (hasUv) outUvs.push(uv.getX(v), uv.getY(v));
  };

  for (let t = 0; t < triangleCount; t += 1) {
    const tri = [vertexOf(t * 3), vertexOf(t * 3 + 1), vertexOf(t * 3 + 2)];
    const low = tri.filter((v) => !isTop(v));
    if (low.length !== 1) continue;
    // 삼각형 순환 순서 (low, a, b) 의 윗변 a→b — 연장 면은 b→a 로 돈다.
    const k = tri.indexOf(low[0]);
    const a = tri[(k + 1) % 3];
    const b = tri[(k + 2) % 3];
    // 법선이 없을 때의 면 법선: (a − b) × 위 방향을 수평으로.
    const dx = positions[a * 3] - positions[b * 3];
    const dz = positions[a * 3 + 2] - positions[b * 3 + 2];
    const length = Math.hypot(dx, dz);
    if (length === 0) continue;
    const nx = -dz / length;
    const nz = dx / length;
    pushVertex(b, 0, nx, nz);
    pushVertex(a, 0, nx, nz);
    pushVertex(a, 1, nx, nz);
    pushVertex(b, 0, nx, nz);
    pushVertex(a, 1, nx, nz);
    pushVertex(b, 1, nx, nz);
  }
  if (outPositions.length === 0) return null;

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(outPositions, 3),
  );
  geometry.setAttribute('normal', new Float32BufferAttribute(outNormals, 3));
  if (hasUv) geometry.setAttribute('uv', new Float32BufferAttribute(outUvs, 2));
  return { geometry, source: mesh, baseY: top };
}

/**
 * 가닥 연장 관의 월드 행렬 — 노드 로컬 윗끝(`baseY`)에서 노드 로컬 위쪽으로,
 * 월드 높이 `topY`(트롤리)에 닿을 때까지 늘인다. 노드의 위치·회전·배율을 그대로
 * 따른다(관이 노드 로컬 좌표라서). 늘일 길이가 없거나 노드 위쪽이 월드 위를
 * 향하지 않으면 false — 그리지 않는다.
 */
export function computeStrandExtensionMatrix(
  node: Object3D,
  baseY: number,
  topY: number,
  out: Matrix4,
): boolean {
  const e = node.matrixWorld.elements;
  // 노드 로컬 y 한 단위가 월드 y 로 가는 양, 윗끝의 월드 y.
  const upY = e[5];
  if (!(upY > 0)) return false;
  const length = topY - (upY * baseY + e[13]);
  if (!(length > 0)) return false;
  out.makeScale(1, length / upY, 1).setPosition(0, baseY, 0);
  out.premultiply(node.matrixWorld);
  return true;
}

/** 자신과 조상이 전부 보이는가 — 숨긴 모델의 로프 연장을 그리지 않는다. */
export function isWorldVisible(object: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (!o.visible) return false;
  }
  return true;
}
