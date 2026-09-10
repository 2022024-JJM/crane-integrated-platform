/**
 * 장비 라이브 태그 값의 표시 판정 — ui 에 수치 계산을 두지 않기 위한 분리.
 * 값은 tagLiveValues(태그 값 버스 캐시)를 폴링으로 읽으며, 러너가 멈추면
 * `at` 이 더는 갱신되지 않아 stale 로 넘어간다.
 */

export const TAG_STALE_MS = 2000;

export interface TagDisplay {
  /** 표시 문자열. 값이 아직 없으면 null. */
  text: string | null;
  /** 값이 없거나 TAG_STALE_MS 보다 오래됨 — "정지" 배지 대상. */
  stale: boolean;
}

export function formatTagNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return (Math.round(value * 10) / 10).toLocaleString();
}

export function toTagDisplay(
  live: { value: number; at: number } | undefined,
  now: number,
): TagDisplay {
  if (!live) return { text: null, stale: true };
  return {
    text: formatTagNumber(live.value),
    stale: now - live.at > TAG_STALE_MS,
  };
}

/**
 * 범위 바의 채움 비율 [0,1]. 범위 정의가 없거나 퇴화(max<=min)·값 없음이면
 * null — 바를 그리지 않는다.
 */
export function tagRangeRatio(
  value: number | undefined,
  min: number | null,
  max: number | null,
): number | null {
  if (
    value === undefined ||
    !Number.isFinite(value) ||
    min === null ||
    max === null ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    max <= min
  ) {
    return null;
  }
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
