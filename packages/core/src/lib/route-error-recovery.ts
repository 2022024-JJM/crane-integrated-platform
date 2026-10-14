/**
 * 라우트 에러 바운더리의 자동 복구 판정 — 순수 함수(테스트 대상).
 *
 * 24시간 무인 관제에서 에러 화면이 뜨면 사람이 "다시 시도" 를 누를 때까지
 * 멈춘다. 그래서 바운더리는 지수 백오프로 스스로 리셋하고, 재배포 뒤 청크
 * 해시가 바뀌어 동적 import 가 실패한 경우는 리셋으로 복구되지 않으므로
 * 페이지를 새로 고친다.
 */

/** 자동 리셋 1회차 지연(ms). 2배씩 늘어 AUTO_RESET_MAX_MS 에서 멈춘다. */
export const AUTO_RESET_BASE_MS = 2_000;
export const AUTO_RESET_MAX_MS = 60_000;
/** 청크 로드 실패로 새로 고치는 최소 간격(ms) — 새로 고침 폭주 방지. */
export const CHUNK_RELOAD_MIN_INTERVAL_MS = 60_000;
export const CHUNK_RELOAD_STAMP_KEY = 'crane:chunk-reload-at';

/** n번째(1부터) 자동 리셋까지 기다릴 시간. */
export function autoResetDelayMs(attempt: number): number {
  const n = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 1;
  return Math.min(AUTO_RESET_MAX_MS, AUTO_RESET_BASE_MS * 2 ** (n - 1));
}

const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /loading (css )?chunk [\w-]+ failed/i,
  /error loading dynamically imported module/i,
];

/** 동적 import(청크) 로드 실패인지 — 재배포 뒤 옛 index.html 이 새 해시를 못 찾는 경우. */
export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * 지금 새로 고쳐도 되는지 — 마지막 새로 고침 시각(스토리지)이 최소 간격보다
 * 오래됐으면 true 이고 그 시각을 갱신한다. 스토리지가 없으면 항상 true.
 */
export function claimChunkReload(
  now: number,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
): boolean {
  if (!storage) return true;
  try {
    const raw = storage.getItem(CHUNK_RELOAD_STAMP_KEY);
    const last = raw === null ? Number.NEGATIVE_INFINITY : Number(raw);
    if (Number.isFinite(last) && now - last < CHUNK_RELOAD_MIN_INTERVAL_MS) {
      return false;
    }
    storage.setItem(CHUNK_RELOAD_STAMP_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}
