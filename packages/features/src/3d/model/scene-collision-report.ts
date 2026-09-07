import { rigLiveReadouts } from './rig-live-readouts';
import type {
  SceneCollisionHit,
  SceneCollisionHitParty,
} from './scene-collision-runtime';
import { tagLiveValues } from './tag-value-bus';
import type {
  SceneCollisionNodeRef,
  SceneCollisionReport,
} from './use-scene-collision-store';

/**
 * 런타임 hit → 스토어 report. 충돌 **순간**의 태그값·관절값을 스냅샷으로
 * 굳힌다 — 오버레이가 나중에 라이브 값을 읽으면 정지 뒤 스무딩·수동
 * 슬라이더로 바뀐 값을 보게 된다.
 */

let nextReportId = 0;

function snapshotParty(party: SceneCollisionHitParty): SceneCollisionNodeRef {
  const seen = new Set<string>();
  const tags: SceneCollisionNodeRef['tags'] = [];
  for (const mapping of party.model.tagMappings ?? []) {
    const key = mapping.tagKey;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    tags.push({ tagKey: key, value: tagLiveValues.get(key)?.value ?? null });
  }
  const readout = rigLiveReadouts.get(party.modelId);
  const jointValues: SceneCollisionNodeRef['jointValues'] = [];
  if (readout) {
    for (const [jointId, value] of readout.jointValues) {
      jointValues.push({ jointId, value });
    }
  }
  return {
    modelId: party.modelId,
    equipName: party.model.equipName,
    nodePath: party.nodePath,
    node: party.mesh,
    tags,
    jointValues,
  };
}

export function buildCollisionReport(
  hit: SceneCollisionHit,
  now: number = Date.now(),
): SceneCollisionReport {
  nextReportId += 1;
  return {
    id: nextReportId,
    pairKey: hit.key,
    a: snapshotParty(hit.a),
    b: snapshotParty(hit.b),
    contactPoint: [hit.contact[0], hit.contact[1], hit.contact[2]],
    detectedAt: now,
  };
}
