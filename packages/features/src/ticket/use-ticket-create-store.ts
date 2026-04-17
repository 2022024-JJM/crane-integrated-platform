import { create } from 'zustand';

type TicketType = 'repair' | 'inspection' | 'parts';

interface TicketCreateState {
  lastCreatedId: string | null;
  lastCreatedType: TicketType | null;
  _tick: number;
  setLastCreated: (id: string, type: TicketType) => void;
  bumpTick: () => void;
  reset: () => void;
}

export const useTicketCreateStore = create<TicketCreateState>()((set) => ({
  lastCreatedId: null,
  lastCreatedType: null,
  _tick: 0,
  setLastCreated: (id, type) => set({ lastCreatedId: id, lastCreatedType: type }),
  bumpTick: () => set((s) => ({ _tick: s._tick + 1 })),
  reset: () => set({ lastCreatedId: null, lastCreatedType: null }),
}));
