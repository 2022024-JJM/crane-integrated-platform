// LiDAR Edge Node Bridge Server 의 ProcessedPointCloudBundle WebSocket 스트림을
// 단일 연결로 받고, 비전 그리드(SOSLAB1/SOSLAB2/Fusion 3개 타일) + PiP 등
// 다수 구독자에게 fan-out 한다. 서버 vendor (SOSLAB/OUSTER/SICK 등) 와 무관하게
// 동일한 포맷이므로 본 store 는 vendor 중립이다.
//
// React 상태 변경은 status/lastError/refCount 같은 메타에만 발생시키고,
// 실제 포인트 데이터는 sensors Map 의 SensorBuffer 객체를 in-place 로 갱신한 뒤
// globalFrameCounter 만 증가시킨다. 구독자(<SensorPoints>)는 useFrame 안에서
// 카운터 변화를 감지해 BufferAttribute 를 갱신한다 — 매 메시지마다 React
// 리렌더가 일어나지 않게 하기 위함이다 (use-realtime-store.ts 와 동일 패턴).

import { create } from 'zustand';
import { getPointCloudWebSocketUrl } from '@crane/core/config/network';
import { decodeBundle } from '../lib/point-cloud/proto-decoder';
import { parseFrame, type ParsedFrame } from '../lib/point-cloud/point-cloud-parser';
import {
  RECONNECT_BACKOFF_MS,
  SENSOR_COLORS,
} from '../lib/point-cloud/config';

export type PointCloudSensorMode = 'soslab1' | 'soslab2' | 'fusion';

export type PointCloudConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'closed';

export interface SensorTransform {
  position: { x: number; y: number; z: number };
  /** degree 단위. 적용 시점에 DEG_TO_RAD 로 변환한다 (참조 viewer.js 와 동일). */
  rotation: { x: number; y: number; z: number };
}

export interface SensorBuffer {
  /** 서버가 보낸 원본 sensor_name (예: 'SOSLAB1', 'SOSLAB2') */
  sensorName: string;
  /** 가장 최근에 파싱된 frame. 첫 프레임 도착 전까지 null */
  parsed: ParsedFrame | null;
  lastUpdatedAtMs: number;
  /** 이 센서에 도착한 누적 프레임 수 */
  frameCounter: number;
  colorHex: string;
  /** 원본 PointCloudFrame 메타 (HUD 표시용) */
  frameId: string;
  sourceTopic: string;
  vendor: string;
  /** 가시성 토글 (Fusion HUD 의 sensor card 체크박스) */
  isVisible: boolean;
  /** 런타임 transform. position 은 m, rotation 은 deg. */
  transform: SensorTransform;
  /** transform 변경 시 +1. SensorPoints 가 polling 해서 mesh 에 반영. */
  transformRevision: number;
}

export interface BundleMeta {
  /** 가장 최근에 받은 sequence. 미수신은 null */
  lastSequence: bigint | null;
  /** lastSequence 직전에 빠진 sequence 개수 */
  lastGap: bigint;
  processorName: string;
  windowSizeMs: number;
  totalRenderedPoints: number;
  lastBundleAtMs: number;
}

interface PointCloudStreamState {
  status: PointCloudConnectionStatus;
  lastError: string;
  refCount: number;
  /** key = 정규화된 센서 키 ('soslab1', 'soslab2') */
  sensors: Map<string, SensorBuffer>;
  /** 구독자가 useFrame 에서 polling 하는 글로벌 카운터 */
  globalFrameCounter: number;
  /** HUD 가 polling 하는 bundle 메타 */
  bundle: BundleMeta;

  acquire: () => void;
  release: () => void;

  setSensorVisible: (sensorKey: string, visible: boolean) => void;
  setSensorTransformAxis: (
    sensorKey: string,
    group: 'position' | 'rotation',
    axis: 'x' | 'y' | 'z',
    value: number,
  ) => void;
  resetSensorTransform: (sensorKey: string) => void;
}

