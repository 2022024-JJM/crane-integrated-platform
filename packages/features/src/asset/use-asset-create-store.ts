import { create } from 'zustand';

interface AssetCreateState {
  _tick: number;
  bumpTick: () => void;
}

export const useAssetCreateStore = create<AssetCreateState>()((set) => ({
  _tick: 0,
  bumpTick: () => set((s) => ({ _tick: s._tick + 1 })),
}));
