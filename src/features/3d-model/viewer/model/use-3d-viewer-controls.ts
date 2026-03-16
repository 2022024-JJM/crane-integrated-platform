import { useRef, useState } from 'react';
import type { Viewer3dHandle } from './types';

const DEFAULT_ZOOM_PERCENT = 100;

export function use3dViewerControls() {
  const [isDetailView, setIsDetailView] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(DEFAULT_ZOOM_PERCENT);
  const viewerRef = useRef<Viewer3dHandle | null>(null);

  return {
    handleZoomChange: (nextZoomPercent: number) => {
      setZoomPercent(nextZoomPercent);
    },
    isDetailView,
    resetViewer: () => {
      const viewer = viewerRef.current;

      if (!viewer) {
        return;
      }

      viewer.resetView();
      setIsDetailView(false);
    },
    toggleDetailView: () => {
      const viewer = viewerRef.current;

      if (!viewer) {
        return;
      }

      viewer.toggleTopView();
      setIsDetailView((prev) => !prev);
    },
    viewerRef,
    zoomInViewer: () => {
      viewerRef.current?.zoomIn();
    },
    zoomOutViewer: () => {
      viewerRef.current?.zoomOut();
    },
    zoomPercent,
  };
}
