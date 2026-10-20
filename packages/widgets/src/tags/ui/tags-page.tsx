import { useState } from 'react';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import { RealtimeTagsView } from './realtime-tags-view';
import { TagsTabs, type TagsTab } from './tags-tabs';
import { VirtualTagsPage } from './virtual-tags-page';

/**
 * 태그 페이지 — 실시간 태그(서버 스냅샷) | 가상 태그 두 탭.
 *
 * - 실시간 탭은 보일 때만 마운트한다. 마운트가 곧 STOMP 구독이라 다른 탭에
 *   있는 동안은 소켓을 잡지 않는다. 경로 `tags/{craneId}` 는 실시간 상세다.
 * - 가상 태그 탭은 항상 마운트해 두고 숨긴다. 그 페이지의 편집본은 전역
 *   스토어에 있고 언마운트가 미저장 편집을 버리므로, 탭을 오가는 것만으로
 *   편집이 사라지면 안 된다. 미저장 이탈 경고도 그 페이지가 그대로 맡는다.
 */
export function TagsPage({
  craneId,
  basePath,
}: {
  /** `tags/{craneId}` 의 크레인. 목록이면 null. */
  craneId: string | null;
  /** 이 페이지의 라우터 경로(`/outdoor-work/{regionId}/tags`). 상세 진입·복귀에 쓴다. */
  basePath: string;
}) {
  const navigate = useProgressNavigate();
  const [tab, setTab] = useState<TagsTab>('realtime');
  const activeTab: TagsTab = craneId ? 'realtime' : tab;

  const handleTabChange = (next: TagsTab) => {
    setTab(next);
    if (next === 'virtual' && craneId) navigate(basePath);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TagsTabs value={activeTab} onChange={handleTabChange} />
      {activeTab === 'realtime' ? (
        <div className="min-h-0 flex-1">
          <RealtimeTagsView craneId={craneId} basePath={basePath} />
        </div>
      ) : null}
      <div className="min-h-0 flex-1" hidden={activeTab !== 'virtual'}>
        <VirtualTagsPage />
      </div>
    </div>
  );
}
