import { useEffect } from 'react';
import {
  diffZoneIntrusions,
  findRegionOfModel,
  pairKeyOf,
  toZoneJournalEntry,
} from '../lib/zone-journal-map';
import { useSceneInfoStore } from '../model/use-scene-info-store';
import { useSceneZoneStore } from '../model/use-scene-zone-store';
import { useZoneJournalStore } from '../model/use-zone-journal-store';

/**
 * 영역 침범 스토어 → 영속 journal 브릿지. 앱 셸 runtime effects 에
 * CollisionJournalSync 옆에 1회 마운트한다. 스토어는 밖에서 구독만 한다 —
 * 두 스냅샷의 쌍 차이로 진입·이탈을 복원하고, 진입 시각을 모듈 Map 에 들고
 * 있다가 이탈 항목의 머문 시간으로 쓴다(새로고침으로 잃으면 null).
 */
export function ZoneJournalSync() {
  useEffect(() => {
    useZoneJournalStore.getState().hydrate();
    const enteredAt = new Map<string, number>();
    return useSceneZoneStore.subscribe((state, prev) => {
      if (state.intrusions === prev.intrusions) return;
      const { entered, exited } = diffZoneIntrusions(
        prev.intrusions,
        state.intrusions,
      );
      if (entered.length === 0 && exited.length === 0) return;
      const now = Date.now();
      const scenes = useSceneInfoStore.getState().sceneInfoByRegion;
      const entries = [
        ...entered.map((ref) => {
          enteredAt.set(pairKeyOf(ref.intrusion.zoneKey, ref.intruderId), now);
          return toZoneJournalEntry(
            ref,
            'enter',
            now,
            findRegionOfModel(ref.intrusion.ownerId, scenes),
            null,
          );
        }),
        ...exited.map((ref) => {
          const key = pairKeyOf(ref.intrusion.zoneKey, ref.intruderId);
          const at = enteredAt.get(key) ?? null;
          enteredAt.delete(key);
          return toZoneJournalEntry(
            ref,
            'exit',
            now,
            findRegionOfModel(ref.intrusion.ownerId, scenes),
            at,
          );
        }),
      ];
      useZoneJournalStore.getState().append(entries);
    });
  }, []);
  return null;
}
