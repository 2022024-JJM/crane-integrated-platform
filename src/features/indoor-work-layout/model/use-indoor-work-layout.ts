import { useEffect, useRef, useState } from 'react';

const DEFAULT_ZOOM_PERCENT = 100;
const VIEWER_ZOOM_MIN = 60;
const VIEWER_ZOOM_MAX = 200;
const VIEWER_ZOOM_STEP = 10;

export function useIndoorWorkLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [zoomPercent, setZoomPercent] = useState(DEFAULT_ZOOM_PERCENT);
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const viewerFrameRef = useRef<HTMLDivElement | null>(null);

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
    isDetailView,
    isSidebarCollapsed,
    isViewerFullscreen,
    resetViewer: () => {
      setZoomPercent(DEFAULT_ZOOM_PERCENT);
      setIsDetailView(false);
    },
    setSidebarCollapsed: setIsSidebarCollapsed,
    toggleDetailView: () => setIsDetailView((prev) => !prev),
    toggleViewerFullscreen,
    viewerFrameRef,
    viewerScale: zoomPercent / 100,
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
    zoomPercent,
  };
}
