import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@crane/ui/molecules/resizable';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useRegionRealtimeAlarms,
  useRegionActiveAlarmsByCraneId,
} from '@crane/features/alarm';
import {
  useMonitoringReplay,
  useMonitoringReplaySearch,
} from '@crane/features/monitoring';
import { Monitoring3dView } from '@crane/features/3d';
import {
  useGoliathCraneData,
  GoliathCraneSvgDiagram,
} from '@crane/features/goliath-crane';
import { Spinner } from '@crane/ui/atoms/spinner';
import { CraneStatusTable } from '@crane/widgets/crane';
import { AlarmPanel } from '@crane/widgets/alarm';
import { GoliathMetricsCompact } from './goliath-metrics-compact';
import {
  GoliathVisionStrip,
  CAMERA_CHANNELS,
  type ExpandedView,
} from './goliath-vision-strip';
import { GoliathVisionPip } from './goliath-vision-pip';

// 골리앗은 아직 전용 백엔드가 없으므로 기존 dock-1 데이터를 사용
const GOLIATH_BACKEND_REGION_ID = 'dock-1';

// 골리앗에서 표시할 크레인 (dock-1의 C_171을 GC-04로 매핑)
const GOLIATH_CRANE_ID = 'C_171';

function RealtimeMonitoringViewContent({ regionId }: { regionId: string }) {
  const { t } = useTranslation();
  const backendRegionId =
    regionId === 'goliath' ? GOLIATH_BACKEND_REGION_ID : regionId;
  const { alarms, stats: alarmStats } =
    useRegionRealtimeAlarms(backendRegionId);
  const alarmsByCraneId = useRegionActiveAlarmsByCraneId(backendRegionId);
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
  } = useMonitoringReplaySearch(backendRegionId);
  const { rows, isLoading, isError, errorMessage } = useMonitoringReplay({
    regionId: backendRegionId,
    from: query.from,
    to: query.to,
    interval: query.interval,
  });
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);
  const [visionExpanded, setVisionExpanded] = useState<ExpandedView>(null);
  const { crane } = useGoliathCraneData();

  const goliathRows = useMemo(
    () =>
      rows
        .filter((row) => row.craneId === GOLIATH_CRANE_ID)
        .map((row) => ({ ...row, craneNo: 'GC-04' })),
    [rows],
  );
  const goliathAlarms = useMemo(
    () =>
      alarms
        .filter((a) => a.craneId === GOLIATH_CRANE_ID)
        .map((a) => ({ ...a, craneName: 'GC-04' })),
    [alarms],
  );
  const goliathAlarmStats = useMemo(() => {
    if (Object.values(alarmStats).every((v) => v === 0)) return alarmStats;
    return {
      critical: goliathAlarms.filter((a) => a.severity === 'critical').length,
      high: goliathAlarms.filter((a) => a.severity === 'high').length,
      medium: goliathAlarms.filter((a) => a.severity === 'medium').length,
      info: goliathAlarms.filter((a) => a.severity === 'info').length,
    };
  }, [goliathAlarms, alarmStats]);
  const goliathIsEmpty = goliathRows.length === 0 && !isLoading;

  return (
    <>
      {/* 최상위: 좌(콘텐츠 영역) | 우(Metrics + Alarms) */}
      <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0">
        {/* ── 좌측 메인 영역 ── */}
        <ResizablePanel defaultSize={75} minSize={50}>
          <ResizablePanelGroup
            orientation="vertical"
            className="h-full min-h-0"
          >
            {/* 상단: 3D(2/3) | 2D(1/3) */}
            <ResizablePanel defaultSize={55} minSize={30}>
              <ResizablePanelGroup
                orientation="horizontal"
                className="h-full min-h-0"
              >
                {/* 3D Viewer */}
                <ResizablePanel defaultSize={65} minSize={40}>
                  <div className="relative h-full">
                    {is3dViewLoading && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-xs">
                        <Spinner
                          className="size-6 text-orange-500"
                          aria-hidden="true"
                        />
                        <p className="text-sm font-medium text-white">
                          {t('common:viewer3d.loading')}
                        </p>
                      </div>
                    )}
                    {/* 3D badge */}
                    <div className="pointer-events-none absolute top-2 left-2 z-10 flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 backdrop-blur-sm">
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                          <span className="relative inline-flex size-2 rounded-full bg-sky-500" />
                        </span>
                        <span className="text-[10px] font-semibold tracking-wider text-sky-600 dark:text-sky-400">
                          3D LIVE
                        </span>
                      </div>
                      <div className="bg-background/80 rounded-md px-2 py-0.5 backdrop-blur-sm">
                        <span className="text-foreground/80 text-[10px] font-semibold">
                          {crane.craneNo}
                        </span>
                      </div>
                    </div>
                    <Monitoring3dView
                      regionId={regionId}
                      alarmsByCraneId={alarmsByCraneId}
                      onLoadingChange={setIs3dViewLoading}
                    />
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* 2D SVG Diagram */}
                <ResizablePanel defaultSize={35} minSize={20}>
                  <div className="bg-card relative h-full overflow-hidden">
                    {/* 2D badge */}
                    <div className="pointer-events-none absolute top-2 left-2 z-10 flex items-center gap-1.5">
                      <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 backdrop-blur-sm">
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                        </span>
                        <span className="text-[10px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400">
                          2D LIVE
                        </span>
                      </div>
                    </div>
                    {/* Bottom status bar */}
                    <div className="from-background/80 pointer-events-none absolute right-0 bottom-0 left-0 z-10 flex items-center justify-between bg-linear-to-t to-transparent px-3 pt-6 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold">
                          {crane.craneNo}
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          {crane.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] tabular-nums">
                        <span
                          className={
                            crane.load / crane.maxLoad >= 0.9
                              ? 'font-bold text-red-500'
                              : crane.load / crane.maxLoad >= 0.7
                                ? 'font-bold text-amber-500'
                                : 'text-muted-foreground'
                          }
                        >
                          {crane.load.toFixed(1)}t
                        </span>
                        <span className="text-muted-foreground">
                          {crane.windSpeed.toFixed(1)}m/s
                        </span>
                        <span className="text-muted-foreground">
                          {crane.hoistHeight.toFixed(1)}m
                        </span>
                      </div>
                    </div>
                    <div className="flex h-full items-center justify-center p-2">
                      <GoliathCraneSvgDiagram crane={crane} />
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* 하단: Vision Strip (좌) | CraneStatusTable (우) */}
            <ResizablePanel defaultSize={45} minSize={25}>
              <ResizablePanelGroup
                orientation="horizontal"
                className="h-full min-h-0"
              >
                {/* Vision Strip (Camera + LiDAR 타일) */}
                <ResizablePanel defaultSize={35} minSize={20}>
                  <div className="flex h-full flex-col gap-0">
                    {/* Strip header */}
                    <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
                      <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                        Vision
                      </span>
                      <span className="rounded-full bg-orange-500/15 px-1.5 py-px text-[8px] font-bold text-orange-500">
                        BETA
                      </span>
                      <span className="text-muted-foreground/50 ml-auto text-[9px]">
                        클릭하여 PiP
                      </span>
                    </div>
                    <div className="min-h-0 flex-1 p-2">
                      <GoliathVisionStrip
                        expanded={visionExpanded}
                        onExpand={setVisionExpanded}
                      />
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Crane Status Table */}
                <ResizablePanel defaultSize={65} minSize={40}>
                  <CraneStatusTable
                    rows={goliathRows}
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
                    isEmpty={goliathIsEmpty}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ── 우측: Metrics + Alarms ── */}
        <ResizablePanel defaultSize={25} minSize={15}>
          <ResizablePanelGroup
            orientation="vertical"
            className="h-full min-h-0"
          >
            <ResizablePanel defaultSize={45} minSize={20}>
              <GoliathMetricsCompact crane={crane} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={55} minSize={20}>
              <AlarmPanel stats={goliathAlarmStats} alarms={goliathAlarms} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* floating PiP — fixed 포지션이라 레이아웃 밖에 렌더링됨 */}
      <GoliathVisionPip
        expanded={visionExpanded}
        channels={CAMERA_CHANNELS}
        onClose={() => setVisionExpanded(null)}
      />
    </>
  );
}

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  return <RealtimeMonitoringViewContent key={regionId} regionId={regionId} />;
}
