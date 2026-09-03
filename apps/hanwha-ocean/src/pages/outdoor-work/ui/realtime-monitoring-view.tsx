import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCraneById, getCraneIdsByRegion } from '@crane/domain/crane';
import type { MonitoringLiveCrane } from '@crane/domain/monitoring';
import {
  AlarmCriticalBanner,
  AlarmFullscreenOverlay,
  AlarmFullscreenToggleButton,
  useCriticalAlarmBanner,
  useFullscreenAlarmOverlay,
  useRegionActiveAlarmsByCraneId,
} from '@crane/features/alarm';
import {
  Monitoring3dView,
  useCraneIdFromFocusedModel,
  useObjectFocusStore,
} from '@crane/features/3d';
import { Spinner } from '@crane/ui/atoms/spinner';
import { CraneCmmsDetailPanel, CraneStatusTable } from '@crane/widgets/crane';

function RealtimeMonitoringViewContent({ regionId }: { regionId: string }) {
  const { t } = useTranslation();
  const alarmsByCraneId = useRegionActiveAlarmsByCraneId(regionId);
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);
  const {
    visible: alarmOverlayVisible,
    toggle: toggleAlarmOverlay,
    setVisible: setAlarmOverlayVisible,
    activeAlarmCount,
  } = useFullscreenAlarmOverlay(regionId);
  const handleAlarmOverlayClose = useCallback(() => {
    setAlarmOverlayVisible(false);
  }, [setAlarmOverlayVisible]);
  const { alarm: criticalBannerAlarm, dismiss: dismissCriticalBanner } =
    useCriticalAlarmBanner(regionId);
  const { craneId, craneName } = useCraneIdFromFocusedModel(regionId);
  const exitFocus = useObjectFocusStore((state) => state.exitFocus);
  const isCmmsOpen = craneId !== null;
  const cranes = useMemo<MonitoringLiveCrane[]>(
    () =>
      getCraneIdsByRegion(regionId).map((currentCraneId) => {
        const crane = getCraneById(currentCraneId);

        return {
          craneId: currentCraneId,
          craneNo: crane?.craneNo ?? currentCraneId,
          craneName: crane?.craneName,
        };
      }),
    [regionId],
  );
  const fullscreenCmmsOverlay = isCmmsOpen ? (
    <CraneCmmsDetailPanel
      key={craneId}
      craneId={craneId}
      craneName={craneName ?? craneId}
      onClose={exitFocus}
    />
  ) : null;

  // 크레인 실시간 상태 테이블은 3D 뷰의 하단 독 탭으로 들어간다 — 뷰어의
  // 전체화면 루트 안에 있어야 전체화면에서도 보인다. 접혀 있어도 마운트를
  // 유지하므로(독 규칙) 실시간 행 상태가 끊기지 않는다.
  const dockPanels = useMemo(
    () => [
      {
        id: 'crane-status',
        label: t('common:craneStatus.title'),
        content: (
          <CraneStatusTable cranes={cranes} regionId={regionId} hideTitle />
        ),
      },
    ],
    [cranes, regionId, t],
  );

  return (
    <div className="relative h-full min-h-0">
      {is3dViewLoading ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-xs">
          <Spinner className="size-6 text-orange-500" aria-hidden="true" />
          <p className="text-sm font-medium text-white">
            {t('common:viewer3d.loading')}
          </p>
        </div>
      ) : null}
      <Monitoring3dView
        regionId={regionId}
        alarmsByCraneId={alarmsByCraneId}
        mode="realtime"
        onLoadingChange={setIs3dViewLoading}
        fullscreenOverlay={fullscreenCmmsOverlay}
        fullscreenTopRightOverlay={
          <AlarmFullscreenOverlay
            regionId={regionId}
            visible={alarmOverlayVisible}
            onClose={handleAlarmOverlayClose}
          />
        }
        fullscreenTopCenterOverlay={
          <AlarmCriticalBanner
            alarm={criticalBannerAlarm}
            onDismiss={dismissCriticalBanner}
          />
        }
        toolbarExtras={
          <AlarmFullscreenToggleButton
            active={alarmOverlayVisible}
            alarmCount={activeAlarmCount}
            onToggle={toggleAlarmOverlay}
          />
        }
        toolbarLayout="dock"
        dockPanels={dockPanels}
      />
    </div>
  );
}

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  return <RealtimeMonitoringViewContent key={regionId} regionId={regionId} />;
}
