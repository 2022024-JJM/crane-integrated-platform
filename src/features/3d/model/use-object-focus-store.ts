import { create } from 'zustand';

interface ObjectFocusState {
  focusStack: string[];
  focusedModelId: string | null;
  pushFocus: (id: string) => void;
  popFocus: () => void;
  clearFocus: () => void;
}

export const useObjectFocusStore = create<ObjectFocusState>()((set, get) => ({
  focusStack: [],
  focusedModelId: null,
  pushFocus: (id) => {
    const { focusStack } = get();

    if (focusStack[focusStack.length - 1] === id) {
      return;
    }

    const nextStack = [...focusStack, id];
    set({ focusStack: nextStack, focusedModelId: id });
  },
  popFocus: () => {
    const { focusStack } = get();

    if (focusStack.length === 0) {
      return;
    }

    const nextStack = focusStack.slice(0, -1);
    set({
      focusStack: nextStack,
      focusedModelId: nextStack[nextStack.length - 1] ?? null,
    });
  },
  clearFocus: () => set({ focusStack: [], focusedModelId: null }),
}));
