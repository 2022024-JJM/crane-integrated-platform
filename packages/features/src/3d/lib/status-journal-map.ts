import type { StatusJournalEntry } from '@crane/domain/journal';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type { RuntimeStatusRecord } from './model-runtime-status';

/**
 * 운전 상태 기록의 두 스냅샷 → 통신두절 진입·복귀 저널 항목. 그 밖의 전환은
 * 남기지 않는다(수시로 바뀌어 100건 상한을 금방 채운다). 직전 기록에 없던
 * 모델의 첫 판정도 사건이 아니다(로드 직후의 초기화).
 *
 * 직전 상태가 unknown 인 것만으로는 거르지 않는다 — 운전 전원을 모르는 멈춘
 * 장비도 unknown 이라, 그 장비의 수신이 끊기면 unknown → offline 이 실제
 * 두절이다.
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
    const from = prev[modelId];
    if (from === undefined || from === to) continue;
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
