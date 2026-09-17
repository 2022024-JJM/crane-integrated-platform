import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  type Monitoring3dViewActions,
} from '@crane/features/3d';
import { Spinner } from '@crane/ui/atoms/spinner';
import { CraneCmmsDetailPanel } from '@crane/widgets/crane';

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
  // 알람 목록의 영역 침범 행 [영역 보기] → 3D 뷰 카메라(features/alarm 과
  // features/3d 는 같은 레이어라 페이지가 잇는다).
  const sceneActionsRef = useRef<Monitoring3dViewActions | null>(null);
  const handleViewZone = useCallback((zoneKey: string) => {
    sceneActionsRef.current?.viewZone(zoneKey);
  }, []);
  const { alarm: criticalBannerAlarm, dismiss: dismissCriticalBanner } =
    useCriticalAlarmBanner(regionId);

  const { craneId, craneName } = useCraneIdFromFocusedModel(regionId);
  const exitFocus = useObjectFocusStore((state) => state.exitFocus);
  const isCmmsOpen = craneId !== null;
  const fullscreenCmmsOverlay = isCmmsOpen ? (
    <CraneCmmsDetailPanel
      key={craneId}
      craneId={craneId}
      craneName={craneName ?? craneId}
      onClose={exitFocus}
    />
  ) : null;

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
        alarmHighlightMesh
        mode="realtime"
        onLoadingChange={setIs3dViewLoading}
        fullscreenOverlay={fullscreenCmmsOverlay}
        actionsRef={sceneActionsRef}
        fullscreenTopRightOverlay={
          <AlarmFullscreenOverlay
            regionId={regionId}
            visible={alarmOverlayVisible}
            onClose={handleAlarmOverlayClose}
            onViewZone={handleViewZone}
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
      />
    </div>
  );
}

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  return <RealtimeMonitoringViewContent key={regionId} regionId={regionId} />;
}
