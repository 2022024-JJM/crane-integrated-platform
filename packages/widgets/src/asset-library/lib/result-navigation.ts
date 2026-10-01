import { getStorageJson, setStorageJson } from '@crane/core/lib/safe-storage';

/**
 * 결과 목록 위에서의 이동 — 미리보기의 이전/다음, Shift 범위 선택, 상세
 * 화면의 이전/다음 자산.
 */

/** 목록에서 `step` 만큼 옮긴 id. 끝에서 멈춘다(돌아가지 않는다). */
export function stepInList(
  ids: readonly string[],
  currentId: string | null,
  step: number,
): string | null {
  if (ids.length === 0) return null;
  const index = currentId === null ? -1 : ids.indexOf(currentId);
  // 목록에 없는 id 에서 출발하면 방향에 따라 첫/끝 항목.
  if (index < 0) return step >= 0 ? ids[0] : ids[ids.length - 1];
  const next = Math.min(ids.length - 1, Math.max(0, index + step));
  return ids[next];
}

/**
 * `anchorId` 부터 `targetId` 까지(양 끝 포함)의 id. 어느 한쪽이 목록에 없으면
 * 대상 하나만 돌려준다.
 */
export function rangeBetween(
  ids: readonly string[],
  anchorId: string | null,
  targetId: string,
): string[] {
  const target = ids.indexOf(targetId);
  if (target < 0) return [];
  const anchor = anchorId === null ? -1 : ids.indexOf(anchorId);
  if (anchor < 0) return [targetId];
  return ids.slice(Math.min(anchor, target), Math.max(anchor, target) + 1);
}

export interface ResultNeighbors {
  previousId: string | null;
  nextId: string | null;
  /** 1 부터. 목록에 없으면 0. */
  position: number;
  total: number;
}

export function findNeighbors(
  ids: readonly string[],
  currentId: string,
): ResultNeighbors {
  const index = ids.indexOf(currentId);
  if (index < 0) {
    return { previousId: null, nextId: null, position: 0, total: ids.length };
  }
  return {
    previousId: index > 0 ? ids[index - 1] : null,
    nextId: index < ids.length - 1 ? ids[index + 1] : null,
    position: index + 1,
    total: ids.length,
  };
}

/**
 * 목록이 마지막으로 보여 준 결과 순서. 상세 화면이 "이전/다음 자산" 과
 * "목록으로" 에 쓴다. 탭을 닫으면 사라지는 편의 정보라 sessionStorage 다.
 */
export const RESULT_ORDER_STORAGE_KEY = 'crane:asset-library:result-order';
/** 이보다 긴 목록은 앞부분만 기억한다(저장소 용량 방어). */
export const RESULT_ORDER_MAX = 2000;

export interface StoredResultOrder {
  ids: string[];
  /** 그 목록의 쿼리스트링(`?` 포함, 없으면 빈 문자열). */
  search: string;
}

export function writeResultOrder(ids: readonly string[], search: string): void {
  setStorageJson(
    RESULT_ORDER_STORAGE_KEY,
    { ids: ids.slice(0, RESULT_ORDER_MAX), search },
    'session',
  );
}

export function readResultOrder(): StoredResultOrder {
  const stored = getStorageJson<Partial<StoredResultOrder>>(
    RESULT_ORDER_STORAGE_KEY,
    'session',
  );
  const ids = Array.isArray(stored?.ids)
    ? stored.ids.filter((id): id is string => typeof id === 'string')
    : [];
  const search =
    typeof stored?.search === 'string' && stored.search.startsWith('?')
      ? stored.search
      : '';
  return { ids, search };
}
