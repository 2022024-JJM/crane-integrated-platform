// SOSLAB Edge Node Bridge Server 의 ProcessedPointCloudBundle WebSocket 스트림을
// 단일 연결로 받고, 비전 그리드(SOSLAB1/SOSLAB2/Fusion 3개 타일) + PiP 등
// 다수 구독자에게 fan-out 한다.
//
// React 상태 변경은 status/lastError/refCount 같은 메타에만 발생시키고,
// 실제 포인트 데이터는 sensors Map 의 SensorBuffer 객체를 in-place 로 갱신한 뒤
// globalFrameCounter 만 증가시킨다. 구독자(<SensorPoints>)는 useFrame 안에서
// 카운터 변화를 감지해 BufferAttribute 를 갱신한다 — 매 메시지마다 React
// 리렌더가 일어나지 않게 하기 위함이다 (use-realtime-store.ts 와 동일 패턴).

import { create } from 'zustand';
import { getSoslabWebSocketUrl } from '@crane/core/config/network';
import { decodeBundle } from '../lib/soslab/proto-decoder';
import { parseFrame, type ParsedFrame } from '../lib/soslab/point-cloud-parser';
import {
  RECONNECT_BACKOFF_MS,
  SENSOR_COLORS,
} from '../lib/soslab/config';

export type SoslabSensorMode = 'soslab1' | 'soslab2' | 'fusion';

export type SoslabConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'closed';

export interface SensorBuffer {
  /** 서버가 보낸 원본 sensor_name (예: 'SOSLAB1', 'SOSLAB2') */
  sensorName: string;
  /** 가장 최근에 파싱된 frame. 첫 프레임 도착 전까지 null */
  parsed: ParsedFrame | null;
  lastUpdatedAtMs: number;
  /** 이 센서에 도착한 누적 프레임 수 */
  frameCounter: number;
  colorHex: string;
}

interface SoslabStreamState {
  status: SoslabConnectionStatus;
  lastError: string;
  refCount: number;
  /** key = 정규화된 센서 키 ('soslab1', 'soslab2') */
  sensors: Map<string, SensorBuffer>;
  /** 구독자가 useFrame 에서 polling 하는 글로벌 카운터 */
  globalFrameCounter: number;

  acquire: () => void;
  release: () => void;
}

// 모듈-스코프 단일 WebSocket. zustand state 에 두면 set 에 의해 구독자
// 리렌더가 발생할 수 있어 따로 관리한다.
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelayMs: number = RECONNECT_BACKOFF_MS.initial;

function normalizeSensorKey(rawName: string): string {
  return rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickColorForKey(key: string, sensorIndex: number): string {
  // SOSLAB1/SOSLAB2 의 경우 안정된 색을 부여 (참조 SENSOR_COLORS[0], [1] 매핑).
  if (key === 'soslab1') return SENSOR_COLORS[0];
  if (key === 'soslab2') return SENSOR_COLORS[1];
  return SENSOR_COLORS[sensorIndex % SENSOR_COLORS.length];
}

export const useSoslabStreamStore = create<SoslabStreamState>()((set, get) => {
  function clearReconnectTimer() {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    clearReconnectTimer();
    if (get().refCount <= 0) return;
    set({ status: 'closed' });
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (get().refCount > 0) connect();
    }, reconnectDelayMs);
    reconnectDelayMs = Math.min(
      RECONNECT_BACKOFF_MS.max,
      Math.round(reconnectDelayMs * RECONNECT_BACKOFF_MS.multiplier),
    );
  }

  function connect() {
    if (socket) {
      try {
        socket.close();
      } catch {
        // ignore
      }
      socket = null;
    }

    set({ status: 'connecting', lastError: '' });

    const url = getSoslabWebSocketUrl();
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    socket = ws;

    ws.onopen = () => {
      if (socket !== ws) return;
      reconnectDelayMs = RECONNECT_BACKOFF_MS.initial;
      set({ status: 'connected', lastError: '' });
    };

    ws.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (socket !== ws) return;
      if (!(event.data instanceof ArrayBuffer)) return;

      try {
        const bundle = decodeBundle(event.data);
        const sensors = get().sensors;
        for (const frame of bundle.frames) {
          const rawName = frame.sensor_name || 'unknown';
          const key = normalizeSensorKey(rawName) || `sensor${sensors.size}`;
          const parsed = parseFrame(frame);
          if (!parsed.ok) continue;

          const existing = sensors.get(key);
          if (existing) {
            existing.parsed = parsed;
            existing.lastUpdatedAtMs = Date.now();
            existing.frameCounter += 1;
            // sensorName 은 첫 프레임에서 확정 — 변하지 않음
          } else {
            sensors.set(key, {
              sensorName: rawName,
              parsed,
              lastUpdatedAtMs: Date.now(),
              frameCounter: 1,
              colorHex: pickColorForKey(key, sensors.size),
            });
          }
        }
        // 메타 (status/error) 변경 없이 카운터만 +1 — 구독 컴포넌트의 리렌더는
        // 일으키지 않는다. useFrame 루프에서 직접 store.getState() 로 polling.
        set({ globalFrameCounter: get().globalFrameCounter + 1 });
      } catch (error) {
        set({
          status: 'error',
          lastError:
            error instanceof Error ? error.message : 'Decode failure',
        });
      }
    };

    ws.onerror = () => {
      if (socket !== ws) return;
      set({ status: 'error', lastError: 'WebSocket transport error' });
    };

    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
      if (get().refCount > 0) {
        scheduleReconnect();
      } else {
        set({ status: 'idle' });
      }
    };
  }

  function disconnect() {
    clearReconnectTimer();
    reconnectDelayMs = RECONNECT_BACKOFF_MS.initial;
    if (socket) {
      const ws = socket;
      socket = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
    get().sensors.clear();
    set({
      status: 'idle',
      lastError: '',
      globalFrameCounter: 0,
    });
  }

  return {
    status: 'idle',
    lastError: '',
    refCount: 0,
    sensors: new Map<string, SensorBuffer>(),
    globalFrameCounter: 0,

    acquire: () => {
      const next = get().refCount + 1;
      set({ refCount: next });
      if (next === 1) connect();
    },

    release: () => {
      const next = Math.max(0, get().refCount - 1);
      set({ refCount: next });
      if (next === 0) disconnect();
    },
  };
});

/** 비-React 컨텍스트에서 SensorBuffer 를 직접 읽기 위한 헬퍼 */
export function getSensorBuffer(sensorKey: string): SensorBuffer | undefined {
  return useSoslabStreamStore.getState().sensors.get(sensorKey);
}
