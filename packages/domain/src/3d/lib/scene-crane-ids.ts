import { normalizeCraneKey } from '@crane/core/lib/crane-tag-key';
import type { SavedSceneInfo } from '../model/types';

/**
 * 씬 모델에 연결된 크레인 ID — 리플레이가 이력을 받을 크레인이다. 서버 표기
 * (`GC-01` → `GC_01`)로 맞추고 중복을 빼며 모델 순서를 지킨다. 크레인이 없는
 * 모델은 건너뛴다.
 */
export function collectSceneCraneIds(
  sceneInfo: Pick<SavedSceneInfo, 'models'> | null | undefined,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const model of sceneInfo?.models ?? []) {
    const raw = model.craneId?.trim();
    if (!raw) continue;
    const id = normalizeCraneKey(raw);
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
