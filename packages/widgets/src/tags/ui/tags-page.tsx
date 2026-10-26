import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import {
  realtimeTagsPath,
  virtualTagsPath,
  type TagsRouteMatch,
  type TagsTab,
} from '../lib/tags-route';
import { RealtimeTagsView } from './realtime-tags-view';
import { TagsTabs } from './tags-tabs';
import { VirtualTagsView } from './virtual-tags-view';

/**
 * 태그 페이지 — 실시간 태그(서버 스냅샷) | 가상 태그 두 탭. 탭 선택과 상세는
 * URL 이 든다(`lib/tags-route.ts`) — 새로 고침·뒤로 가기가 유지된다.
 *
 * - 실시간 탭은 보일 때만 마운트한다. 마운트가 곧 STOMP 구독이라 다른 탭에
 *   있는 동안은 소켓을 잡지 않는다. 경로 `tags/{craneId}` 는 실시간 상세다.
 * - 가상 태그 탭은 항상 마운트해 두고 숨긴다. 그 화면의 편집본은 전역
 *   스토어에 있고 언마운트가 미저장 편집을 버리므로, 탭을 오가는 것만으로
 *   편집이 사라지면 안 된다. 미저장 이탈 경고도 그 화면이 그대로 맡는다.
 */
export function TagsPage({
  route,
  basePath,
}: {
  route: TagsRouteMatch;
  /** 이 페이지의 라우터 경로(`/outdoor-work/{regionId}/tags`). 상세 진입·복귀에 쓴다. */
  basePath: string;
}) {
  const navigate = useProgressNavigate();

  const handleTabChange = (next: TagsTab) => {
    if (next === route.tab) return;
    navigate(
      next === 'virtual'
        ? virtualTagsPath(basePath)
        : realtimeTagsPath(basePath),
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TagsTabs value={route.tab} onChange={handleTabChange} />
      {route.tab === 'realtime' ? (
        <div className="min-h-0 flex-1">
          <RealtimeTagsView craneId={route.craneId} basePath={basePath} />
        </div>
      ) : null}
      <div className="min-h-0 flex-1" hidden={route.tab !== 'virtual'}>
        <VirtualTagsView equipmentId={route.equipmentId} basePath={basePath} />
      </div>
    </div>
  );
}
