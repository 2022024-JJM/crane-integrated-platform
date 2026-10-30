import type { CraneScope } from '@crane/domain/monitoring';
import type { TagsRouteMatch } from '../lib/tags-route';
import { RealtimeTagsView } from './realtime-tags-view';

/**
 * 태그 페이지 — 실시간 태그(서버 스냅샷). 상세는 URL 이 든다
 * (`lib/tags-route.ts`) — 새로 고침·뒤로 가기가 유지된다. 마운트가 곧 STOMP
 * 구독이다. 시뮬레이션(시나리오)은 3D 플레이 페이지의 시나리오 탭에 있다.
 */
export function TagsPage({
  scope,
  route,
  basePath,
}: {
  /** 이 화면의 서버 범위(`getCraneScopeByRegion`). null 이면 피드를 켜지 않는다. */
  scope: CraneScope | null;
  route: TagsRouteMatch;
  /** 이 페이지의 라우터 경로(`/outdoor-work/{regionId}/tags`). 상세 진입·복귀에 쓴다. */
  basePath: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <RealtimeTagsView
          scope={scope}
          craneId={route.craneId}
          basePath={basePath}
        />
      </div>
    </div>
  );
}
