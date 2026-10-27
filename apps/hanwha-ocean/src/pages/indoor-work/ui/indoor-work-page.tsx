import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { SceneObjectsEditPage } from '@crane/widgets/scene-editor';
import { TagsPage, matchTagsSubRoute } from '@crane/widgets/tags';
import { DetectionSettingsPage } from '@crane/widgets/detection-settings';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import { RealtimeMonitoringView } from './realtime-monitoring-view';
import { ReplayMonitoringView } from './replay-monitoring-view';

function SubRouteRedirect({ to }: { to: string }) {
  const navigate = useProgressNavigate();

  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);

  return null;
}

export function IndoorWorkPage() {
  const { regionId, '*': subRoute } = useParams<{
    regionId: string;
    '*': string;
  }>();

  if (!regionId) return null;

  if (!subRoute) {
    return <SubRouteRedirect to={`/indoor-work/${regionId}/3d-monitoring`} />;
  }

  const tagsRoute = matchTagsSubRoute(subRoute);

  return (
    <div className="h-full min-h-0 w-full">
      {subRoute === '3d-monitoring' && (
        <RealtimeMonitoringView regionId={regionId} />
      )}
      {subRoute === '3d-viewer-edit' && (
        <SceneObjectsEditPage regionId={regionId} />
      )}
      {tagsRoute && (
        <TagsPage
          route={tagsRoute}
          basePath={`/indoor-work/${regionId}/tags`}
        />
      )}
      {subRoute === 'detection-settings' && <DetectionSettingsPage />}
      {subRoute === '3d-replay' && <ReplayMonitoringView regionId={regionId} />}
    </div>
  );
}
