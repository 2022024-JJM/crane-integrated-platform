import type { SavedSceneInfo } from '@crane/domain/3d';
import type { CollisionJournalEntry } from '@crane/domain/journal';
import type { SceneCollisionRecord } from '../model/use-scene-collision-store';

/**
 * 세션 충돌 기록(SceneCollisionRecord) → 영속 journal 항목 변환.
 *
 * - identity 는 `${at}:${pairKey}` — 세션 카운터 `id` 는 새로고침마다
 *   재시작해 영속 키로 못 쓴다.
 * - `values`(씬 전체 자세 스냅샷)는 버린다 — 캔버스 없는 대시보드에선 복원할
 *   수 없고, 100건이면 수백 KB 가 된다.
 * - regionId 는 record 에 없어 씬 정보에서 역조회한다. 충돌 발생 시점엔 해당
 *   region 의 모니터링 화면이 마운트돼 있어 `sceneInfoByRegion` 에 그 씬이
 *   존재한다. 한 씬 파일을 공유하는 region 들은 같은 모델 id 를 가지므로
 *   화면에 떠 있는 region(preferred)을 먼저 본다. 에디터 씬처럼 region
 *   밖에서 난 충돌은 null 로 남긴다.
 */

function resolveRegionIdForModel(
  sceneInfoByRegion: Readonly<Record<string, SavedSceneInfo>>,
  modelId: string,
  preferredRegionId?: string | null,
): string | null {
  if (
    preferredRegionId &&
    sceneInfoByRegion[preferredRegionId]?.models?.some(
      (model) => model.id === modelId,
    )
  ) {
    return preferredRegionId;
  }
  for (const [regionId, sceneInfo] of Object.entries(sceneInfoByRegion)) {
    if (sceneInfo.models?.some((model) => model.id === modelId)) {
      return regionId;
    }
  }
  return null;
}

export function toCollisionJournalEntries(
  records: readonly SceneCollisionRecord[],
  sceneInfoByRegion: Readonly<Record<string, SavedSceneInfo>>,
  preferredRegionId?: string | null,
): CollisionJournalEntry[] {
  return records.map((record) => ({
    key: `${record.at}:${record.pairKey}`,
    at: record.at,
    pairKey: record.pairKey,
    regionId:
      resolveRegionIdForModel(
        sceneInfoByRegion,
        record.a.modelId,
        preferredRegionId,
      ) ??
      resolveRegionIdForModel(
        sceneInfoByRegion,
        record.b.modelId,
        preferredRegionId,
      ),
    a: { modelId: record.a.modelId, equipName: record.a.equipName },
    b: { modelId: record.b.modelId, equipName: record.b.equipName },
    contactPoint: record.contactPoint,
  }));
}
