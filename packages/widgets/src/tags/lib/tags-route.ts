const ROOT = 'tags';

export interface TagsRouteMatch {
  /** `tags/{craneId}` 의 craneId. 목록이면 null. */
  craneId: string | null;
}

/**
 * 작업 화면 서브라우트(`useParams` 의 `*`)가 태그 페이지인지 — `tags` 는
 * 목록, `tags/{craneId}` 는 실시간 상세. 그 밖의 깊이는 태그 페이지가 아니다.
 * 뒤 슬래시는 무시한다.
 */
export function matchTagsSubRoute(
  subRoute: string | undefined,
): TagsRouteMatch | null {
  if (!subRoute) return null;
  const segments = subRoute.replace(/\/+$/, '').split('/');
  if (segments[0] !== ROOT) return null;
  if (segments.length === 1) return { craneId: null };
  if (segments.length === 2 && segments[1]) {
    return { craneId: decodeURIComponent(segments[1]) };
  }
  return null;
}
