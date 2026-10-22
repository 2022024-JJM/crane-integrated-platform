/**
 * 상태 전이 시각 추적 — 키마다 "지금 값이 된 시각" 을 든다. 관제 HUD 알람
 * 목록이 고장·통신두절·Bypass 가 몇 분째인지 보이는 재료다. 운전 상태 기록
 * (model-runtime-status.ts)에는 전이 시각이 없어 1Hz 판정 루프가 상태 기록과
 * 같은 tick 에서 이걸 굴린다(model/use-model-runtime-statuses.ts).
 *
 * 규칙: 새 키는 `now`, 값이 그대로면 이전 시각 유지, 값이 바뀌면 `now` 로
 * 리셋, 이번 값에 없는 키는 지운다. 바뀐 것이 없으면 이전 기록의 참조를
 * 돌려준다 — 소비자가 참조로 변화를 가린다.
 */
export type SinceRecord = Readonly<Record<string, number>>;

export const EMPTY_SINCE: SinceRecord = Object.freeze({});

export interface StatusSinceRecords {
  /** 모델 id → 지금 운전 상태가 된 시각(ms). */
  tone: SinceRecord;
  /** 모델 id → Bypass 가 켜진 시각(ms). 꺼진 모델은 없다. */
  bypass: SinceRecord;
}

export const EMPTY_STATUS_SINCE: StatusSinceRecords = Object.freeze({
  tone: EMPTY_SINCE,
  bypass: EMPTY_SINCE,
});

export function trackSince(
  prev: SinceRecord,
  prevValues: Readonly<Record<string, string>>,
  values: Readonly<Record<string, string>>,
  now: number,
): SinceRecord {
  const next: Record<string, number> = {};
  let changed = false;
  for (const [key, value] of Object.entries(values)) {
    const before = prev[key];
    if (before !== undefined && prevValues[key] === value) {
      next[key] = before;
    } else {
      next[key] = now;
      changed = true;
    }
  }
  if (!changed && Object.keys(prev).length === Object.keys(next).length) {
    return prev;
  }
  return next;
}

/** 라벨 기록에서 Bypass 가 켜진 모델만 — `trackSince` 의 값 기록 모양. */
export function bypassOnRecord(
  labels: Readonly<Record<string, { bypass: boolean }>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, state] of Object.entries(labels)) {
    if (state.bypass) out[id] = 'on';
  }
  return out;
}
