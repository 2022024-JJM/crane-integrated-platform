import '@/pages/outdoor-work/ui/outdoor-work-page.css';

import { useState } from 'react';
import {
  AlarmStatsSection,
  AlarmTableSection,
  OUTDOOR_ALARM_ROWS,
  OUTDOOR_MONITORING_STAT_CARDS,
} from '@/entities/monitoring/alarm';
import { MonitoringStatusTable } from '@/entities/monitoring/crane-status';
import {
  MonitoringMenu,
  type MonitoringMenuKey,
} from '@/entities/monitoring/menu';
import {
  OperationInfoCardsSection,
  OperationInfoNotesSection,
  OperationStatusCardsSection,
  OperationStatusSummarySection,
  OUTDOOR_OPERATION_INFO_CARDS,
  OUTDOOR_OPERATION_INFO_NOTES,
  OUTDOOR_OPERATION_STATUS_CARDS,
  OUTDOOR_OPERATION_STATUS_SUMMARY,
} from '@/entities/monitoring/operation';
import {
  use3dViewerControls,
  useViewerControls,
  ViewerControls,
} from '@/features/3d-model/viewer';
import { ModeToggle } from '@/features/theme-toggle';
import { useActiveWorkMenu } from '@/entities/monitoring/menu';
import { cn } from '@/shared/lib/utils';
import { Spinner } from '@/shared/ui/atoms/spinner';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/shared/ui/organisms/resizable';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/shared/ui/organisms/sidebar';
import {
  Topbar,
  TopbarBrand,
  TopbarContent,
} from '@/shared/ui/organisms/topbar';
import { Clock3, CloudSun, RadioTower } from 'lucide-react';
import { HanwhaIcon } from '@/shared/ui/atoms/hanwha-icon';
import { Brand } from '@/shared/ui/molecules/brand';
import { TopStatusCard } from '@/shared/ui/molecules/top-status-card';
import { useClock } from '@/shared/hooks/use-clock';
import { useSiteWeather } from '@/shared/hooks/use-site-weather';
import { Link } from 'react-router-dom';
import {
  OUTDOOR_WORK_BOTTOM_PANEL_TABLE_MAP,
  OUTDOOR_WORK_MENU_ITEMS,
  OUTDOOR_WORK_MENU_TITLE,
} from '../model/outdoor-work-content';
import { OutdoorWork3dView } from './outdoor-work-3d-view';
import { panelSurfaceClass } from './outdoor-work-page-styles';

function renderRightPanel(activeMenu: MonitoringMenuKey) {
  if (activeMenu === 'operation-info') {
    return (
      <>
        <OperationInfoCardsSection cards={OUTDOOR_OPERATION_INFO_CARDS} />
        <OperationInfoNotesSection items={OUTDOOR_OPERATION_INFO_NOTES} />
      </>
    );
  }

  if (activeMenu === 'operation-status') {
    return (
      <>
        <OperationStatusCardsSection cards={OUTDOOR_OPERATION_STATUS_CARDS} />
        <OperationStatusSummarySection
          items={OUTDOOR_OPERATION_STATUS_SUMMARY}
        />
      </>
    );
  }

  return (
    <>
      <AlarmStatsSection monitoringStatCard={OUTDOOR_MONITORING_STAT_CARDS} />
      <AlarmTableSection alarmRows={OUTDOOR_ALARM_ROWS} />
    </>
  );
}

