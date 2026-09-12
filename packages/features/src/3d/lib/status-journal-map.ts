import type { StatusJournalEntry } from '@crane/domain/journal';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type { RuntimeStatusRecord } from './model-runtime-status';

/**
 * 운전 상태 기록의 두 스냅샷 → 통신두절 진입·복귀 저널 항목. 가동↔대기 전환은
 * 남기지 않는다(수시로 바뀌어 100건 상한을 금방 채운다). 처음 판정되는
 * 'unknown' → x 도 사건이 아니다(로드 직후의 초기화).
 */
export function diffOfflineTransitions(
  prev: RuntimeStatusRecord,
  next: RuntimeStatusRecord,
  sceneInfo: SavedSceneInfo | null,
  regionId: string,
  at: number,
): StatusJournalEntry[] {
  const entries: StatusJournalEntry[] = [];
  for (const [modelId, to] of Object.entries(next)) {
    const from = prev[modelId] ?? 'unknown';
    if (from === to) continue;
    if (from === 'unknown') continue;
    if (from !== 'offline' && to !== 'offline') continue;
    const model = sceneInfo?.models.find((m) => m.id === modelId);
    entries.push({
      key: `${at}:${modelId}:${to}`,
      at,
      regionId,
      modelId,
      equipName: model?.equipName || modelId,
      from,
      to,
    });
  }
  return entries;
}
