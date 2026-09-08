import { rigValueStore } from './rig-value-store';
import type {
  SceneCollisionHit,
  SceneCollisionHitParty,
} from './scene-collision-runtime';
import type {
  SceneCollisionRecord,
  SceneCollisionRecordParty,
} from './use-scene-collision-store';

/**
 * 런타임 hit → 충돌 기록. 충돌 **순간**의 씬 전체 자세(값 저장소 스냅샷)를
 * 굳혀 두어, 나중에 기록을 클릭하면 그 자세로 돌아갈 수 있다. 노드는
 * Object3D 대신 id·경로로 남긴다(use-scene-collision-store 주석).
 */

let nextRecordId = 0;

function party(p: SceneCollisionHitParty): SceneCollisionRecordParty {
  return {
    modelId: p.modelId,
    equipName: p.model.equipName,
    nodePath: p.nodePath,
  };
}

export function buildCollisionRecord(
  hit: SceneCollisionHit,
  now: number = Date.now(),
): SceneCollisionRecord {
  nextRecordId += 1;
  return {
    id: nextRecordId,
    pairKey: hit.key,
    at: now,
    a: party(hit.a),
    b: party(hit.b),
    contactPoint: [hit.contact[0], hit.contact[1], hit.contact[2]],
    values: rigValueStore.snapshot(),
  };
}
