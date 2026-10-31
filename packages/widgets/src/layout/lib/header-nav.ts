import type { NavItem, NavSubItem } from '@crane/core/types/navigation';

/**
 * 사이드바 대신 헤더 가로 메뉴를 쓰는 계정인가.
 *
 * Indoorshop.OT 만 — 원본 내업 대시보드가 사이드바를 걷고 헤더 가로 메뉴로 옮겼다.
 * 휴대폰 폭(md) 미만에서만 사이드바 드로어가 같은 항목을 낸다 — 브라우저를 확대해
 * 폭이 줄어도 md 이상이면 헤더 메뉴를 유지한다.
 */
export function usesHeaderNav(role: string | undefined): boolean {
  return role === 'indoorshop-ot';
}

/**
 * 항목을 정확히 일치할 때만 켤 것인가.
 *
 * 다른 항목 경로의 접두가 되는 항목(예: `/indoorshop` 대시보드)은 하위 화면에서까지
 * 켜지면 두 항목이 함께 강조된다.
 */
export function needsExactMatch(item: NavItem, items: NavItem[]): boolean {
  if (item.end || item.path === '/') return true;
  return items.some(
    (other) => other !== item && other.path.startsWith(`${item.path}/`),
  );
}

function splitPath(path: string): { pathname: string; query: string } {
  const at = path.indexOf('?');
  return at < 0
    ? { pathname: path, query: '' }
    : { pathname: path.slice(0, at), query: path.slice(at + 1) };
}

/**
 * 지금 보고 있는 갈래 — 항목 화면 밖이면 `null`.
 *
 * 원본 드롭다운과 같은 규칙: 주소에 갈래 쿼리가 없으면 첫 갈래(현황)를 보고 있는 것이다.
 */
export function activeSubItem(
  children: NavSubItem[],
  pathname: string,
  search: string,
): NavSubItem | null {
  if (children.length === 0) return null;
  const base = splitPath(children[0].path).pathname;
  const onItem = pathname === base || pathname.startsWith(`${base}/`);
  if (!onItem) return null;
  const params = new URLSearchParams(search);
  return (
    children.find((child) => {
      const query = new URLSearchParams(splitPath(child.path).query);
      return [...query].every(([key, value]) => params.get(key) === value);
    }) ?? children[0]
  );
}
