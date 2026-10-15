/**
 * 실시간 수신 계측 — 부하 테스트에서 "프론트가 어디서 무너지는가" 를 숫자로
 * 보기 위한 카운터. 메시지마다 정수 증가만 하므로 운영에서도 켜 두는 비용은
 * 무시할 수 있다.
 *
 * 읽는 법(브라우저 콘솔, dev 빌드):
 *   __craneRealtimeStats()            — 누적 + 최근 1초 비율 스냅샷
 *   localStorage['crane:realtime-stats'] = '1'  — 5초마다 콘솔에 표로 출력
 *
 * 의미:
 *   received/s   WebSocket 메시지(프레임) 수. batch 형식이면 프레임 1 = 태그 N.
 *   tags/s       타입 가드를 통과해 버퍼에 들어간 태그 수.
 *   rejected/s   가드에 걸리거나 숫자로 못 바꿔 버린 수.
 *   bufferMax    프레임 사이에 버퍼가 가장 깊었던 값. 계속 커지면 렌더 루프가
 *                수신을 못 따라간다(useFrame 이 멈춘 백그라운드 탭 포함).
 *   drain/frame  useFrame 한 번에 버스로 내보낸 평균·최대 건수.
 *   fps          runner 의 useFrame 호출 빈도(거버너 상한의 영향을 받는다).
 *   longTasks/s  50ms 넘는 메인 스레드 작업 수(PerformanceObserver).
 */

interface Counters {
  received: number;
  tags: number;
  rejected: number;
  frames: number;
  drained: number;
  maxDrain: number;
  bufferMax: number;
  longTasks: number;
  handlerMs: number;
}

export interface RealtimeIngestStatsSnapshot {
  uptimeS: number;
  receivedPerS: number;
  tagsPerS: number;
  rejectedPerS: number;
  fps: number;
  drainAvg: number;
  drainMax: number;
  bufferMax: number;
  longTasksPerS: number;
  handlerMsPerS: number;
  totalReceived: number;
  totalTags: number;
  totalRejected: number;
}

let total: Counters = zero();
let window: Counters = zero();
let windowStartedAt = 0;
let startedAt = 0;
let lastSnapshot: RealtimeIngestStatsSnapshot | null = null;
let observer: PerformanceObserver | null = null;
let logTimer: ReturnType<typeof setInterval> | null = null;

function zero(): Counters {
  return {
    received: 0,
    tags: 0,
    rejected: 0,
    frames: 0,
    drained: 0,
    maxDrain: 0,
    bufferMax: 0,
    longTasks: 0,
    handlerMs: 0,
  };
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** 메시지(프레임) 1건 처리 결과. `handlerMs` 는 브리지 핸들러 안의 시간. */
export function recordRealtimeMessage(
  tags: number,
  rejected: number,
  handlerMs: number,
): void {
  total.received += 1;
  total.tags += tags;
  total.rejected += rejected;
  total.handlerMs += handlerMs;
  window.received += 1;
  window.tags += tags;
  window.rejected += rejected;
  window.handlerMs += handlerMs;
}

/** runner 의 useFrame 1회 — drain 직전 버퍼 깊이와 내보낸 수. */
export function recordRealtimeDrain(
  bufferDepth: number,
  drained: number,
): void {
  total.frames += 1;
  total.drained += drained;
  if (drained > total.maxDrain) total.maxDrain = drained;
  if (bufferDepth > total.bufferMax) total.bufferMax = bufferDepth;
  window.frames += 1;
  window.drained += drained;
  if (drained > window.maxDrain) window.maxDrain = drained;
  if (bufferDepth > window.bufferMax) window.bufferMax = bufferDepth;
}

function rollWindow(): RealtimeIngestStatsSnapshot {
  const t = now();
  const dt = Math.max(0.001, (t - windowStartedAt) / 1000);
  const w = window;
  const snap: RealtimeIngestStatsSnapshot = {
    uptimeS: Math.round((t - startedAt) / 1000),
    receivedPerS: Math.round(w.received / dt),
    tagsPerS: Math.round(w.tags / dt),
    rejectedPerS: Math.round(w.rejected / dt),
    fps: Math.round(w.frames / dt),
    drainAvg: w.frames ? Math.round(w.drained / w.frames) : 0,
    drainMax: w.maxDrain,
    bufferMax: w.bufferMax,
    longTasksPerS: Math.round((w.longTasks / dt) * 10) / 10,
    handlerMsPerS: Math.round(w.handlerMs / dt),
    totalReceived: total.received,
    totalTags: total.tags,
    totalRejected: total.rejected,
  };
  window = zero();
  windowStartedAt = t;
  lastSnapshot = snap;
  return snap;
}

/** 최근 1초 창을 닫고 스냅샷을 돌려준다. 1초 안에 다시 부르면 직전 값. */
export function getRealtimeIngestStats(): RealtimeIngestStatsSnapshot {
  if (lastSnapshot && now() - windowStartedAt < 1000) return lastSnapshot;
  return rollWindow();
}

function isLoggingEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem('crane:realtime-stats') === '1';
  } catch {
    return false;
  }
}

/**
 * 브리지가 켜질 때 호출. 롱태스크 관찰·콘솔 로그·전역 getter 를 건다.
 * 반환값으로 해제한다.
 */
export function startRealtimeIngestStats(): () => void {
  startedAt = now();
  windowStartedAt = startedAt;
  total = zero();
  window = zero();
  lastSnapshot = null;

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      observer = new PerformanceObserver((list) => {
        const n = list.getEntries().length;
        total.longTasks += n;
        window.longTasks += n;
      });
      observer.observe({ type: 'longtask', buffered: false });
    } catch {
      observer = null;
    }
  }

  const g = globalThis as unknown as Record<string, unknown>;
  if (import.meta.env.DEV) g.__craneRealtimeStats = getRealtimeIngestStats;

  if (isLoggingEnabled()) {
    logTimer = setInterval(() => {
      const s = rollWindow();
      console.info(
        `[realtime] ${s.uptimeS}s recv/s=${s.receivedPerS} tags/s=${s.tagsPerS} rej/s=${s.rejectedPerS} ` +
          `fps=${s.fps} drain avg/max=${s.drainAvg}/${s.drainMax} bufferMax=${s.bufferMax} ` +
          `longTasks/s=${s.longTasksPerS} handlerMs/s=${s.handlerMsPerS}`,
      );
    }, 5000);
  }

  return () => {
    observer?.disconnect();
    observer = null;
    if (logTimer) clearInterval(logTimer);
    logTimer = null;
    if (import.meta.env.DEV) delete g.__craneRealtimeStats;
  };
}
