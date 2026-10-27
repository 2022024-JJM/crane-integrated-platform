import { useMemo } from 'react';
import { useCraneSnapshotStore } from '@crane/features/3d';
import { buildCraneIdOptions } from '../lib/crane-id-options';

/**
 * 크레인 스냅샷 스토어 → 콤보박스 선택지. 피드는 호출자가 켠다(`useCraneSnapshotFeed`).
 * `cranes` 는 묶음마다 새 참조라 매초 다시 만들지만 크레인 20대 남짓이라 비용이 없다.
 */
export function useCraneIdOptions(offlineLabel: string) {
  const order = useCraneSnapshotStore((s) => s.order);
  const cranes = useCraneSnapshotStore((s) => s.cranes);
  return useMemo(
    () => buildCraneIdOptions(order, cranes, { offline: offlineLabel }),
    [order, cranes, offlineLabel],
  );
}
