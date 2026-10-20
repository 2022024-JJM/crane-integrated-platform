function pad(value: number, width: number) {
  return String(value).padStart(width, '0');
}

/**
 * 벽시계 표시 — `HH:MM:SS.mmm`(로컬 시간대). 카드·상세의 수신 시각, 태그
 * 데이터 시각에 쓴다. 날짜는 뺀다(같은 날 안에서 비교하는 값).
 */
export function formatClock(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  const date = new Date(ms);
  return `${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}.${pad(date.getMilliseconds(), 3)}`;
}

/**
 * 경과 시간 표시 재료 — 10초 미만은 소수 한 자리, 1분 미만은 정수 초, 그
 * 위는 분·초. 문구(“n초 전”)는 i18n 이 만들고 여기서는 값만 낸다.
 */
export type AgeLabel =
  | { unit: 'seconds'; value: string }
  | { unit: 'minutes'; minutes: number; seconds: number };

export function resolveAge(ageMs: number): AgeLabel {
  const ms = Number.isFinite(ageMs) ? Math.max(0, ageMs) : 0;
  if (ms < 10_000) return { unit: 'seconds', value: (ms / 1000).toFixed(1) };
  if (ms < 60_000) {
    return { unit: 'seconds', value: String(Math.floor(ms / 1000)) };
  }
  return {
    unit: 'minutes',
    minutes: Math.floor(ms / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
  };
}

/**
 * 숫자 값 표시 — 계측값(무게·거리)만 천 단위 구분. 시각(year 2026)·상태
 * 비트는 구분 없이 그대로. 유한하지 않은 값은 문자열 그대로.
 */
export function formatTagNumber(value: number, grouped = true): string {
  if (!Number.isFinite(value)) return String(value);
  return grouped ? value.toLocaleString('en-US') : String(value);
}
