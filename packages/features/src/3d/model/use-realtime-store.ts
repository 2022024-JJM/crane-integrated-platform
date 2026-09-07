import { create } from 'zustand';

interface RealtimeEntry {
  key: string;
  value: number;
}

interface RealtimeState {
  isRunning: boolean;
  /**
   * 화면 반영 보류 — 충돌 정지·기록 복원 중. 수신 값은 러너가 drain 만 하고
   * 버스로 내보내지 않는다(버퍼가 무한히 쌓이지 않게). 실제 장비는 계속
   * 움직이므로 release 하면 다음 수신 값부터 최신 자세로 따라간다.
   */
  held: boolean;
  buffer: RealtimeEntry[];
  start: () => void;
  stop: () => void;
  hold: () => void;
  release: () => void;
  pushValue: (key: string, value: number) => void;
  drainBuffer: () => RealtimeEntry[];
}

export const useRealtimeStore = create<RealtimeState>()((set, get) => ({
  isRunning: false,
  held: false,
  buffer: [],

  start: () => set({ isRunning: true, held: false }),
  stop: () => set({ isRunning: false, held: false }),

  hold: () => {
    if (!get().held) set({ held: true });
  },
  release: () => {
    if (get().held) set({ held: false });
  },

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
