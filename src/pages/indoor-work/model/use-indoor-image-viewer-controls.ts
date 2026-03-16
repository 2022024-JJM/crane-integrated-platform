import { useState } from 'react';

const DEFAULT_ZOOM_PERCENT = 100;
const VIEWER_ZOOM_MIN = 60;
const VIEWER_ZOOM_MAX = 200;
const VIEWER_ZOOM_STEP = 10;

export function useIndoorImageViewerControls() {
  const [isDetailView, setIsDetailView] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(DEFAULT_ZOOM_PERCENT);

  return {
    isDetailView,
    resetViewer: () => {
      setZoomPercent(DEFAULT_ZOOM_PERCENT);
      setIsDetailView(false);
    },
    toggleDetailView: () => setIsDetailView((prev) => !prev),
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
