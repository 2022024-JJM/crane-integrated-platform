import { create } from 'zustand';

/** 수신 버퍼 — 키당 **최신값 하나**만 남는다(삽입 순서 유지). */
export type RealtimeBuffer = Map<string, number>;

interface RealtimeState {
  isRunning: boolean;
  /**
   * 화면 반영 보류 — 충돌 정지·기록 복원 중. 수신 값은 러너가 drain 만 하고
   * 버스로 내보내지 않는다(버퍼가 무한히 쌓이지 않게). 실제 장비는 계속
   * 움직이므로 release 하면 다음 수신 값부터 최신 자세로 따라간다.
   */
  held: boolean;
  /**
   * 키당 최신값만 보관하는 Map. 한 프레임 사이에 같은 태그가 여러 번 와도
   * 마지막 값만 publish 되고(중간값은 스무딩이 어차피 가린다), 탭이 숨겨져
   * useFrame 이 멈춘 동안에도 크기가 태그 수를 넘지 않는다.
   */
  buffer: RealtimeBuffer;
  /**
   * 수신 활동 — 마지막 메시지 시각(performance.now). 프레임 거버너가
   * "값이 실제로 들어오고 있는가" 를 판정하는 데 쓴다(isRunning 은 연결 시도
   * 중에도 true 라 서버가 없으면 30fps 가 헛돈다). buffer 처럼 set() 없이
   * 제자리 갱신 — 메시지마다 리렌더가 나면 안 된다.
   */
  activity: { lastMessageAt: number };
  start: () => void;
  stop: () => void;
  hold: () => void;
  release: () => void;
  pushValue: (key: string, value: number) => void;
  /**
   * 수신 클라이언트의 배치(키 사전 + id·값 배열)를 한 번에 넣는다. 같은 키가
   * 배치에 두 번 오지 않으므로(전송이 이미 병합) Map set 만 count 번이다.
   */
  pushBatch: (
    keys: readonly string[],
    ids: Int32Array,
    values: Float64Array,
    count: number,
  ) => void;
  /**
   * 쌓인 버퍼를 넘기고 빈 버퍼로 바꾼다. 돌려준 Map 은 **다음 drain 까지만**
   * 유효하다 — 두 Map 을 번갈아 쓰므로(프레임마다 새 Map 을 만들지 않게)
   * 다음 drain 이 그것을 비워 재사용한다. 호출한 프레임 안에서 다 읽는다.
   */
  drainBuffer: () => RealtimeBuffer;
}

/** drain 의 교대용 Map — 직전 drain 이 넘긴 Map 이 여기 남아 다음 drain 에 비워진다. */
let spare: RealtimeBuffer = new Map();

export const useRealtimeStore = create<RealtimeState>()((set, get) => ({
  isRunning: false,
  held: false,
  buffer: new Map(),
  activity: { lastMessageAt: Number.NEGATIVE_INFINITY },

  // 시작·정지 때 남은 값은 버린다 — 화면 이탈 중 쌓인 값이 재진입 첫
  // 프레임에 한꺼번에 publish 되지 않게.
  start: () => {
    get().buffer.clear();
    set({ isRunning: true, held: false });
  },
  stop: () => {
    get().buffer.clear();
    set({ isRunning: false, held: false });
  },

  hold: () => {
    if (!get().held) set({ held: true });
  },
  release: () => {
    if (get().held) set({ held: false });
  },

  pushValue: (key, value) => {
    // buffer는 useFrame 루프에서만 drain되므로 in-place set으로 충분하다.
    // zustand set()을 호출하면 매 메시지마다 구독자 리렌더가 발생하므로
    // Map을 직접 mutate하고 React 상태 변경은 일으키지 않는다.
    get().buffer.set(key, value);
    get().activity.lastMessageAt = performance.now();
  },

  pushBatch: (keys, ids, values, count) => {
    if (count <= 0) return;
    const buffer = get().buffer;
    for (let i = 0; i < count; i++) {
      const key = keys[ids[i]!];
      if (key !== undefined) buffer.set(key, values[i]!);
    }
    get().activity.lastMessageAt = performance.now();
  },

  drainBuffer: () => {
    const current = get().buffer;
    if (current.size === 0) return current;
    // swap: 직전에 넘겼던 Map 을 비워 새 버퍼로 쓰고, 채워진 쪽을 돌려준다.
    const next = spare;
    next.clear();
    spare = current;
    set({ buffer: next });
    return current;
  },
}));
