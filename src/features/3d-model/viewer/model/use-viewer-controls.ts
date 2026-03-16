import { useEffect, useRef, useState } from 'react';

export function useViewerControls() {
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
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
    isViewerFullscreen,
    toggleViewerFullscreen,
    viewerFrameRef,
  };
}
