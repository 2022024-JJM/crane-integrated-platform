/**
 * 알람 사전 로드 재시도 지연 — 5초부터 2배씩, 상한 60초, 횟수 제한 없음.
 * 백엔드가 늦게 떠도 페이지 수명 안에 알람 이름이 채워진다(예전 3회·15초는
 * 재기동 중 진입하면 영영 비었다). ui/runtime-alarm-dictionary-preload.tsx 가 쓴다.
 */
export const RETRY_BASE_MS = 5_000;
export const RETRY_MAX_MS = 60_000;

export function retryDelayMs(attempt: number): number {
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1));
}
