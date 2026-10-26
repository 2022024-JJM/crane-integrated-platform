/**
 * 복제 다이얼로그의 태그 체크 상태 — `null` 은 "전부 선택"(기본값)이다.
 * 크레인을 바꾸면 null 로 돌아가 새 크레인의 태그가 전부 선택된다.
 */

/** 실제 선택 집합 — null 이면 전부. */
export function resolveSelectedCodes(
  selected: ReadonlySet<string> | null,
  all: readonly string[],
): Set<string> {
  return selected === null ? new Set(all) : new Set(selected);
}

/** 코드 하나를 토글한 새 집합. */
export function toggleSelectedCode(
  selected: ReadonlySet<string> | null,
  all: readonly string[],
  code: string,
): Set<string> {
  const next = resolveSelectedCodes(selected, all);
  if (next.has(code)) next.delete(code);
  else next.add(code);
  return next;
}

/** 여러 코드를 한 번에 켜거나 끈 새 집합(묶음 머리글·전체 선택). */
export function setSelectedCodes(
  selected: ReadonlySet<string> | null,
  all: readonly string[],
  codes: readonly string[],
  on: boolean,
): Set<string> {
  const next = resolveSelectedCodes(selected, all);
  for (const code of codes) {
    if (on) next.add(code);
    else next.delete(code);
  }
  return next;
}

/** 묶음의 체크 상태 — 전부 · 일부 · 없음. */
export function groupSelectionState(
  selected: ReadonlySet<string>,
  codes: readonly string[],
): 'all' | 'some' | 'none' {
  let count = 0;
  for (const code of codes) if (selected.has(code)) count += 1;
  if (count === 0) return 'none';
  return count === codes.length ? 'all' : 'some';
}
