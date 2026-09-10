import { useEffect } from 'react';
import { toCollisionJournalEntries } from '../lib/collision-journal-map';
import { useCollisionJournalStore } from '../model/use-collision-journal-store';
import { useSceneCollisionStore } from '../model/use-scene-collision-store';
import { useSceneInfoStore } from '../model/use-scene-info-store';

/**
 * 세션 충돌 스토어 → 영속 journal 브릿지. 앱 셸 runtime effects 에 1회
 * 마운트한다(모듈 부수효과 금지 관례).
 *
 * useSceneCollisionStore 는 한 줄도 건드리지 않고 밖에서 구독만 한다 — 3D
 * 쪽 동작(정지·억제·기록 10건)은 불변이다. `clearHistory` 는 세션 기록만
 * 비우고 journal 에는 영향이 없다(append-only, 의도된 동작). 같은 record 가
 * 다시 흘러도 key(`at:pairKey`) dedupe 로 중복되지 않는다.
 */
export function CollisionJournalSync() {
  useEffect(() => {
    useCollisionJournalStore.getState().hydrate();
    return useSceneCollisionStore.subscribe((state, prev) => {
      if (state.history === prev.history) return;
      // pushRecord 는 앞에 붙인다 — prev 에 없는 id 가 새 기록이다
      // (id 는 세션 내 단조증가라 세션 내 비교로는 유효하다).
      const prevIds = new Set(prev.history.map((record) => record.id));
      const fresh = state.history.filter(
        (record) => !prevIds.has(record.id),
      );
      if (fresh.length === 0) return;
      useCollisionJournalStore
        .getState()
        .append(
          toCollisionJournalEntries(
            fresh,
            useSceneInfoStore.getState().sceneInfoByRegion,
          ),
        );
    });
  }, []);
  return null;
}
