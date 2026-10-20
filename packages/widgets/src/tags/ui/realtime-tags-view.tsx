import { useState } from 'react';
import {
  useCraneFeedConnection,
  useCraneSnapshotFeed,
  useCraneSnapshotStore,
} from '@crane/features/3d';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import { CraneDetail } from './crane-detail';
import { CraneList } from './crane-list';
import { FeedBanner } from './feed-banner';

/**
 * 실시간 태그 탭 — 크레인 스냅샷 피드를 켜고(마운트 = 구독) 목록 또는 상세를
 * 보인다. "연결 해제" 는 이 화면의 구독만 놓는다(`enabled`). 값은 스토어에
 * 마지막 상태로 남아 끊긴 뒤에도 읽을 수 있다.
 */
export function RealtimeTagsView({
  craneId,
  basePath,
}: {
  craneId: string | null;
  basePath: string;
}) {
  const [enabled, setEnabled] = useState(true);
  useCraneSnapshotFeed(enabled);
  const connection = useCraneFeedConnection();
  const loadError = useCraneSnapshotStore((s) => s.loadError);
  const navigate = useProgressNavigate();
  const connected = connection === 'open';

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
      <FeedBanner loadError={loadError} />
      {craneId ? (
        <CraneDetail
          craneId={craneId}
          connected={connected}
          onBack={() => navigate(basePath)}
        />
      ) : (
        <CraneList
          connection={connection}
          enabled={enabled}
          onToggleConnection={() => setEnabled((value) => !value)}
          onOpen={(id) => navigate(`${basePath}/${encodeURIComponent(id)}`)}
        />
      )}
    </div>
  );
}
