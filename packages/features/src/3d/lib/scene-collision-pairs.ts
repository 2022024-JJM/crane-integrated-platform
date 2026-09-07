import { Box3, Vector3, type Matrix4, type Object3D } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 씬 충돌 감지의 순수 헬퍼·상수. 런타임(scene-collision-runtime)과 뷰
 * 배선이 공유하는 숫자 계산은 전부 여기 둔다 — `ui/*.tsx` 안에서 수치
 * 계산을 하지 않는다는 규칙.
 */

/** 스캔 주기. 매 프레임 돌리지 않는다 — 20Hz 면 시각적으로 즉시다. */
export const SCAN_INTERVAL_MS = 50;
/** 한 스캔의 시간 예산. job(모델 쌍) 사이에서만 검사하고 job 하나는 끝까지 돈다. */
export const SCAN_BUDGET_MS = 3;
/** BVH 가 아직 없는 메쉬 쌍을 다시 볼 때까지의 대기. ModelMesh 가 유휴 시간에 빌드한다. */
export const BVH_RETRY_MS = 1000;
/**
 * 억제(기준선·닫기) 해제에 필요한 분리 간격 — 씬 unit. 씬마다 metersPerUnit
 * 이 달라(okpo 지도 11.7 m/unit) m 로 두지 않는다. 경계 떨림 방지용
 * 히스테리시스는 이 하나로 충분하다.
 */
export const SEPARATION_MARGIN = 0.05;
/** 이보다 작은 월드 크기의 메쉬(볼트·라벨 앵커 등)는 검사에서 뺀다 — 씬 unit. */
export const MIN_MESH_EXTENT = 0.01;

/** 순서 무관 쌍 키. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** matrixWorld 16 원소가 마지막 복사본과 하나라도 다른지 — 할당 없음. */
export function matrixChanged(prev: Float64Array, matrix: Matrix4): boolean {
  const e = matrix.elements;
  for (let i = 0; i < 16; i += 1) {
    if (prev[i] !== e[i]) return true;
  }
  return false;
}

export function copyMatrix(matrix: Matrix4, out: Float64Array): Float64Array {
  const e = matrix.elements;
  for (let i = 0; i < 16; i += 1) out[i] = e[i];
  return out;
}

export interface CollisionCameraPose {
  position: Vector3Tuple;
  target: Vector3Tuple;
}

/** 현재 카메라가 없을 때 쓰는 방향 — 모니터링 포커스 프레이밍과 같은 각도. */
const DEFAULT_VIEW_DIRECTION = new Vector3(0, 0.75, 0.65).normalize();
const MIN_VIEW_DISTANCE = 6;
const VIEW_DISTANCE_RATIO = 2.5;

const _dir = new Vector3();
const _pos = new Vector3();
const _box = new Box3();
const _union = new Box3();
const _size = new Vector3();

/** 노드들의 월드 AABB 합집합의 바운딩 구 반지름. 비어 있으면 0. */
export function collisionViewRadius(nodes: readonly Object3D[]): number {
  _union.makeEmpty();
  for (const node of nodes) {
    _box.setFromObject(node);
    if (!_box.isEmpty()) _union.union(_box);
  }
  if (_union.isEmpty()) return 0;
  return _union.getSize(_size).length() / 2;
}

/**
 * "충돌 지점 보기" 카메라 포즈 — 접촉점을 타깃으로, 현재 카메라의 시선
 * 방향을 유지한 채 두 노드가 들어오는 거리로 물러난다. 현재 포즈가 없거나
 * 퇴화(위치=타깃)면 기본 방향.
 */
export function computeCollisionViewPose(
  contact: Vector3Tuple,
  radius: number,
  current: CollisionCameraPose | null,
): CollisionCameraPose {
  _dir.copy(DEFAULT_VIEW_DIRECTION);
  if (current) {
    _dir.set(
      current.position[0] - current.target[0],
      current.position[1] - current.target[1],
      current.position[2] - current.target[2],
    );
    if (_dir.lengthSq() < 1e-6 || !Number.isFinite(_dir.lengthSq())) {
      _dir.copy(DEFAULT_VIEW_DIRECTION);
    } else {
      _dir.normalize();
    }
  }
  const r = Number.isFinite(radius) && radius > 0 ? radius : 0;
  const distance = Math.max(r * VIEW_DISTANCE_RATIO, MIN_VIEW_DISTANCE);
  _pos.set(contact[0], contact[1], contact[2]).addScaledVector(_dir, distance);
  return {
    position: [_pos.x, _pos.y, _pos.z],
    target: [contact[0], contact[1], contact[2]],
  };
}
