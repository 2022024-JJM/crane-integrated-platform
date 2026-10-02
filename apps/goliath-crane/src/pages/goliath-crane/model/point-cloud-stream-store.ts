// LiDAR Edge Node Bridge Server 의 ProcessedPointCloudBundle WebSocket 스트림을
// 단일 연결로 받고, 비전 그리드(LiDAR 1/2/Fusion 3개 타일) + PiP 등 다수
// 구독자에게 fan-out 한다. 서버 vendor (SOSLAB/OUSTER/SICK 등) 와 무관하게
// 동일한 포맷이므로 본 store 는 vendor 중립이다.
//
// React 상태 변경은 status/lastError/refCount 같은 메타에만 발생시키고,
// 실제 포인트 데이터는 sensors Map 의 SensorBuffer 객체를 in-place 로 갱신한 뒤
// globalFrameCounter 만 증가시킨다. 구독자(<SensorPoints>)는 useFrame 안에서
// 카운터 변화를 감지해 BufferAttribute 를 갱신한다 — 매 메시지마다 React
// 리렌더가 일어나지 않게 하기 위함이다 (use-realtime-store.ts 와 동일 패턴).
//
// 또한 점 좌표 buffer 는 sensor 별로 1개씩 pool 에 보관하고 parser 가 그 안에
// in-place 로 기록한다 (A1 — GC churn 회피).

import { create } from 'zustand';
import { getPointCloudWebSocketUrl } from '@crane/core/config/network';
import { decodeBundle } from '../lib/point-cloud/proto-decoder';
import {
  createParseFrameBuffers,
  parseFrame,
  type ParseFrameBuffers,
  type ParsedFrame,
} from '../lib/point-cloud/point-cloud-parser';
import {
  MAX_POINTS_PER_SENSOR,
  RECONNECT_BACKOFF_MS,
  SENSOR_COLORS,
} from '../lib/point-cloud/config';
import { LIDAR_BY_STORE_KEY } from '../ui/vision/types';

export type PointCloudSensorMode = 'lidar1' | 'lidar2' | 'fusion';

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
  /** 서버가 보낸 원본 sensor_name (vendor 의존 — 예: 'SOSLAB1', 'OUSTER1') */
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
  /** key = normalizeSensorKey(frame.sensor_name) 결과. LIDAR_BY_STORE_KEY 와 동일 키 공간. */
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

// 첫 bundle 이 sequence 를 누락했을 때 1회만 경고하기 위한 플래그.
let sequenceMissingWarned = false;

/**
 * 센서 별 parser pool buffer. 한 번 할당 후 매 프레임 재사용 — 점 60K × 2 sensor
 * × 30Hz 기준 매초 ~14MB GC churn 을 없앤다.
 */
const parseBufferPool = new Map<string, ParseFrameBuffers>();

function getParseBuffers(sensorKey: string): ParseFrameBuffers {
  let buf = parseBufferPool.get(sensorKey);
  if (!buf) {
    buf = createParseFrameBuffers(MAX_POINTS_PER_SENSOR);
    parseBufferPool.set(sensorKey, buf);
  }
  return buf;
}

function normalizeSensorKey(rawName: string): string {
  return rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickColorForKey(key: string, sensorIndex: number): string {
  // 알려진 채널은 LIDAR_CHANNELS 에 정의된 colorHex 를 사용 (SSOT).
  // 그 외 vendor 가 새 센서를 보내면 SENSOR_COLORS 팔레트의 index 기반 fallback.
  const known = LIDAR_BY_STORE_KEY[key];
  if (known) return known.colorHex;
  return SENSOR_COLORS[sensorIndex % SENSOR_COLORS.length];
}

/** ±20% jitter 를 더해 thundering herd 를 회피. */
function withJitter(delayMs: number): number {
  return Math.round(delayMs * (1 + (Math.random() - 0.5) * 0.4));
}

export const usePointCloudStreamStore = create<PointCloudStreamState>()(
  (set, get) => {
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
      const delay = withJitter(reconnectDelayMs);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (get().refCount > 0) connect();
      }, delay);
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

          // 서버가 sequence 를 보내지 않는 경우 1회만 경고. (C4)
          if (bundle.sequence_missing && !sequenceMissingWarned) {
            sequenceMissingWarned = true;
            console.warn(
              '[point-cloud] Bundle sequence is missing — drop-gap detection disabled.',
            );
          }

          let totalRendered = 0;
          for (const frame of bundle.frames) {
            const rawName = frame.sensor_name || 'unknown';
            const key = normalizeSensorKey(rawName) || `sensor${sensors.size}`;
            const buffers = getParseBuffers(key);
            const parsed = parseFrame(frame, buffers);

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
            !bundle.sequence_missing &&
            prevSequence !== null &&
            bundle.sequence > prevSequence + 1n
              ? bundle.sequence - prevSequence - 1n
              : 0n;

          // 메타 객체는 in-place 갱신 (리렌더 방지). globalFrameCounter +1 로
          // useFrame polling 측에 변경 알림. React 측에서 HUD 갱신을 원하면
          // 별도 interval tick 으로 강제 리렌더한다.
          bundleMeta.lastSequence = bundle.sequence_missing
            ? null
            : bundle.sequence;
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
        // onerror 자체는 상세를 주지 않는다. close code/reason 은 onclose 가 제공.
        set({ status: 'error', lastError: 'WebSocket transport error' });
      };

      ws.onclose = (event: CloseEvent) => {
        if (socket !== ws) return;
        socket = null;
        // 정상 종료 (1000) 외에는 진단을 위해 콘솔에도 남긴다.
        if (event.code !== 1000) {
          const reason = event.reason ? `: ${event.reason}` : '';
          const detail = `code=${event.code}${reason}`;
          console.warn(`[point-cloud] WebSocket closed (${detail})`);
          // 직전에 transport error 가 없었으면 close 의 detail 을 lastError 로.
          if (get().status !== 'error') {
            set({ lastError: `WebSocket closed (${detail})` });
          }
        }
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
      // pool buffer 는 다음 connect 에서도 재사용 가능 — 비우지 않는다.
      sequenceMissingWarned = false;
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
  },
);

/** 비-React 컨텍스트에서 SensorBuffer 를 직접 읽기 위한 헬퍼 */
export function getSensorBuffer(sensorKey: string): SensorBuffer | undefined {
  return usePointCloudStreamStore.getState().sensors.get(sensorKey);
}
