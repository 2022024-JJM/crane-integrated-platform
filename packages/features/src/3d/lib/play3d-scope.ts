import type { SavedSceneInfo } from '@crane/domain/3d';
import type { RuntimeStatusRecord } from './model-runtime-status';

/**
 * 3D 플레이 실행 리포트의 집계 범위 — "영역 감지에서 제외"(`zoneExempt`)로
 * 표시한 모델은 장비 집계와 사건에서 뺀다. 적용은 기록기
 * (use-play3d-stats-recorder)에서만 한다 — 공용 상태 훅은 라벨·HUD 가 전
 * 모델을 전제로 쓴다.
 */

/** 리포트에서 빼는 모델 id 집합 — `zoneExempt === true` 인 모델만. */
export function reportExcludedModelIds(
  scene: Pick<SavedSceneInfo, 'models'> | null | undefined,
): Set<string> {
  const out = new Set<string>();
  for (const model of scene?.models ?? []) {
    if (model?.zoneExempt === true && typeof model.id === 'string') {
      out.add(model.id);
    }
  }
  return out;
}

/** 제외 모델을 뺀 상태 기록. 뺄 것이 없으면 같은 참조(불필요한 effect 방지). */
export function omitRuntimeStatuses(
  record: RuntimeStatusRecord,
  excluded: ReadonlySet<string>,
): RuntimeStatusRecord {
  if (excluded.size === 0) return record;
  let removed = false;
  const next: Record<string, RuntimeStatusRecord[string]> = {};
  for (const [modelId, status] of Object.entries(record)) {
    if (excluded.has(modelId)) removed = true;
    else next[modelId] = status;
  }
  return removed ? next : record;
}

/** 충돌한 두 모델 중 하나라도 제외 모델이면 리포트 사건으로 남기지 않는다. */
export function isCollisionExcluded(
  aModelId: string,
  bModelId: string,
  excluded: ReadonlySet<string>,
): boolean {
  return excluded.has(aModelId) || excluded.has(bModelId);
}
