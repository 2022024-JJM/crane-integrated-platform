import { getRegionById, getRegionTitleKey } from '@/entities/region';
import { useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RealtimeMonitoringView } from './realtime-monitoring-view';

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

export function OutdoorWorkPage() {
  const { t } = useTranslation();
  const { regionId, '*': subRoute } = useParams<{
    regionId: string;
    '*': string;
  }>();

  if (!regionId) return null;

  if (!subRoute) {
    return <Navigate to={`/outdoor-work/${regionId}/3d-monitoring`} replace />;
  }

  const region = getRegionById(regionId);

  return (
    <div className="h-full min-h-0 w-full">
      {subRoute === '3d-monitoring' && (
        <RealtimeMonitoringView regionId={regionId} />
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
    </div>
  );
}
