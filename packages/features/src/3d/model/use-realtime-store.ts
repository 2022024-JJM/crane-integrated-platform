import { create } from 'zustand';

interface RealtimeEntry {
  key: string;
  value: number;
}

interface RealtimeState {
  isRunning: boolean;
  buffer: RealtimeEntry[];
  start: () => void;
  stop: () => void;
  pushValue: (key: string, value: number) => void;
  drainBuffer: () => RealtimeEntry[];
}

export const useRealtimeStore = create<RealtimeState>()((set, get) => ({
  isRunning: false,
  buffer: [],

  start: () => set({ isRunning: true }),
  stop: () => set({ isRunning: false }),

  pushValue: (key, value) => {
    // buffer는 useFrame 루프에서만 drain되므로 in-place push로 충분하다.
    // zustand set()을 호출하면 매 메시지마다 구독자 리렌더가 발생하므로
    // 배열을 직접 mutate하고 React 상태 변경은 일으키지 않는다.
    get().buffer.push({ key, value });
  },

  drainBuffer: () => {
    const current = get().buffer;
    if (current.length === 0) return current;
    // swap: 새 빈 배열로 교체하고 이전 배열을 반환
    set({ buffer: [] });
    return current;
  },
}));
