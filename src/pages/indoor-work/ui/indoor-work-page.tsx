import '@/pages/indoor-work/ui/indoor-work-page.css';

import {
  AlarmStatsSection,
  AlarmTableSection,
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
} from '@/entities/monitoring/operation';
import { useViewerControls, ViewerControls } from '@/features/3d-model/viewer';
import { ModeToggle } from '@/features/theme-toggle';
import {
  INDOOR_WORK_BOTTOM_PANEL_TABLE_MAP,
  INDOOR_WORK_MENU_ITEMS,
  INDOOR_WORK_MENU_TITLE,
} from '@/pages/indoor-work/model/indoor-work-content';
import { useIndoorWorkMenu } from '@/pages/indoor-work/model/use-indoor-work-menu';
import { cn } from '@/shared/lib/utils';
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
import { panelSurfaceClass } from './indoor-work-page-styles';

function renderRightPanel(activeMenu: MonitoringMenuKey) {
  if (activeMenu === 'operation-info') {
    return (
      <>
        <OperationInfoCardsSection />
        <OperationInfoNotesSection />
      </>
    );
  }

  if (activeMenu === 'operation-status') {
    return (
      <>
        <OperationStatusCardsSection />
        <OperationStatusSummarySection />
      </>
    );
  }

  return (
    <>
      <AlarmStatsSection />
      <AlarmTableSection />
    </>
  );
}

export function IndoorWorkPage() {
  const TEXT = {
    liveConnected: '온라인',
  } as const;
  const { hmsLabel } = useClock();
  const { siteLabel, temperatureLabel, weatherLabel } = useSiteWeather({
    regionName: '부산',
  });
  const {
    isDetailView,
    isViewerFullscreen,
    resetViewer,
    toggleDetailView,
    toggleViewerFullscreen,
    viewerFrameRef,
    viewerScale,
    zoomInViewer,
    zoomOutViewer,
    zoomPercent,
  } = useViewerControls();
  const { activeMenu, setActiveMenu } = useIndoorWorkMenu();
  const craneStatusTable = INDOOR_WORK_BOTTOM_PANEL_TABLE_MAP[activeMenu];

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
          title={INDOOR_WORK_MENU_TITLE}
          menuItems={INDOOR_WORK_MENU_ITEMS}
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
                      isDetailView={isDetailView}
                      isViewerFullscreen={isViewerFullscreen}
                      onResetViewer={resetViewer}
                      onToggleDetailView={toggleDetailView}
                      onToggleFullscreen={toggleViewerFullscreen}
                      onZoomIn={zoomInViewer}
                      onZoomOut={zoomOutViewer}
                    />
                    <div className="absolute right-3 bottom-3 z-2 font-mono text-[12px] font-bold text-amber-400">
                      {zoomPercent}%
                    </div>
                    {/* 애니메이션 화면 */}
                    <div className="h-full min-h-0 border-x border-x-[rgba(255,166,0,0.06)] bg-[rgba(43,43,43)]">
                      <div className="flex h-full w-full items-center justify-center overflow-auto">
                        <img
                          src="/images/indoor-work.png"
                          alt="실내 작업 뷰"
                          className={cn(
                            'object-contain transition-transform duration-200',
                            isDetailView
                              ? 'h-full max-h-none w-full max-w-none'
                              : 'h-auto max-h-[85%] w-auto max-w-[85%]',
                          )}
                          style={{ transform: `scale(${viewerScale})` }}
                        />
                      </div>
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
