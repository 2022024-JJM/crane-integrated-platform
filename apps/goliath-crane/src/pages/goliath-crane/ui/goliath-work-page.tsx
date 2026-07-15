import { getRegionById, getRegionTitleKey } from '@crane/domain/region';
import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SceneObjectsEditPage } from '@crane/widgets/scene-editor';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import { AlarmHistoryPage } from '@crane/widgets/alarm';
import { useRegionRealtimeAlarms } from '@crane/features/alarm';
import { RealtimeMonitoringView } from './realtime-monitoring-view';
import { ReplayMonitoringView } from './replay-monitoring-view';
import { VisionMonitoringView } from './vision-monitoring-view';
import { VISION_CHANNELS } from './vision/types';
import { CabinMonitoringView } from './cabin-monitoring-view';

const GOLIATH_BACKEND_REGION_ID = 'dock-1';
const GOLIATH_CRANE_ID = 'C_171';

function AlarmHistoryView({ regionId }: { regionId: string }) {
  const backendRegionId =
    regionId === 'goliath' ? GOLIATH_BACKEND_REGION_ID : regionId;
  const { alarms } = useRegionRealtimeAlarms(backendRegionId);
  const goliathAlarms = useMemo(
    () =>
      alarms
        .filter((alarm) => alarm.craneId === GOLIATH_CRANE_ID)
        .map((alarm) => ({ ...alarm, craneName: 'GC-04' })),
    [alarms],
  );
  return <AlarmHistoryPage alarms={goliathAlarms} />;
}

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

export function GoliathWorkPage() {
  const { t } = useTranslation();
  const { regionId, '*': subRoute } = useParams<{
    regionId: string;
    '*': string;
  }>();

  if (!regionId) return null;

  if (!subRoute) {
    return <SubRouteRedirect to={`/goliath-work/${regionId}/3d-monitoring`} />;
  }

  const region = getRegionById(regionId);

  return (
    <div className="h-full min-h-0 w-full">
      {subRoute === '3d-monitoring' && (
        <RealtimeMonitoringView regionId={regionId} />
      )}
      {subRoute === 'vision' && <VisionMonitoringView regionId={regionId} />}
      {subRoute === 'cabin-monitoring' && (
        <CabinMonitoringView regionId={regionId} />
      )}
      {subRoute === '3d-viewer-edit' && (
        <SceneObjectsEditPage
          regionId={regionId}
          visionChannels={VISION_CHANNELS}
        />
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
      {subRoute === 'alarm-history' && <AlarmHistoryView regionId={regionId} />}
      {subRoute === '3d-replay' && <ReplayMonitoringView regionId={regionId} />}
    </div>
  );
}
