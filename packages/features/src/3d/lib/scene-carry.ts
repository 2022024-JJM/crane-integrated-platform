import { Box3, Vector3, type Object3D } from 'three';

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
