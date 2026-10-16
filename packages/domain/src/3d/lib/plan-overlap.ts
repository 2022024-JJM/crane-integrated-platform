import type { Box3 } from 'three';

/**
 * 평면도(직교 탑뷰) 겹침 — 위에서 보면 겹치는 장비 쌍을 찾아 어느 쪽이
 * 위(가리는 쪽)이고 어느 쪽이 아래(가려지는 쪽)인지 낸다. 실제 충돌 판정
 * (collision-volumes.ts · scene-collision-runtime)과는 별개의 **표시용**
 * 계산이다: 가려지는 장비에 숨은선을 그리는 것이 목적이라 메쉬 월드 AABB
 * 만으로 판정한다(회전한 긴 붐의 AABB 는 실제보다 넓어 겹침을 과하게 잡을
 * 수 있다 — 숨은선이 하나 더 그려지는 쪽이 안 그려지는 쪽보다 낫다).
 *
 * 입력은 모델별 메쉬 월드 박스 목록이고 프레임마다 호출자가 채운다. 위·아래는
 * 겹치는 메쉬 쌍 중 수직 여유가 가장 작은 쌍 기준이고, 그 여유 `gap`(씬
 * 단위)은 0 이하면 AABB 로는 높이도 겹친다는 뜻이다 — 진짜 닿았는지는 충돌
 * 감지가 판정하고, 여유 값은 화면에 쓰지 않는다.
 */

export interface PlanOverlapMember {
  id: string;
  /** 모델 전체 월드 박스 — 1차 거름용. */
  bounds: Box3;
  /** 충돌 대상 메쉬의 월드 박스(collectCollidableMeshes 순서). */
  boxes: readonly Box3[];
}

export interface PlanOverlap {
  /** 쌍 키(id 정렬) — 변화 비교. */
  key: string;
  /** 위에 있는 쪽(가장 작은 여유를 만든 메쉬 쌍 기준). */
  upperId: string;
  /** 아래(가려지는) 쪽. */
  lowerId: string;
  /** 가장 작은 수직 여유(씬 단위). 0 이하 = 높이도 겹침. 위·아래 선택 근거. */
  gap: number;
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
          best = {
            key: planOverlapKey(a.id, b.id),
            upperId: bAbove ? b.id : a.id,
            lowerId: bAbove ? a.id : b.id,
            gap,
          };
        }
      }
      if (best) out.push(best);
    }
  }
  return out;
}

/**
 * 겹침 목록이 표시상 같은지 — 숨은선 대상(쌍과 위·아래)만 본다. 여유 값은
 * 화면에 쓰지 않으므로 장비가 겹친 채 움직여도 같다(스토어를 다시 쓰지
 * 않아 모델 묶음이 리렌더되지 않는다).
 */
export function isPlanOverlapListEqual(
  a: readonly PlanOverlap[],
  b: readonly PlanOverlap[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].key !== b[i].key || a[i].upperId !== b[i].upperId) return false;
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

