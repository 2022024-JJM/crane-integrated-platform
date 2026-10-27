import { create } from 'zustand';
import { persistAll } from '@crane/domain/shared';

export type DomainEntity =
  | 'repair'
  | 'inspection'
  | 'parts'
  | 'asset'
  | 'compliance'
  | 'notes';

interface DomainEventState {
  ticks: Record<DomainEntity, number>;
  lastCreated: { entity: DomainEntity; id: string } | null;
  publish: (entity: DomainEntity, id?: string) => void;
  reset: () => void;
}

const INITIAL_TICKS: Record<DomainEntity, number> = {
  repair: 0,
  inspection: 0,
  parts: 0,
  asset: 0,
  compliance: 0,
  notes: 0,
};

export const useDomainEventStore = create<DomainEventState>()((set) => ({
  ticks: { ...INITIAL_TICKS },
  lastCreated: null,
  publish: (entity, id) => {
    set((s) => ({
      ticks: { ...s.ticks, [entity]: s.ticks[entity] + 1 },
      lastCreated: id ? { entity, id } : s.lastCreated,
    }));
    // 서버가 없는 동안 — 바뀔 때마다 브라우저에 남긴다
    persistAll();
  },
  reset: () => set({ ticks: { ...INITIAL_TICKS }, lastCreated: null }),
}));

export function useEntityTick(entity: DomainEntity): number {
  return useDomainEventStore((s) => s.ticks[entity]);
}

export function useEntityTicks(entities: DomainEntity[]): number {
  return useDomainEventStore((s) =>
    entities.reduce((sum, e) => sum + s.ticks[e], 0),
  );
}
