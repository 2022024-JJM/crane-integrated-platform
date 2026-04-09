import { getRegionById, getRegionTitleKey } from '@crane/domain/region';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SceneObjectsEditPage } from '@crane/widgets/scene-editor';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import { RealtimeMonitoringView } from './realtime-monitoring-view';
import { ReplayMonitoringView } from './replay-monitoring-view';

function PlaceholderView({ title }: { title: string }) {
  const { t } = useTranslation();

  return (
    <div className="text-muted-foreground flex h-full items-center justify-center">
      <p className="text-lg">
        {title} - {t('comingSoon')}
      </p>
    </div>
  );
}

function SubRouteRedirect({ to }: { to: string }) {
  const navigate = useProgressNavigate();

  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);

  return null;
}

export function OutdoorWorkPage() {
  const { t } = useTranslation();
  const { regionId, '*': subRoute } = useParams<{
    regionId: string;
    '*': string;
  }>();

  if (!regionId) return null;

  if (!subRoute) {
    return <SubRouteRedirect to={`/outdoor-work/${regionId}/3d-monitoring`} />;
  }

  const region = getRegionById(regionId);

  return (
    <div className="h-full min-h-0 w-full">
      {subRoute === '3d-monitoring' && (
        <RealtimeMonitoringView regionId={regionId} />
      )}
      {subRoute === '3d-viewer-edit' && (
        <SceneObjectsEditPage regionId={regionId} />
      )}
      {subRoute === 'crane-status' && (
        <PlaceholderView
          title={
            region
              ? `${t(getRegionTitleKey(region.id))} ${t('common:nav.craneStatus')}`
              : t('common:nav.craneStatus')
          }
        />
      )}
      {subRoute === 'work-history' && (
        <PlaceholderView
          title={
            region
              ? `${t(getRegionTitleKey(region.id))} ${t('common:nav.workHistory')}`
              : t('common:nav.workHistory')
          }
        />
      )}
      {subRoute === '3d-replay' && (
        <ReplayMonitoringView regionId={regionId} />
      )}
    </div>
  );
}
