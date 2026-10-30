import { useState } from 'react';
import type { CraneScope } from '@crane/domain/monitoring';
import {
  selectCraneFeed,
  useCraneFeedConnection,
  useCraneSnapshotFeed,
  useCraneSnapshotStore,
} from '@crane/features/3d';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import { realtimeTagsPath } from '../lib/tags-route';
import { CraneDetail } from './crane-detail';
import { CraneList } from './crane-list';
import { FeedBanner } from './feed-banner';

/**
 * 실시간 태그 탭 — 크레인 스냅샷 피드를 켜고(마운트 = 구독) 목록 또는 상세를
 * 보인다. "연결 해제" 는 이 화면의 구독만 놓는다(`enabled`). 값은 스토어에
 * 마지막 상태로 남아 끊긴 뒤에도 읽을 수 있다.
 */
export function RealtimeTagsView({
  scope,
  craneId,
  basePath,
}: {
  scope: CraneScope | null;
  craneId: string | null;
  basePath: string;
}) {
  const [enabled, setEnabled] = useState(true);
  useCraneSnapshotFeed(scope, enabled);
  const connection = useCraneFeedConnection();
  const loadError = useCraneSnapshotStore(
    (s) => selectCraneFeed(s, scope).loadError,
  );
  const navigate = useProgressNavigate();
  const connected = connection === 'open';

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
      <FeedBanner loadError={loadError} />
      {craneId ? (
        <CraneDetail
          scope={scope}
          craneId={craneId}
          connected={connected}
          onBack={() => navigate(realtimeTagsPath(basePath))}
        />
      ) : (
        <CraneList
          scope={scope}
          connection={connection}
          enabled={enabled}
          onToggleConnection={() => setEnabled((value) => !value)}
          onOpen={(id) => navigate(realtimeTagsPath(basePath, id))}
        />
      )}
    </div>
  );
}
