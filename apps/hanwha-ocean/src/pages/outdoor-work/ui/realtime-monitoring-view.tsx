import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlarmCriticalBanner,
  AlarmFullscreenOverlay,
  AlarmFullscreenToggleButton,
  useCriticalAlarmBanner,
  useFullscreenAlarmOverlay,
} from '@crane/features/alarm';
import {
  CollisionGuardHelp,
  CollisionGuardHud,
  CollisionGuardSceneLayer,
  CollisionGuardToggle,
  Monitoring3dView,
  useCraneIdFromFocusedModel,
  useObjectFocusStore,
  type Monitoring3dViewActions,
} from '@crane/features/3d';
import { getRegionById } from '@crane/domain/region';
import { Spinner } from '@crane/ui/atoms/spinner';
import { CraneCmmsDetailPanel } from '@crane/widgets/crane';

/**
 * 충돌 감지 표시(LiDAR 근접 존)는 필리 조선소 화면에만 둔다. 존은 씬의
 * 골리앗 크레인 배치에서 파생하는데, 옥포 씬에도 같은 자산의 골리앗이
 * 있어 "씬에 크레인이 있으면" 으로는 가르지 못한다 — 사이트로 가른다.
 */
function hasCollisionGuard(regionId: string): boolean {
  return getRegionById(regionId)?.siteType === 'philly-shipyard';
}

function RealtimeMonitoringViewContent({ regionId }: { regionId: string }) {
  const { t } = useTranslation();
  const collisionGuard = hasCollisionGuard(regionId);
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
      {/* 장면 안(라벨 색·미니맵 마커·HUD 칸)에는 알람을 그리지 않는다 —
          라벨 색은 운전 상태만 나타낸다. 알람은 아래 목록·배너로 본다. */}
      <Monitoring3dView
        regionId={regionId}
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
          <>
            <AlarmFullscreenToggleButton
              active={alarmOverlayVisible}
              alarmCount={activeAlarmCount}
              onToggle={toggleAlarmOverlay}
            />
            {collisionGuard ? (
              <CollisionGuardToggle regionId={regionId} />
            ) : null}
          </>
        }
        sceneExtras={
          collisionGuard ? (
            <CollisionGuardSceneLayer regionId={regionId} />
          ) : null
        }
        overlayExtras={
          collisionGuard ? (
            <>
              <CollisionGuardHud regionId={regionId} />
              <CollisionGuardHelp regionId={regionId} />
            </>
          ) : null
        }
        toolbarLayout="dock"
      />
    </div>
  );
}

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  return <RealtimeMonitoringViewContent key={regionId} regionId={regionId} />;
}
