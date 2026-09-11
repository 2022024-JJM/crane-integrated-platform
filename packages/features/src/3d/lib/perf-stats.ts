/**
 * dev 성능 HUD 의 순수 계산 — EMA·최근 1초 최악 프레임·표시 포맷터.
 *
 * "ui 에서 수치 계산 금지" 규칙(선례: scene-shadow.ts) 때문에 프레임 통계의
 * 수식과 문자열 포맷을 전부 여기로 뺐다. HUD(ui)는 formatPerfLine 결과를
 * 그대로 그리기만 하고, 프레임 기록의 glue 는 model/scene-perf-store.ts 가
 * 이 함수들을 호출한다. 타이머·DOM 에 기대지 않아 node 환경 테스트 대상이다.
 */

/** HUD 샘플 한 벌 — heapMB 는 Chrome 전용(performance.memory)이라 없으면 null. */
export interface ScenePerfSample {
  /** 직전 프레임의 드로우콜 수 (gl.info.render.calls — shadow pass 포함). */
  calls: number;
  /** 직전 프레임의 렌더 삼각형 수 (gl.info.render.triangles). */
  triangles: number;
  /** 프레임 dt 의 EMA(ms) — 순간값은 프레임마다 튀어 읽을 수 없다. */
  frameMs: number;
  /** 최근 1초 창 안의 최악(최대) 프레임 dt(ms) — 히치 감지용. */
  worstMs: number;
  heapMB: number | null;
}

/**
 * α=0.1 — 60fps 기준 약 0.5초에 새 값의 95% 를 반영한다. 더 크면 표시가
 * 프레임마다 떨리고, 더 작으면 히치 뒤 회복이 굼떠 보인다.
 */
export const PERF_EMA_ALPHA = 0.1;

/** 지수이동평균 한 스텝. prev 가 null(첫 샘플)이면 샘플을 그대로 시작값으로. */
export function updateEma(
  prev: number | null,
  sample: number,
  alpha: number = PERF_EMA_ALPHA,
): number {
  if (!Number.isFinite(sample)) return prev ?? 0;
  if (prev === null) return sample;
  return prev + alpha * (sample - prev);
}

export const WORST_FRAME_WINDOW_MS = 1000;

/**
 * 슬라이딩 창 최대값 추적기. EMA 는 한두 프레임짜리 히치(수십 ms)를 흡수해
 * 버리므로, "방금 걸렸다"는 최근 1초의 최악 프레임으로 따로 보여 준다.
 *
 * 단조 감소 덱(deque) — 새 샘플보다 작거나 같은 꼬리를 버리므로 선두가 항상
 * 창 안의 최대값이다. 시각(at)은 호출자가 넘긴다 — 내부에서 시계를 잡지
 * 않아야 테스트가 결정론적이다(타이머 금지 규칙).
 */
export interface WorstFrameTracker {
  push(at: number, ms: number): void;
  /** 창(at - windowMs, at] 안의 최대 ms. 샘플이 없으면 0. */
  worst(at: number): number;
}

export function createWorstFrameTracker(
  windowMs: number = WORST_FRAME_WINDOW_MS,
): WorstFrameTracker {
  const entries: { at: number; ms: number }[] = [];

  const expire = (at: number) => {
    while (entries.length > 0 && entries[0].at <= at - windowMs) {
      entries.shift();
    }
  };

  return {
    push(at, ms) {
      if (!Number.isFinite(at) || !Number.isFinite(ms)) return;
      while (entries.length > 0 && entries[entries.length - 1].ms <= ms) {
        entries.pop();
      }
      entries.push({ at, ms });
      expire(at);
    },
    worst(at) {
      expire(at);
      return entries.length > 0 ? entries[0].ms : 0;
    },
  };
}

/** 삼각형 수 표시 — 2502024 → "2.50M", 12345 → "12.3k", 987 → "987". */
export function formatTris(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

/** 프레임 시간 표시 — 16.66 → "16.7ms". */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0.0ms';
  return `${ms.toFixed(1)}ms`;
}

/**
 * HUD 한 줄 전체 — 예: "154 calls · 2.50M tris · 16.7ms 60fps (worst 41) · 512MB".
 * fps 는 프레임 거버너(frameloop demand)가 실제로 만든 빈도라 30fps 면
 * 거버너가 재생 주기로, 그 아래면 정지 화면(조작 프레임만)이다.
 * heap 을 못 읽는 브라우저(비 Chrome)에서는 뒤 칸을 통째로 생략한다.
 */
/** 프레임 dt(ms) → 초당 프레임. demand 루프에선 "실제로 그린 빈도" 다. */
export function formatFps(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0fps';
  return `${Math.round(1000 / ms)}fps`;
}

export function formatPerfLine(sample: ScenePerfSample): string {
  const worst =
    Number.isFinite(sample.worstMs) && sample.worstMs > 0
      ? Math.round(sample.worstMs)
      : 0;
  const base = `${sample.calls} calls · ${formatTris(sample.triangles)} tris · ${formatMs(sample.frameMs)} ${formatFps(sample.frameMs)} (worst ${worst})`;
  if (sample.heapMB === null || !Number.isFinite(sample.heapMB)) return base;
  return `${base} · ${Math.round(sample.heapMB)}MB`;
}
