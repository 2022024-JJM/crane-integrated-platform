import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@crane/ui/molecules/resizable';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useRegionRealtimeAlarms,
  useRegionActiveAlarmsByCraneId,
} from '@crane/features/alarm';
import {
  useMonitoringReplay,
  useMonitoringReplaySearch,
} from '@crane/features/monitoring';
import {
  Monitoring3dView,
  useCraneIdFromFocusedModel,
  useObjectFocusStore,
} from '@crane/features/3d';
import { Spinner } from '@crane/ui/atoms/spinner';
import { CraneStatusTable } from '@crane/widgets/crane';
import { AlarmPanel } from '@crane/widgets/alarm';
import { CraneCmmsDetailPanel } from '../../crane-detail/ui/crane-cmms-detail-panel';

function RealtimeMonitoringViewContent({ regionId }: { regionId: string }) {
  const { t } = useTranslation();
  const { alarms, stats: alarmStats } = useRegionRealtimeAlarms(regionId);
  const alarmsByCraneId = useRegionActiveAlarmsByCraneId(regionId);
  const {
    draftFrom,
    draftTo,
    setDraftFrom,
    setDraftTo,
    submitSearch,
    canSearch,
    validationReason,
    viewingFrom,
    viewingTo,
    query,
  } = useMonitoringReplaySearch(regionId);
  const { rows, isLoading, isError, errorMessage, isEmpty } =
    useMonitoringReplay({
      regionId,
      from: query.from,
      to: query.to,
    });
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);

  const { craneId, craneName } = useCraneIdFromFocusedModel(regionId);
  const clearFocus = useObjectFocusStore((s) => s.clearFocus);
  const isCmmsOpen = craneId !== null;

  // 전체화면 시에만 CMMS 패널 표시 (ThreeSceneViewer 우측 절반)
  const fullscreenCmmsOverlay = isCmmsOpen ? (
    <CraneCmmsDetailPanel
      key={craneId}
      craneId={craneId}
      craneName={craneName ?? craneId}
      onClose={clearFocus}
    />
  ) : null;

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0">
      <ResizablePanel defaultSize={75} minSize={30}>
        <ResizablePanelGroup orientation="vertical" className="min-h-0">
          <ResizablePanel defaultSize={60}>
            <div className="relative h-full">
              {is3dViewLoading ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-xs">
                  <Spinner
                    className="size-6 text-orange-500"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-white">
                    {t('common:viewer3d.loading')}
                  </p>
                </div>
              ) : null}
              <Monitoring3dView
                regionId={regionId}
                alarmsByCraneId={alarmsByCraneId}
                alarmHighlightMesh
                onLoadingChange={setIs3dViewLoading}
                fullscreenOverlay={fullscreenCmmsOverlay}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40}>
            <CraneStatusTable
              rows={rows}
              searchFrom={draftFrom}
              searchTo={draftTo}
              viewingFrom={viewingFrom}
              viewingTo={viewingTo}
              isSearchDisabled={!canSearch || isLoading}
              validationReason={validationReason}
              onSearchFromChange={setDraftFrom}
              onSearchToChange={setDraftTo}
              onSearch={submitSearch}
              isLoading={isLoading}
              isError={isError}
              errorMessage={errorMessage}
              isEmpty={isEmpty}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>

      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={25} minSize={15}>
        <AlarmPanel stats={alarmStats} alarms={alarms} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  return <RealtimeMonitoringViewContent key={regionId} regionId={regionId} />;
}
