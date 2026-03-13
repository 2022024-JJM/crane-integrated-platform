import '@/pages/indoor-work/ui/indoor-work-page.css';

import {
  IndoorWorkRightPanel,
  panelSurfaceClass,
} from '@/entities/indoor-work';
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
import { IndoorWorkViewerPanel } from '@/features/3d-model/ui/indoor-work-viewer-panel';

export function IndoorWorkPage() {
  const TEXT = {
    liveConnected: '온라인',
  } as const;

  const { hmsLabel } = useClock();
  const { siteLabel, temperatureLabel, weatherLabel } = useSiteWeather({
    regionName: '부산',
  });
  const {
    isCompactLayout,
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

  return (
    <main className="outdoor-work-page flex h-screen flex-col overflow-hidden">
      <SidebarProvider defaultOpen={false} className="flex flex-col">
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

        <MonitoringMenu
          title="내업"
          menuItems={INDOOR_WORK_MENU_ITEMS}
          activeMenu={activeMenu}
          onSelectMenu={setActiveMenu}
        />

        <SidebarInset className="min-h-0 flex-1 bg-transparent">
          <ResizablePanelGroup
            orientation="horizontal"
            className="min-h-0 flex-1"
          >
            <ResizablePanel minSize="40%">
              <IndoorWorkViewerPanel
                activeMenu={activeMenu}
                isCompactLayout={isCompactLayout}
                isDetailView={isDetailView}
                isViewerFullscreen={isViewerFullscreen}
                viewerFrameRef={viewerFrameRef}
                viewerScale={viewerScale}
                zoomPercent={zoomPercent}
                onResetViewer={resetViewer}
                onToggleDetailView={toggleDetailView}
                onToggleFullscreen={toggleViewerFullscreen}
                onZoomIn={zoomInViewer}
                onZoomOut={zoomOutViewer}
              />
            </ResizablePanel>

            <ResizableHandle />

            <ResizablePanel
              defaultSize="350px"
              minSize="220px"
              maxSize="420px"
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
