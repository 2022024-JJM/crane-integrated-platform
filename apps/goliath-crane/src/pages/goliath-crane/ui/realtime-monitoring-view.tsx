import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonitoringLiveCrane } from '@crane/domain/monitoring';
import {
  useRegionRealtimeAlarms,
  useRegionActiveAlarmsByCraneId,
} from '@crane/features/alarm';
import { Monitoring3dView } from '@crane/features/3d';
import {
  GoliathCraneSvgDiagram,
  useGoliathCraneData,
} from '@crane/features/goliath-crane';
import { Spinner } from '@crane/ui/atoms/spinner';
import { AlarmPanel } from '@crane/widgets/alarm';
import { CraneStatusTable } from '@crane/widgets/crane';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@crane/ui/molecules/resizable';
import { GoliathMetricsCompact } from './goliath-metrics-compact';
import {
  CAMERA_CHANNELS,
  GoliathVisionStrip,
  type ExpandedView,
} from './goliath-vision-strip';
import { GoliathVisionPip } from './goliath-vision-pip';

const GOLIATH_BACKEND_REGION_ID = 'dock-1';
const GOLIATH_CRANE_ID = 'C_171';
const GOLIATH_TAG_DEFINITION_IDS = [7, 8];
const GOLIATH_CRANES: MonitoringLiveCrane[] = [
  {
    craneId: GOLIATH_CRANE_ID,
    craneNo: 'GC-04',
    craneName: 'GC-04',
  },
];

function RealtimeMonitoringViewContent({ regionId }: { regionId: string }) {
  const { t } = useTranslation();
  const backendRegionId =
    regionId === 'goliath' ? GOLIATH_BACKEND_REGION_ID : regionId;
  const { alarms, stats: alarmStats } =
    useRegionRealtimeAlarms(backendRegionId);
  const alarmsByCraneId = useRegionActiveAlarmsByCraneId(backendRegionId);
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);
  const [visionExpanded, setVisionExpanded] = useState<ExpandedView>(null);
  const { crane } = useGoliathCraneData();

  const goliathAlarms = useMemo(
    () =>
      alarms
        .filter((alarm) => alarm.craneId === GOLIATH_CRANE_ID)
        .map((alarm) => ({ ...alarm, craneName: 'GC-04' })),
    [alarms],
  );
  const goliathAlarmStats = useMemo(() => {
    if (Object.values(alarmStats).every((value) => value === 0)) {
      return alarmStats;
    }

    return {
      critical: goliathAlarms.filter((alarm) => alarm.severity === 'critical')
        .length,
      high: goliathAlarms.filter((alarm) => alarm.severity === 'high').length,
      medium: goliathAlarms.filter((alarm) => alarm.severity === 'medium')
        .length,
      info: goliathAlarms.filter((alarm) => alarm.severity === 'info').length,
    };
  }, [goliathAlarms, alarmStats]);

  return (
    <>
      <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0">
        <ResizablePanel defaultSize={75} minSize={50}>
          <ResizablePanelGroup
            orientation="vertical"
            className="h-full min-h-0"
          >
            <ResizablePanel defaultSize={55} minSize={30}>
              <ResizablePanelGroup
                orientation="horizontal"
                className="h-full min-h-0"
              >
                <ResizablePanel defaultSize={65} minSize={40}>
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
                      onLoadingChange={setIs3dViewLoading}
                    />
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={35} minSize={20}>
                  <div className="bg-card relative h-full overflow-hidden">
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

            <ResizablePanel defaultSize={45} minSize={25}>
              <ResizablePanelGroup
                orientation="horizontal"
                className="h-full min-h-0"
              >
                <ResizablePanel defaultSize={35} minSize={20}>
                  <div className="flex h-full flex-col gap-0">
                    <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
                      <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                        Vision
                      </span>
                      <span className="rounded-full bg-orange-500/15 px-1.5 py-px text-[8px] font-bold text-orange-500">
                        BETA
                      </span>
                      <span className="text-muted-foreground/50 ml-auto text-[9px]">
                        Click for PiP
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

                <ResizablePanel defaultSize={65} minSize={40}>
                  <CraneStatusTable
                    cranes={GOLIATH_CRANES}
                    tagDefinitionIds={GOLIATH_TAG_DEFINITION_IDS}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

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
