import { useCallback, useMemo, useState, type ReactNode } from 'react';
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
import type { SensorFeedRenderer } from '@crane/features/3d';
import { Spinner } from '@crane/ui/atoms/spinner';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@crane/ui/molecules/resizable';
import { CraneStatusTable, CraneCmmsDetailPanel } from '@crane/widgets/crane';

export type RealtimeMonitoringLayout = 'vertical' | 'horizontal-with-side';

export interface RealtimeMonitoringViewProps {
  regionId: string;
  alarmRegionId?: string;
  tableRegionId?: string;
  cranes?: MonitoringLiveCrane[];
  tagDefinitionIds?: number[];
  alarmHighlightMesh?: boolean;
  layout?: RealtimeMonitoringLayout;
  sideSlot?: ReactNode;
  extraTopRightOverlay?: ReactNode;
  disableAlarmFeatures?: boolean;
  disableCmmsFocus?: boolean;
  onSensorSelect?: (
    channelId: string,
    sensorType: 'camera' | 'lidar',
  ) => void;
  renderSensorFeed?: SensorFeedRenderer;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

function deriveCranesFromRegion(regionId: string): MonitoringLiveCrane[] {
  return getCraneIdsByRegion(regionId).map((currentCraneId) => {
    const crane = getCraneById(currentCraneId);
    return {
      craneId: currentCraneId,
      craneNo: crane?.craneNo ?? currentCraneId,
      craneName: crane?.craneName,
    };
  });
}

function RealtimeMonitoringViewContent(props: RealtimeMonitoringViewProps) {
  const {
    regionId,
    alarmRegionId = regionId,
    tableRegionId = regionId,
    cranes: cranesProp,
    tagDefinitionIds,
    alarmHighlightMesh = false,
    layout = 'vertical',
    sideSlot,
    extraTopRightOverlay,
    disableAlarmFeatures = false,
    disableCmmsFocus = false,
    onSensorSelect,
    renderSensorFeed,
    onFullscreenChange,
  } = props;

  const { t } = useTranslation();
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const alarmsByCraneId = useRegionActiveAlarmsByCraneId(alarmRegionId);

  const {
    visible: alarmOverlayVisible,
    toggle: toggleAlarmOverlay,
    setVisible: setAlarmOverlayVisible,
    activeAlarmCount,
  } = useFullscreenAlarmOverlay(alarmRegionId);
  const handleAlarmOverlayClose = useCallback(() => {
    setAlarmOverlayVisible(false);
  }, [setAlarmOverlayVisible]);
  const { alarm: criticalBannerAlarm, dismiss: dismissCriticalBanner } =
    useCriticalAlarmBanner(alarmRegionId);

  const { craneId, craneName } = useCraneIdFromFocusedModel(regionId);
  const clearFocus = useObjectFocusStore((state) => state.clearFocus);
  const isCmmsOpen = !disableCmmsFocus && craneId !== null;

  const cranes = useMemo<MonitoringLiveCrane[]>(
    () => cranesProp ?? deriveCranesFromRegion(regionId),
    [cranesProp, regionId],
  );

  const handleFullscreenChange = useCallback(
    (next: boolean) => {
      setIsFullscreen(next);
      onFullscreenChange?.(next);
    },
    [onFullscreenChange],
  );

  const fullscreenCmmsOverlay =
    isCmmsOpen && craneId !== null ? (
      <CraneCmmsDetailPanel
        key={craneId}
        craneId={craneId}
        craneName={craneName ?? craneId}
        onClose={clearFocus}
      />
    ) : null;

  const alarmTopRightOverlay = disableAlarmFeatures ? null : (
    <AlarmFullscreenOverlay
      regionId={alarmRegionId}
      visible={alarmOverlayVisible}
      onClose={handleAlarmOverlayClose}
    />
  );
  const topRightOverlay =
    alarmTopRightOverlay || extraTopRightOverlay ? (
      <>
        {alarmTopRightOverlay}
        {extraTopRightOverlay}
      </>
    ) : undefined;

  const topCenterOverlay = disableAlarmFeatures ? undefined : (
    <AlarmCriticalBanner
      alarm={criticalBannerAlarm}
      onDismiss={dismissCriticalBanner}
    />
  );

  const toolbarExtras =
    !disableAlarmFeatures && isFullscreen ? (
      <AlarmFullscreenToggleButton
        active={alarmOverlayVisible}
        alarmCount={activeAlarmCount}
        onToggle={toggleAlarmOverlay}
      />
    ) : undefined;

  const viewerSection = (
    <div className="relative h-full">
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
        alarmHighlightMesh={alarmHighlightMesh}
        mode="realtime"
        onLoadingChange={setIs3dViewLoading}
        fullscreenOverlay={fullscreenCmmsOverlay}
        fullscreenTopRightOverlay={topRightOverlay}
        fullscreenTopCenterOverlay={topCenterOverlay}
        toolbarExtras={toolbarExtras}
        onFullscreenChange={handleFullscreenChange}
        onSensorSelect={onSensorSelect}
        renderSensorFeed={renderSensorFeed}
      />
    </div>
  );

  const tableSection = (
    <CraneStatusTable
      cranes={cranes}
      regionId={tableRegionId}
      tagDefinitionIds={tagDefinitionIds}
    />
  );

  const verticalStack = (
    <ResizablePanelGroup orientation="vertical" className="h-full min-h-0">
      <ResizablePanel defaultSize={layout === 'vertical' ? 60 : 55} minSize={30}>
        {viewerSection}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={layout === 'vertical' ? 40 : 45} minSize={25}>
        {tableSection}
      </ResizablePanel>
    </ResizablePanelGroup>
  );

  if (layout === 'vertical') {
    return verticalStack;
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0">
      <ResizablePanel defaultSize={75} minSize={50}>
        {verticalStack}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={25} minSize={15}>
        {sideSlot}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function RealtimeMonitoringView(props: RealtimeMonitoringViewProps) {
  return (
    <RealtimeMonitoringViewContent key={props.regionId} {...props} />
  );
}
