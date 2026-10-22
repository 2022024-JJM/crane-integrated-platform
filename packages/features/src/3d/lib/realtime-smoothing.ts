/**
 * 실시간 값의 화면 스무딩 시간 — 키별 **값이 바뀐 간격**에 맞춘다.
 *
 * 서버 값을 소비자 기본 스무딩(0.35초)으로 내보내면 1초마다 바뀌는 값은
 * 0.35초 만에 목표에 닿고 다음 값까지 서 있어 "휙 돌고 멈춤" 이 반복된다.
 * 가상 태그 러너가 publish 간격을 스무딩 시간으로 넘기는 것과 같은 규칙을
 * 실시간에도 쓴다 — 직전 변화와의 간격만큼 스무딩하면 다음 값이 올 때까지
 * 계속 움직여 1Hz 수신이 연속 운동으로 보인다. 화면 지연은 한 수신 간격이다.
 *
 * 간격은 publish 가 아니라 **값의 변화** 사이로 잰다. 크레인 스냅샷 브리지는
 * 스냅샷이 바뀐 크레인의 태그 전부를 다시 밀고(heartbeat·초 카운터 때문에
 * 살아 있는 크레인은 매초, 실물은 250ms 묶음마다 바뀔 수 있다) 그래서 publish
 * 간격은 묶음 주기로 수렴해 그 태그의 실제 변화 주기를 말해 주지 않는다.
 *
 * 바뀌지 않은 재발행은 그 키의 **마지막 스무딩 시간을 그대로** 돌려준다. 값
 * 저장소의 set 은 같은 target 이 와도 smoothTime 을 덮어쓰므로 기본값으로
 * 넘기면 진행 중인 1초 스무딩이 다음 묶음에서 0.35초로 잘린다.
 */

/** 스무딩 하한(초) — 이보다 촘촘한 변화는 값 자체가 연속이라 짧게. */
export const REALTIME_SMOOTH_MIN_S = 0.1;
/**
 * 스무딩 상한(초) — 오래 멈춰 있던 뒤 첫 변화(보류 해제·정지 후 재출발)는
 * 공백을 스무딩 시간으로 쓰면 수 초를 미끄러진다. 2초 넘게 비었으면 그 뒤
 * 값은 2초 안에 따라잡고, 다음 변화부터 실제 간격으로 돌아온다.
 */
export const REALTIME_SMOOTH_MAX_S = 2;

/**
 * 변화 간격(ms) → 스무딩 시간(초). 간격을 모르면(첫 값) undefined = 소비자 기본.
 * 비유한도 기본. 0·음수는 같은 프레임 안의 연속 변화라 하한.
 */
export function resolveRealtimeSmoothTime(
  intervalMs: number | undefined,
): number | undefined {
  if (intervalMs === undefined || !Number.isFinite(intervalMs)) {
    return undefined;
  }
  const seconds = Math.max(0, intervalMs) / 1000;
  return Math.min(
    REALTIME_SMOOTH_MAX_S,
    Math.max(REALTIME_SMOOTH_MIN_S, seconds),
  );
}

interface CadenceEntry {
  value: number;
  /** 값이 직전과 달라진 마지막 시각(ms, 호출자가 넘긴 시계 기준). */
  changedAt: number;
  /** 마지막 변화에 쓴 스무딩 시간 — 같은 값의 재발행이 이어받는다. */
  smoothTime: number | undefined;
}

export interface RealtimeCadenceTracker {
  /**
   * 값을 관찰하고 이번 publish 에 쓸 스무딩 시간(초)을 돌려준다.
   * undefined = 소비자 기본(첫 값, 또는 첫 값의 재발행).
   */
  observe(key: string, value: number, nowMs: number): number | undefined;
  /** 시작·정지 때 비운다 — 이전 세션의 간격이 새 세션 첫 변화에 섞이지 않게. */
  clear(): void;
  /** 관찰 중인 키 수(테스트·진단용). */
  readonly size: number;
}

/**
 * 키별 변화 간격 추적기. 러너가 한 프레임에 `performance.now()` 를 한 번 읽어
 * 넘긴다. React·three 의존이 없어 단독으로 테스트한다.
 */
export function createRealtimeCadenceTracker(): RealtimeCadenceTracker {
  const entries = new Map<string, CadenceEntry>();
  return {
    observe(key, value, nowMs) {
      const entry = entries.get(key);
      if (!entry) {
        entries.set(key, { value, changedAt: nowMs, smoothTime: undefined });
        return undefined;
      }
      if (entry.value === value) return entry.smoothTime;
      const smoothTime = resolveRealtimeSmoothTime(nowMs - entry.changedAt);
      entry.value = value;
      entry.changedAt = nowMs;
      entry.smoothTime = smoothTime;
      return smoothTime;
    },
    clear() {
      entries.clear();
    },
    get size() {
      return entries.size;
    },
  };
}
