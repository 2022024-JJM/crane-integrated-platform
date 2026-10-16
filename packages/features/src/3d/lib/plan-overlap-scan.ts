import { Box3, type Mesh, type Object3D } from 'three';
import {
  collectCollidableMeshes,
  collectPlanHiddenIds,
  isPlanOverlapListEqual,
  meshWorldBox,
  resolvePlanOverlaps,
  type PlanOverlap,
  type PlanOverlapMember,
} from '@crane/domain/3d';

/** 검출 주기(ms) — 표시용이라 프레임마다 돌지 않는다. */
export const PLAN_OVERLAP_SCAN_INTERVAL_MS = 250;

interface ScanEntry {
  id: string;
  root: Object3D;
  meshes: Mesh[];
  member: PlanOverlapMember & { boxes: Box3[] };
}

/**
 * 평면도 겹침 스캐너 — 모델 루트를 받아 메쉬 월드 박스를 채우고 겹침을
 * 낸다. 루트 참조가 바뀐 모델만 메쉬를 다시 모은다(clone 교체 대응).
 * 결과 배열은 재사용하므로(항목은 스캔마다 새 객체) 호출자는 바뀐 것을
 * 알았을 때 배열을 복사해 보관한다.
 */
export class PlanOverlapScanner {
  private readonly entries = new Map<string, ScanEntry>();
  private readonly members: ScanEntry['member'][] = [];
  private readonly scratch: PlanOverlap[] = [];

  /**
   * `roots` 는 (모델 id → 루트) 조회. `ids` 순서가 결과 순서다. registry 에
   * 없는 모델은 건너뛴다.
   */
  scan(
    ids: readonly string[],
    roots: (id: string) => Object3D | undefined,
  ): readonly PlanOverlap[] {
    const live = new Set<string>();
    this.members.length = 0;
    for (const id of ids) {
      const root = roots(id);
      if (!root) continue;
      live.add(id);
      let entry = this.entries.get(id);
      if (!entry || entry.root !== root) {
        const meshes = collectCollidableMeshes(root, []);
        entry = {
          id,
          root,
          meshes,
          member: {
            id,
            bounds: new Box3(),
            boxes: meshes.map(() => new Box3()),
          },
        };
        this.entries.set(id, entry);
      }
      const { member, meshes } = entry;
      member.bounds.makeEmpty();
      for (let i = 0; i < meshes.length; i += 1) {
        meshWorldBox(meshes[i], member.boxes[i]);
        member.bounds.union(member.boxes[i]);
      }
      this.members.push(member);
    }
    for (const id of this.entries.keys()) {
      if (!live.has(id)) this.entries.delete(id);
    }
    return resolvePlanOverlaps(this.members, this.scratch);
  }

  clear(): void {
    this.entries.clear();
    this.members.length = 0;
    this.scratch.length = 0;
  }
}

/** 스캔 결과의 숨은선 대상(쌍·위아래)이 바뀌었는지 — 스토어에 쓸지 가른다. */
export function hasPlanOverlapChanged(
  previous: readonly PlanOverlap[],
  next: readonly PlanOverlap[],
): boolean {
  return !isPlanOverlapListEqual(previous, next);
}

/** 겹침 목록 → 숨은선 인덱스 맵(가려지는 모델 순서대로 0부터). */
export function buildPlanHiddenIndex(
  overlaps: readonly PlanOverlap[],
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  collectPlanHiddenIds(overlaps).forEach((id, index) => map.set(id, index));
  return map;
}