export function OutdoorWorkPage() {
  const TEXT = {
    liveConnected: '온라인',
  } as const;
  const { hmsLabel } = useClock();
  const { siteLabel, temperatureLabel, weatherLabel } = useSiteWeather({
    regionName: '부산',
  });
  const { isViewerFullscreen, toggleViewerFullscreen, viewerFrameRef } =
    useViewerControls();
  const {
    isDetailView,
    resetViewer,
    toggleDetailView,
    handleZoomChange,
    viewerRef,
    zoomInViewer,
    zoomOutViewer,
    zoomPercent,
  } = use3dViewerControls();
  const { activeMenu, setActiveMenu } = useActiveWorkMenu();
  const craneStatusTable = OUTDOOR_WORK_BOTTOM_PANEL_TABLE_MAP[activeMenu];
  const [isViewerLoading, setIsViewerLoading] = useState(true);

  return (
    <main className="outdoor-work-page flex h-screen flex-col overflow-hidden">
      <SidebarProvider defaultOpen={false} className="flex flex-col">
        {/* 헤더 */}
        <Topbar className="h-18 shrink-0 px-2 py-4">
          <TopbarBrand>
            <SidebarTrigger />
            <Link to="/" className="flex gap-3">
              <HanwhaIcon />
              <Brand />
            </Link>
          </TopbarBrand>
          <TopbarContent>
            <div className="flex items-center gap-2 justify-self-end max-[720px]:flex-wrap">
              <TopStatusCard
                icon={<CloudSun size={15} />}
                label="Weather"
                value={`${siteLabel} `}
                subValue={`${weatherLabel} ${temperatureLabel}`}
              />
              <TopStatusCard
                icon={<Clock3 size={15} />}
                label="Time"
                value={<time className="font-mono">{hmsLabel}</time>}
                className="[--top-status-card-current-icon-bg:var(--outdoor-page-status-clock-icon-bg)] [--top-status-card-current-icon:var(--outdoor-page-status-clock-icon)]"
              />
              <TopStatusCard
                icon={<RadioTower size={15} />}
                label="Status"
                value={TEXT.liveConnected}
                tone="success"
              />
              <ModeToggle />
            </div>
          </TopbarContent>
        </Topbar>

        {/* 메뉴 */}
        <MonitoringMenu
          title={OUTDOOR_WORK_MENU_TITLE}
          menuItems={OUTDOOR_WORK_MENU_ITEMS}
          activeMenu={activeMenu}
          onSelectMenu={setActiveMenu}
        />

        {/* 컨텐츠 */}
        <SidebarInset className="min-h-0 flex-1 bg-transparent">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel minSize="40%">
              <ResizablePanelGroup orientation="vertical">
                <ResizablePanel defaultSize="70%" minSize="260px">
                  {/* 3D 뷰어 */}
                  <div
                    ref={viewerFrameRef}
                    className={cn(
                      'relative h-full min-h-0 overflow-hidden',
                      isViewerFullscreen &&
                        'bg-[var(--outdoor-page-viewer-fullscreen-bg)]',
                    )}
                  >
                    {/* 뷰어 컨트롤러 */}
                    <ViewerControls
                      detailViewLabels={{
                        active: '기본 시점으로 이동',
                        inactive: '탑뷰로 이동',
                      }}
                      isDetailView={isDetailView}
                      isViewerFullscreen={isViewerFullscreen}
                      onResetViewer={resetViewer}
                      onToggleDetailView={toggleDetailView}
                      onToggleFullscreen={toggleViewerFullscreen}
                      onZoomIn={zoomInViewer}
                      onZoomOut={zoomOutViewer}
                    />
                    {isViewerLoading ? (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--outdoor-page-card-bg)] text-[var(--outdoor-page-text)] backdrop-blur-xs">
                        <Spinner
                          className="size-6 text-[var(--outdoor-page-accent)]"
                          aria-hidden="true"
                        />
                        <p className="text-sm font-medium">
                          3D 작업장을 불러오는 중
                        </p>
                      </div>
                    ) : null}
                    {!isViewerLoading ? (
                      <div className="absolute right-3 bottom-3 z-2 font-mono text-[12px] font-bold text-amber-400">
                        {zoomPercent}%
                      </div>
                    ) : null}
                    {/* 애니메이션 화면 */}
                    <div className="h-full min-h-0 border-x border-x-[rgba(255,166,0,0.06)] bg-[rgba(43,43,43)]">
                      <OutdoorWork3dView
                        ref={viewerRef}
                        onLoadingChange={setIsViewerLoading}
                        onZoomChange={handleZoomChange}
                      />
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle />

                {/* 크레인 상태 */}
                <ResizablePanel
                  defaultSize="30%"
                  minSize="160px"
                  className="overflow-auto"
                >
                  <MonitoringStatusTable table={craneStatusTable} />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>

            <ResizableHandle />

            <ResizablePanel
              defaultSize="350px"
              minSize="150px"
              maxSize="500px"
              groupResizeBehavior="preserve-pixel-size"
            >
              <aside
                className={cn(
                  panelSurfaceClass,
                  'grid h-full min-h-0 grid-rows-[minmax(212px,32vh)_minmax(0,1fr)]',
                )}
              >
                {renderRightPanel(activeMenu)}
              </aside>
            </ResizablePanel>
          </ResizablePanelGroup>
        </SidebarInset>
      </SidebarProvider>
    </main>
  );
}
