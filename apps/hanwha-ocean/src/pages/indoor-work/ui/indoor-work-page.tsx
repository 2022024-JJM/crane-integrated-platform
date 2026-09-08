import { getRegionById, getRegionTitleKey } from '@crane/domain/region';
import { getCraneById, getCraneIdsByRegion } from '@crane/domain/crane';
import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SceneObjectsEditPage } from '@crane/widgets/scene-editor';
import { VirtualTagsPage } from '@crane/widgets/virtual-tags';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import {
  AlarmHistoryPage,
  type AlarmHistoryCraneOption,
} from '@crane/widgets/alarm';
import { useRegionRealtimeAlarms } from '@crane/features/alarm';
import { RealtimeMonitoringView } from './realtime-monitoring-view';
import { ReplayMonitoringView } from './replay-monitoring-view';

function AlarmHistoryView({ regionId }: { regionId: string }) {
  const { alarms } = useRegionRealtimeAlarms(regionId);
  const craneOptions = useMemo<AlarmHistoryCraneOption[]>(
    () =>
      getCraneIdsByRegion(regionId).map((id) => {
        const crane = getCraneById(id);
        return {
          id,
          label: crane?.craneNo ?? crane?.craneName ?? id,
        };
      }),
    [regionId],
  );
  return <AlarmHistoryPage alarms={alarms} craneOptions={craneOptions} />;
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

export function IndoorWorkPage() {
  const { t } = useTranslation();
  const { regionId, '*': subRoute } = useParams<{
    regionId: string;
    '*': string;
  }>();

  if (!regionId) return null;

  if (!subRoute) {
    return <SubRouteRedirect to={`/indoor-work/${regionId}/3d-monitoring`} />;
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
      {subRoute === 'virtual-tags' && <VirtualTagsPage />}
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
      {subRoute === 'alarm-history' && (
        <AlarmHistoryView regionId={regionId} />
      )}
      {subRoute === '3d-replay' && (
        <ReplayMonitoringView regionId={regionId} />
      )}
    </div>
  );
}
