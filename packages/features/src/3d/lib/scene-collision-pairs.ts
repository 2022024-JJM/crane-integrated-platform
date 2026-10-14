import { Vector3, type Matrix4, type Object3D } from 'three';
import { makeMeshId, modelObjectRegistry } from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 씬 충돌 감지의 순수 헬퍼·상수. 런타임(scene-collision-runtime)과 뷰
 * 배선이 공유하는 숫자 계산은 전부 여기 둔다 — `ui/*.tsx` 안에서 수치
 * 계산을 하지 않는다는 규칙.
 */

/**
 * 스캔 주기. 매 프레임 돌리지 않는다 — 10Hz. 크레인은 느려(붐 끝도 초당 수십
 * cm) 100ms 안의 이동은 시각적으로 즉시이고, 스캔 비용(BVH 교차·분리 판정)은
 * 주기에 정비례하므로 20Hz 대비 절반이다. 감지 지연의 상한이 이 값이다.
 */
export const SCAN_INTERVAL_MS = 100;
/** 한 스캔의 시간 예산. job(모델 쌍) 사이에서만 검사하고 job 하나는 끝까지 돈다. */
export const SCAN_BUDGET_MS = 3;
/** BVH 가 아직 없는 메쉬 쌍을 다시 볼 때까지의 대기. ModelMesh 가 유휴 시간에 빌드한다. */
export const BVH_RETRY_MS = 1000;
/**
 * 기준선(baseline) 안정화 창 — 스캔 재개·새 모델 항목·기록 복원으로 기준선을
 * 다시 잡은 뒤, 큐가 비어도 이 시간이 지나야 scanning 으로 넘어간다. 그 동안
 * 발견된 겹침은 보고 대신 억제된다(시뮬레이션 이외의 움직임 흡수).
 * 두 가지를 덮는다.
 * - 기존 항목의 참조 교체(인스펙터 편집·undo): matrixWorld 는 useFrame 뒤
 *   gl.render 가 갱신하므로 커밋 직후 첫 tick 은 옛 행렬을 읽는다. 창이 없으면
 *   큐가 즉시 비어 scanning 이 되고 다음 tick 이 새 행렬을 움직임으로 보고한다.
 * - rigValueStore 스무딩(임계감쇠, DEFAULT_SMOOTH_TIME 0.35s): 재생 시작·새
 *   모델 마운트 직후 rest → 태그값으로 이동한다. 1s ≈ 0.35 × 3 이면 잔여 ≈ 2%.
 * BVH_RETRY_MS 와 값이 같지만 무관하다.
 */
export const BASELINE_SETTLE_MS = 1000;
/**
 * 억제(기준선·닫기) 해제에 필요한 분리 간격 — 씬 unit. 씬마다 metersPerUnit
 * 이 달라(dock-in 11.7 m/unit) m 로 두지 않는다. 경계 떨림 방지용
 * 히스테리시스는 이 하나로 충분하다.
 */
export const SEPARATION_MARGIN = 0.05;
/**
 * 억제된 쌍(기준선 겹침·보고 뒤 닫힘)의 분리 재판정 간격. 분리 판정은 삼각형
 * 최단 거리(BVH 쌍 탐색)라 새 충돌 검사보다 훨씬 비싸고, 붙어 있는 동안 매
 * 스캔(20Hz) 다시 볼 이유가 없다 — 떨어진 것을 이 간격 안에 알아채면 된다.
 * 실내처럼 크레인 20대가 동시에 움직이는 씬에서 이게 유휴 CPU 의 1/3 이었다.
 * 붙은 채 계속 움직이는 쌍(멈춘 쌍은 dirty 가 아니라 비용 0)은 이 간격마다
 * BVH 를 다시 타므로 간격이 곧 비용이다 — "떨어졌다" 는 좋은 소식이라 반 초
 * 늦게 알아도 된다.
 */
export const SUPPRESSED_RECHECK_MS = 500;
/**
 * 떨어진 쌍의 여유 거리(clearance)를 재는 상한 — 씬 unit. 이보다 멀면 "최소
 * 이만큼" 으로만 기억한다(멀리 있는 쌍은 가지치기만으로 끝나 싸다). 두 메쉬의
 * 누적 이동 한계가 여유 거리를 넘기 전까지는 교차 검사를 건너뛴다. 여유
 * 거리는 메쉬 AABB 간격만으로 잰다(런타임 measureClearance 주석).
 */
export const CLEARANCE_PROBE = 2;
/**
 * 이보다 작은 여유 거리는 0 으로 둔다 — 한두 스캔이면 소진될 값이다.
 */
export const CLEARANCE_MIN = 0.25;
/** 이보다 작은 월드 크기의 메쉬(볼트·라벨 앵커 등)는 검사에서 뺀다 — 씬 unit. */
export const MIN_MESH_EXTENT = 0.01;
/** 충돌 기록 보관 개수 — 초과하면 가장 오래된 것부터 버린다. */
export const HISTORY_MAX = 10;
/** 무정지 모드에서 빨간 박스를 보여 주는 시간. */
export const FLASH_MS = 3000;

/** 충돌 기록이 가리키는 노드 — Object3D 참조 대신 id·경로로 남긴다. */
export interface CollisionRecordNodeRef {
  modelId: string;
  /** 모델 루트 기준 mesh-path. 루트 자체면 ''. */
  nodePath: string;
}

/**
 * 기록의 노드 참조를 지금 마운트된 Object3D 로 해석한다. ModelMesh 가 자식
 * 노드도 `makeMeshId` 로 registry 에 등록하므로 O(1) 조회다. 리마운트·언마운트
 * 로 없어진 노드는 빠진다(기록은 남고 박스만 안 그려진다).
 */
export function resolveRecordNodes(
  refs: ReadonlyArray<CollisionRecordNodeRef>,
): Object3D[] {
  const out: Object3D[] = [];
  for (const ref of refs) {
    const node = modelObjectRegistry.get(
      ref.nodePath ? makeMeshId(ref.modelId, ref.nodePath) : ref.modelId,
    );
    if (node) out.push(node);
  }
  return out;
}

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

/**
 * matrixWorld 가 prev 에서 지금으로 바뀌는 강체 이동으로 메쉬의 어느 점이든
 * 움직일 수 있는 거리의 **상한** — |Δ평행이동| + ‖ΔR‖_F · reach. ΔR 은 3×3
 * 상단(스케일 포함)의 차이라 회전·스케일 변화를 함께 덮는다. prev 가 NaN
 * (첫 관측)이면 Infinity — 반드시 검사하게.
 */
export function displacementBound(
  prev: Float64Array,
  matrix: Matrix4,
  reach: number,
): number {
  const e = matrix.elements;
  if (Number.isNaN(prev[0])) return Number.POSITIVE_INFINITY;
  const tx = e[12] - prev[12];
  const ty = e[13] - prev[13];
  const tz = e[14] - prev[14];
  let rot = 0;
  for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) {
    const d = e[i] - prev[i];
    rot += d * d;
  }
  return Math.sqrt(tx * tx + ty * ty + tz * tz) + Math.sqrt(rot) * reach;
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
