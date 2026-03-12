import { useEffect, useRef, useState } from 'react';

import type { IndoorMenuKey } from '@/pages/indoor-work/model/types';

const COLLAPSED_SIDEBAR_WIDTH = 64;
const DEFAULT_LEFT_PANEL_WIDTH = 200;
const DEFAULT_RIGHT_PANEL_WIDTH = 350;
const DEFAULT_ZOOM_PERCENT = 100;
const LEFT_PANEL_MIN_WIDTH = 120;
const LEFT_PANEL_MAX_WIDTH = 320;
const RIGHT_PANEL_MIN_WIDTH = 220;
const RIGHT_PANEL_MAX_WIDTH = 420;
const VIEWER_MIN_HEIGHT = 260;
const VIEWER_DEFAULT_MIN_HEIGHT = 320;
const VIEWER_BOTTOM_MIN_HEIGHT = 160;
const VIEWER_ZOOM_MIN = 60;
const VIEWER_ZOOM_MAX = 200;
const VIEWER_ZOOM_STEP = 10;

type DraggingPanel = 'bottom' | 'left' | 'right' | null;

export function useIndoorWorkLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState<IndoorMenuKey>(
    'realtime-monitoring',
  );
  const [leftPanelWidth, setLeftPanelWidth] = useState(
    DEFAULT_LEFT_PANEL_WIDTH,
  );
  const [rightPanelWidth, setRightPanelWidth] = useState(
    DEFAULT_RIGHT_PANEL_WIDTH,
  );
  const [viewerHeight, setViewerHeight] = useState(0);
  const [zoomPercent, setZoomPercent] = useState(DEFAULT_ZOOM_PERCENT);
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [draggingPanel, setDraggingPanel] = useState<DraggingPanel>(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const viewerPanelRef = useRef<HTMLElement | null>(null);
  const viewerFrameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!draggingPanel) {
      return;
    }

    const handlePointerMove = (event: MouseEvent) => {
      const layoutElement = layoutRef.current;
      if (!layoutElement) {
        return;
      }

      const rect = layoutElement.getBoundingClientRect();

      if (draggingPanel === 'left' && !isSidebarCollapsed) {
        setLeftPanelWidth(
          Math.min(
            Math.max(event.clientX - rect.left, LEFT_PANEL_MIN_WIDTH),
            LEFT_PANEL_MAX_WIDTH,
          ),
        );
      }

      if (draggingPanel === 'right') {
        setRightPanelWidth(
          Math.min(
            Math.max(rect.right - event.clientX, RIGHT_PANEL_MIN_WIDTH),
            RIGHT_PANEL_MAX_WIDTH,
          ),
        );
      }

      if (draggingPanel === 'bottom') {
        const viewerPanelElement = viewerPanelRef.current;
        if (!viewerPanelElement) {
          return;
        }

        const viewerRect = viewerPanelElement.getBoundingClientRect();
        const nextHeight = Math.min(
          Math.max(event.clientY - viewerRect.top - 42, VIEWER_MIN_HEIGHT),
          viewerRect.height - VIEWER_BOTTOM_MIN_HEIGHT,
        );

        setViewerHeight(nextHeight);
      }
    };

    const handlePointerUp = () => setDraggingPanel(null);

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [draggingPanel, isSidebarCollapsed]);

  useEffect(() => {
    const viewerPanelElement = viewerPanelRef.current;
    if (!viewerPanelElement || viewerHeight > 0) {
      return;
    }

    const updateDefaultViewerHeight = () => {
      const panelHeight = viewerPanelElement.getBoundingClientRect().height;
      setViewerHeight(Math.max(panelHeight - 240, VIEWER_DEFAULT_MIN_HEIGHT));
    };

    updateDefaultViewerHeight();
    window.addEventListener('resize', updateDefaultViewerHeight);

    return () => {
      window.removeEventListener('resize', updateDefaultViewerHeight);
    };
  }, [viewerHeight]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsViewerFullscreen(
        document.fullscreenElement === viewerFrameRef.current,
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleViewerFullscreen = async () => {
    const viewerFrameElement = viewerFrameRef.current;
    if (!viewerFrameElement) {
      return;
    }

    if (document.fullscreenElement === viewerFrameElement) {
      await document.exitFullscreen();
      return;
    }

    await viewerFrameElement.requestFullscreen();
  };

  return {
    activeMenu,
    isDetailView,
    isSidebarCollapsed,
    isViewerFullscreen,
    layoutGridTemplateColumns: `${
      isSidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : leftPanelWidth
    }px 8px minmax(0, 1fr) 8px ${rightPanelWidth}px`,
    layoutRef,
    viewerFrameRef,
    viewerGridTemplateRows:
      viewerHeight > 0
        ? `42px minmax(0, ${viewerHeight}px) 8px minmax(270px, 1fr)`
        : '42px minmax(0,1fr) 8px minmax(270px,26vh)',
    viewerPanelRef,
    viewerScale: zoomPercent / 100,
    zoomPercent,
    resetViewer: () => {
      setZoomPercent(DEFAULT_ZOOM_PERCENT);
      setIsDetailView(false);
    },
    setActiveMenu,
    startBottomResize: () => setDraggingPanel('bottom'),
    startLeftResize: () => {
      if (!isSidebarCollapsed) {
        setDraggingPanel('left');
      }
    },
    startRightResize: () => setDraggingPanel('right'),
    toggleDetailView: () => setIsDetailView((prev) => !prev),
    toggleSidebar: () => setIsSidebarCollapsed((prev) => !prev),
    toggleViewerFullscreen,
    zoomInViewer: () => {
      setZoomPercent((prev) =>
        Math.min(prev + VIEWER_ZOOM_STEP, VIEWER_ZOOM_MAX),
      );
    },
    zoomOutViewer: () => {
      setZoomPercent((prev) =>
        Math.max(prev - VIEWER_ZOOM_STEP, VIEWER_ZOOM_MIN),
      );
    },
  };
}
