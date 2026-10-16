import type { Box3 } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 평면도(직교 탑뷰) 겹침 — 위에서 보면 겹치지만 높이가 달라 실제로 닿지 않는
 * 장비 쌍을 찾아 수직 여유(Δh)를 낸다. 실제 충돌 판정(collision-volumes.ts
 * · scene-collision-runtime)과는 별개의 **표시용** 계산이다: 관제사가 "겹쳐
 * 보이는데 누가 위고 얼마나 떨어져 있나" 를 읽게 하는 것이 목적이라 메쉬
 * 월드 AABB 만으로 판정한다(회전한 긴 붐의 AABB 는 실제보다 넓어 겹침을
 * 과하게 잡을 수 있다 — 표시가 하나 더 뜨는 쪽이 안 뜨는 쪽보다 낫다).
 *
 * 입력은 모델별 메쉬 월드 박스 목록이고 프레임마다 호출자가 채운다. 결과의
 * `gap` 은 겹치는 메쉬 쌍 중 가장 작은 수직 여유(씬 단위)다 — 0 이하면 AABB
 * 로는 높이도 겹친다는 뜻이고, 진짜 닿았는지는 충돌 감지가 판정한다.
 */

export interface PlanOverlapMember {
  id: string;
  /** 모델 전체 월드 박스 — 1차 거름용. */
  bounds: Box3;
  /** 충돌 대상 메쉬의 월드 박스(collectCollidableMeshes 순서). */
  boxes: readonly Box3[];
}

export interface PlanOverlap {
  /** 쌍 키(id 정렬) — 칩 key·변화 비교. */
  key: string;
  /** 위에 있는 쪽(가장 작은 여유를 만든 메쉬 쌍 기준). */
  upperId: string;
  /** 아래(가려지는) 쪽. */
  lowerId: string;
  /** 가장 작은 수직 여유(씬 단위). 0 이하 = 높이도 겹침. */
  gap: number;
  /** 칩 위치 — 겹침 사각형 중심, 높이는 위쪽 메쉬 윗면. */
  center: Vector3Tuple;
}

function overlapsXZ(a: Box3, b: Box3): boolean {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.z <= b.max.z &&
    a.max.z >= b.min.z
  );
}

/**
 * 두 박스의 수직 여유 — 양수면 떨어져 있고(b 가 위면 b.min−a.max), 둘 다
 * 음수면(높이 겹침) 덜 겹친 쪽. 어느 쪽이 위인지도 같이 돌려준다.
 */
function verticalGap(a: Box3, b: Box3): { gap: number; bAbove: boolean } {
  const bAbove = b.min.y - a.max.y;
  const aAbove = a.min.y - b.max.y;
  return bAbove >= aAbove
    ? { gap: bAbove, bAbove: true }
    : { gap: aAbove, bAbove: false };
}

export function planOverlapKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * 모든 쌍을 돌며 평면 겹침을 찾는다. 결과는 `out` 을 비우고 채운다(호출자
 * 재사용). 같은 쌍은 하나만 나오고 순서는 입력 순서를 따른다. 빈 박스
 * 목록·자기 자신은 건너뛴다.
 */
export function resolvePlanOverlaps(
  members: readonly PlanOverlapMember[],
  out: PlanOverlap[] = [],
): PlanOverlap[] {
  out.length = 0;
  for (let i = 0; i < members.length; i += 1) {
    const a = members[i];
    if (a.boxes.length === 0) continue;
    for (let j = i + 1; j < members.length; j += 1) {
      const b = members[j];
      if (b.boxes.length === 0 || a.id === b.id) continue;
      if (!overlapsXZ(a.bounds, b.bounds)) continue;
      let best: PlanOverlap | null = null;
      for (const boxA of a.boxes) {
        for (const boxB of b.boxes) {
          if (!overlapsXZ(boxA, boxB)) continue;
          const { gap, bAbove } = verticalGap(boxA, boxB);
          if (best && gap >= best.gap) continue;
          const upper = bAbove ? boxB : boxA;
          best = {
            key: planOverlapKey(a.id, b.id),
            upperId: bAbove ? b.id : a.id,
            lowerId: bAbove ? a.id : b.id,
            gap,
            center: [
              (Math.max(boxA.min.x, boxB.min.x) +
                Math.min(boxA.max.x, boxB.max.x)) /
                2,
              upper.max.y,
              (Math.max(boxA.min.z, boxB.min.z) +
                Math.min(boxA.max.z, boxB.max.z)) /
                2,
            ],
          };
        }
      }
      if (best) out.push(best);
    }
  }
  return out;
}

/**
 * 겹침 목록이 표시상 같은지 — 칩을 다시 그릴 필요가 있는지 가른다. 여유는
 * `gapStep`, 위치는 `centerStep` 으로 양자화해 비교한다(미세 떨림으로
 * 매 tick 리렌더하지 않는다).
 */
export function isPlanOverlapListEqual(
  a: readonly PlanOverlap[],
  b: readonly PlanOverlap[],
  gapStep: number,
  centerStep: number,
): boolean {
  if (a.length !== b.length) return false;
  const q = (v: number, step: number) => Math.round(v / step);
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x.key !== y.key || x.upperId !== y.upperId) return false;
    if (q(x.gap, gapStep) !== q(y.gap, gapStep)) return false;
    for (let k = 0; k < 3; k += 1) {
      if (q(x.center[k], centerStep) !== q(y.center[k], centerStep)) {
        return false;
      }
    }
  }
  return true;
}

/** 가려지는(아래) 모델 id 집합 — 숨은선 표시 대상. 입력 순서 유지, 중복 제거. */
export function collectPlanHiddenIds(
  overlaps: readonly PlanOverlap[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const overlap of overlaps) {
    if (seen.has(overlap.lowerId)) continue;
    seen.add(overlap.lowerId);
    out.push(overlap.lowerId);
  }
  return out;
}

/** 칩 문구의 여유(m) — 음수(높이 겹침)는 0 으로 보이고 소수 한 자리. */
export function formatPlanClearance(gapMeters: number): string {
  if (!Number.isFinite(gapMeters)) return '';
  const clamped = Math.max(0, gapMeters);
  return `Δh ${clamped.toFixed(1)} m`;
}
