import { useEffect, useRef } from 'react';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type { RuntimeStatusRecord } from '../lib/model-runtime-status';
import { diffOfflineTransitions } from '../lib/status-journal-map';
import { useStatusJournalStore } from './use-status-journal-store';

/**
 * 운전 상태 기록의 변화를 통신두절 저널로 흘린다 — Monitoring3dView 가
 * useModelRuntimeStatuses 결과를 넘긴다(상태 판정은 그 뷰가 한 번만 한다).
 * 직전 기록은 ref 에 effect 안에서만 쓴다(렌더 중 ref 쓰기 금지).
 *
 * `enabled` 는 실시간 화면만 true — 플레이백(리플레이·시뮬레이션)의 일시정지·
 * 저배속이 만드는 두절은 사건이 아니라 대시보드 이력에 넣지 않는다. 꺼진
 * 동안에도 직전 기록은 따라가서 켜질 때 과거 전이가 한꺼번에 흐르지 않는다.
 */
export function useStatusJournalSync(
  regionId: string,
  sceneInfo: SavedSceneInfo | null,
  statuses: RuntimeStatusRecord,
  enabled = true,
): void {
  const prevRef = useRef<RuntimeStatusRecord>({});
  useEffect(() => {
    useStatusJournalStore.getState().hydrate();
  }, []);
  useEffect(() => {
    const entries = diffOfflineTransitions(
      prevRef.current,
      statuses,
      sceneInfo,
      regionId,
      Date.now(),
    );
    prevRef.current = statuses;
    if (enabled && entries.length > 0) {
      useStatusJournalStore.getState().append(entries);
    }
  }, [statuses, sceneInfo, regionId, enabled]);
}
