import '@/pages/indoor-work/ui/indoor-work-page.css';

import {
  INDOOR_WORK_BOTTOM_PANEL_TABLE_MAP,
  IndoorWorkRightPanel,
  panelSurfaceClass,
} from '@/entities/indoor-work';
import { MonitoringStatusTable } from '@/entities/monitoring/crane-status';
import { useIndoorWorkLayout } from '@/features/indoor-work-layout';
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
import { useMonitoringMenu } from '@/entities/monitoring/menu/model/use-monitoring-menu';
import { MonitoringMenu } from '@/entities/monitoring/menu/ui/monitoring-menu';
import { INDOOR_WORK_MENU_ITEMS } from '@/entities/monitoring/menu/model/indoor-work-content';
import {
  Topbar,
  TopbarBrand,
  TopbarContent,
} from '@/shared/ui/organisms/topbar';
import { Clock3, CloudSun, RadioTower } from 'lucide-react';
import { HanwhaIcon } from '@/shared/ui/atoms/hanwha-icon';
import { Brand } from '@/shared/ui/molecules/brand';
import { TopStatusCard } from '@/shared/ui/molecules/top-status-card';
import { ModeToggle } from '@/features/theme-toggle/ui/mode-toggle';
import { useClock } from '@/shared/hooks/use-clock';
import { useSiteWeather } from '@/shared/hooks/use-site-weather';
import { Link } from 'react-router-dom';
import { ViewerControls } from '@/features/3d-model/viewer/ui/viewer-controls';

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
  } = useIndoorWorkLayout();
  const { activeMenu, setActiveMenu } = useMonitoringMenu();
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
          title="내업"
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
                <IndoorWorkRightPanel activeMenu={activeMenu} />
              </aside>
            </ResizablePanel>
          </ResizablePanelGroup>
        </SidebarInset>
      </SidebarProvider>
    </main>
  );
}
