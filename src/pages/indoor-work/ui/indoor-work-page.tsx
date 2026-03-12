import '@/pages/indoor-work/ui/indoor-work-page.css';

import { useLocation } from 'react-router-dom';

import { resolveIndoorSidebarTitle } from '@/pages/indoor-work/config/indoor-work-content';
import { useIndoorWorkClock } from '@/pages/indoor-work/model/use-indoor-work-clock';
import { useIndoorWorkLayout } from '@/pages/indoor-work/model/use-indoor-work-layout';
import { IndoorWorkRightPanel } from '@/pages/indoor-work/ui/indoor-work-right-panel';
import {
  panelSurfaceClass,
  resizeGripClass,
  resizeHandleClass,
} from '@/pages/indoor-work/ui/indoor-work-page.styles';
import { IndoorWorkSidebar } from '@/pages/indoor-work/ui/indoor-work-sidebar';
import { IndoorWorkTopBar } from '@/pages/indoor-work/ui/indoor-work-top-bar';
import { IndoorWorkViewerPanel } from '@/pages/indoor-work/ui/indoor-work-viewer-panel';
import { useSiteWeather } from '@/shared/hooks/use-site-weather';
import { cn } from '@/shared/lib/utils';

export function IndoorWorkPage() {
  const location = useLocation();
  const regionName = (location.state as { regionName?: string } | null)
    ?.regionName;
  const sidebarTitle = resolveIndoorSidebarTitle(regionName);
  const { dateTime, clockLabel } = useIndoorWorkClock();
  const { siteLabel, temperatureLabel, weatherLabel } = useSiteWeather({
    regionName,
  });
  const {
    activeMenu,
    isDetailView,
    isSidebarCollapsed,
    isViewerFullscreen,
    layoutGridTemplateColumns,
    layoutRef,
    resetViewer,
    setActiveMenu,
    startBottomResize,
    startLeftResize,
    startRightResize,
    toggleDetailView,
    toggleSidebar,
    toggleViewerFullscreen,
    viewerFrameRef,
    viewerGridTemplateRows,
    viewerPanelRef,
    viewerScale,
    zoomInViewer,
    zoomOutViewer,
    zoomPercent,
  } = useIndoorWorkLayout();

  return (
    <main className="outdoor-work-page h-screen overflow-hidden">
      <IndoorWorkTopBar
        clockLabel={clockLabel}
        dateTime={dateTime}
        siteLabel={siteLabel}
        temperatureLabel={temperatureLabel}
        weatherLabel={weatherLabel}
      />

      <div
        ref={layoutRef}
        className="grid h-[calc(100vh-52px)] min-h-0 max-[1080px]:block max-[1080px]:h-auto"
        style={{ gridTemplateColumns: layoutGridTemplateColumns }}
      >
        <aside className={panelSurfaceClass}>
          <IndoorWorkSidebar
            activeMenu={activeMenu}
            isCollapsed={isSidebarCollapsed}
            sidebarTitle={sidebarTitle}
            onSelectMenu={setActiveMenu}
            onToggleCollapse={toggleSidebar}
          />
        </aside>

        <div
          className={cn(
            resizeHandleClass,
            'w-2 min-w-2 cursor-col-resize max-[1080px]:hidden',
          )}
          role="separator"
          aria-orientation="vertical"
          aria-label="좌측 패널 크기 조절"
          onMouseDown={startLeftResize}
        >
          <div className={cn(resizeGripClass, 'h-11 w-3')}>⋮</div>
        </div>

        <IndoorWorkViewerPanel
          activeMenu={activeMenu}
          isDetailView={isDetailView}
          isViewerFullscreen={isViewerFullscreen}
          viewerFrameRef={viewerFrameRef}
          viewerGridTemplateRows={viewerGridTemplateRows}
          viewerPanelRef={viewerPanelRef}
          viewerScale={viewerScale}
          zoomPercent={zoomPercent}
          onResetViewer={resetViewer}
          onStartBottomResize={startBottomResize}
          onToggleDetailView={toggleDetailView}
          onToggleFullscreen={toggleViewerFullscreen}
          onZoomIn={zoomInViewer}
          onZoomOut={zoomOutViewer}
        />

        <div
          className={cn(
            resizeHandleClass,
            'w-2 min-w-2 cursor-col-resize max-[1080px]:hidden',
          )}
          role="separator"
          aria-orientation="vertical"
          aria-label="우측 패널 크기 조절"
          onMouseDown={startRightResize}
        >
          <div className={cn(resizeGripClass, 'h-11 w-3')}>⋮</div>
        </div>

        <aside
          className={cn(
            panelSurfaceClass,
            'grid h-full min-h-0 grid-rows-[minmax(212px,32vh)_minmax(0,1fr)] max-[1080px]:grid-rows-none',
          )}
        >
          <IndoorWorkRightPanel activeMenu={activeMenu} />
        </aside>
      </div>
    </main>
  );
}
