import { create } from 'zustand';

interface ObjectFocusState {
  focusedModelId: string | null;
  focusModel: (id: string) => void;
  clearFocus: () => void;
}

export const useObjectFocusStore = create<ObjectFocusState>()((set) => ({
  focusedModelId: null,
  focusModel: (id) => set({ focusedModelId: id }),
  clearFocus: () => set({ focusedModelId: null }),
}));
