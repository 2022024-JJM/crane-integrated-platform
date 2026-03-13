import '@/pages/indoor-work/ui/indoor-work-page.css';

import type { CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';

import {
  IndoorWorkRightPanel,
  panelSurfaceClass,
} from '@/entities/indoor-work';
import { IndoorWorkHeader } from '@/features/indoor-work-header';
import { useIndoorWorkLayout } from '@/features/indoor-work-layout';
import { IndoorWorkViewerPanel } from '@/features/indoor-work-monitoring-viewer';
import { cn } from '@/shared/lib/utils';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/shared/ui/organisms/resizable';
import { SidebarInset, SidebarProvider } from '@/shared/ui/organisms/sidebar';
import { useMonitoringMenu } from '@/entities/monitoring/menu/model/use-monitoring-menu';
import { MonitoringMenu } from '@/entities/monitoring/menu/ui/monitoring-menu';
import { INDOOR_WORK_MENU_ITEMS } from '@/entities/monitoring/menu/model/indoor-work-content';

const INDOOR_SIDEBAR_STYLE = {
  '--sidebar-width': '200px',
  '--sidebar-width-icon': '64px',
} as CSSProperties & Record<'--sidebar-width' | '--sidebar-width-icon', string>;

export function IndoorWorkPage() {
  const location = useLocation();
  const regionName = (location.state as { regionName?: string } | null)
    ?.regionName;
  const {
    isCompactLayout,
    isDetailView,
    isSidebarCollapsed,
    isViewerFullscreen,
    resetViewer,
    setSidebarCollapsed,
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
    <main className="outdoor-work-page h-screen overflow-hidden">
      <IndoorWorkHeader regionName={regionName} />

      <SidebarProvider
        open={!isSidebarCollapsed}
        onOpenChange={(open) => setSidebarCollapsed(!open)}
        className="h-[calc(100vh-52px)] min-h-0"
        style={INDOOR_SIDEBAR_STYLE}
      >
        <MonitoringMenu
          title="내업"
          menuItems={INDOOR_WORK_MENU_ITEMS}
          activeMenu={activeMenu}
          onSelectMenu={setActiveMenu}
        />

        <SidebarInset className="min-h-0 bg-transparent">
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