function createDefaultTransform(): SensorTransform {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  };
}

function createInitialBundleMeta(): BundleMeta {
  return {
    lastSequence: null,
    lastGap: 0n,
    processorName: 'unknown',
    windowSizeMs: 0,
    totalRenderedPoints: 0,
    lastBundleAtMs: 0,
  };
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

export const usePointCloudStreamStore = create<PointCloudStreamState>()((set, get) => {
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

    const url = getPointCloudWebSocketUrl();
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
        const bundleMeta = get().bundle;
        const now = Date.now();

        let totalRendered = 0;
        for (const frame of bundle.frames) {
          const rawName = frame.sensor_name || 'unknown';
          const key = normalizeSensorKey(rawName) || `sensor${sensors.size}`;
          const parsed = parseFrame(frame);

          const existing = sensors.get(key);
          if (existing) {
            existing.parsed = parsed;
            existing.lastUpdatedAtMs = now;
            existing.frameCounter += 1;
            existing.frameId = frame.frame_id || existing.frameId;
            existing.sourceTopic = frame.source_topic || existing.sourceTopic;
            existing.vendor = frame.vendor || existing.vendor;
          } else {
            sensors.set(key, {
              sensorName: rawName,
              parsed,
              lastUpdatedAtMs: now,
              frameCounter: 1,
              colorHex: pickColorForKey(key, sensors.size),
              frameId: frame.frame_id || '-',
              sourceTopic: frame.source_topic || '-',
              vendor: frame.vendor || '-',
              isVisible: true,
              transform: createDefaultTransform(),
              transformRevision: 0,
            });
          }

          if (parsed.ok) {
            totalRendered += parsed.sampledPointCount;
          }
        }

        const prevSequence = bundleMeta.lastSequence;
        const gap =
          prevSequence !== null && bundle.sequence > prevSequence + 1n
            ? bundle.sequence - prevSequence - 1n
            : 0n;

        // 메타 객체는 in-place 갱신 (리렌더 방지). globalFrameCounter +1 로
        // useFrame polling 측에 변경 알림. React 측에서 HUD 갱신을 원하면
        // 별도 interval tick 으로 강제 리렌더한다.
        bundleMeta.lastSequence = bundle.sequence;
        bundleMeta.lastGap = gap;
        bundleMeta.processorName = bundle.processor_name;
        bundleMeta.windowSizeMs = bundle.window_size_ms;
        bundleMeta.totalRenderedPoints = totalRendered;
        bundleMeta.lastBundleAtMs = now;

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
      bundle: createInitialBundleMeta(),
    });
  }

  return {
    status: 'idle',
    lastError: '',
    refCount: 0,
    sensors: new Map<string, SensorBuffer>(),
    globalFrameCounter: 0,
    bundle: createInitialBundleMeta(),

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

    setSensorVisible: (sensorKey, visible) => {
      const buf = get().sensors.get(sensorKey);
      if (!buf) return;
      buf.isVisible = visible;
      set({ globalFrameCounter: get().globalFrameCounter + 1 });
    },

    setSensorTransformAxis: (sensorKey, group, axis, value) => {
      const buf = get().sensors.get(sensorKey);
      if (!buf) return;
      if (!Number.isFinite(value)) return;
      buf.transform[group][axis] = value;
      buf.transformRevision += 1;
      set({ globalFrameCounter: get().globalFrameCounter + 1 });
    },

    resetSensorTransform: (sensorKey) => {
      const buf = get().sensors.get(sensorKey);
      if (!buf) return;
      buf.transform = createDefaultTransform();
      buf.transformRevision += 1;
      set({ globalFrameCounter: get().globalFrameCounter + 1 });
    },
  };
});

/** 비-React 컨텍스트에서 SensorBuffer 를 직접 읽기 위한 헬퍼 */
export function getSensorBuffer(sensorKey: string): SensorBuffer | undefined {
  return usePointCloudStreamStore.getState().sensors.get(sensorKey);
}
