const ROOT = 'tags';

/** 가상 태그 탭의 두 번째 세그먼트 — 실시간 크레인 ID 와 이 글자는 겹치지 않는다고 본다. */
export const VIRTUAL_TAGS_SEGMENT = 'virtual';

export type TagsTab = 'realtime' | 'virtual';

export interface TagsRouteMatch {
  tab: TagsTab;
  /** `tags/{craneId}` 의 craneId. 실시간 목록·가상 탭이면 null. */
  craneId: string | null;
  /** `tags/virtual/{equipmentId}` 의 장비 id. 가상 목록·실시간 탭이면 null. */
  equipmentId: string | null;
}

/**
 * 작업 화면 서브라우트(`useParams` 의 `*`)가 태그 페이지인지 — `tags` 는
 * 실시간 목록, `tags/{craneId}` 는 실시간 상세, `tags/virtual` 은 가상 장비
 * 목록, `tags/virtual/{equipmentId}` 는 가상 장비 상세. 그 밖의 깊이는 태그
 * 페이지가 아니다. 뒤 슬래시는 무시한다.
 */
export function matchTagsSubRoute(
  subRoute: string | undefined,
): TagsRouteMatch | null {
  if (!subRoute) return null;
  const segments = subRoute.replace(/\/+$/, '').split('/');
  if (segments[0] !== ROOT) return null;
  if (segments.length === 1) {
    return { tab: 'realtime', craneId: null, equipmentId: null };
  }
  if (segments[1] === VIRTUAL_TAGS_SEGMENT) {
    if (segments.length === 2) {
      return { tab: 'virtual', craneId: null, equipmentId: null };
    }
    if (segments.length === 3 && segments[2]) {
      return {
        tab: 'virtual',
        craneId: null,
        equipmentId: decodeURIComponent(segments[2]),
      };
    }
    return null;
  }
  if (segments.length === 2 && segments[1]) {
    return {
      tab: 'realtime',
      craneId: decodeURIComponent(segments[1]),
      equipmentId: null,
    };
  }
  return null;
}

/** 실시간 목록(`basePath`) 또는 상세. */
export function realtimeTagsPath(basePath: string, craneId?: string): string {
  return craneId ? `${basePath}/${encodeURIComponent(craneId)}` : basePath;
}

/** 가상 장비 목록 또는 상세. */
export function virtualTagsPath(
  basePath: string,
  equipmentId?: string,
): string {
  const root = `${basePath}/${VIRTUAL_TAGS_SEGMENT}`;
  return equipmentId ? `${root}/${encodeURIComponent(equipmentId)}` : root;
}
