import type { RefObject } from 'react';

import {
  INDOOR_WORK_LOWER_PANEL_TITLE_MAP,
  INDOOR_WORK_TEXT,
  IndoorWorkBottomPanel,
} from '@/entities/indoor-work';
import { cn } from '@/shared/lib/utils';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/shared/ui/organisms/resizable';
import { ViewerControls } from './viewer-controls';

interface IndoorWorkViewerPanelProps {
  isDetailView: boolean;
  isViewerFullscreen: boolean;
  viewerFrameRef: RefObject<HTMLDivElement | null>;
  viewerScale: number;
  zoomPercent: number;
  onResetViewer: () => void;
  onToggleDetailView: () => void;
  onToggleFullscreen: () => void | Promise<void>;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function IndoorWorkViewerPanel({
  isDetailView,
  isViewerFullscreen,
  viewerFrameRef,
  viewerScale,
  zoomPercent,
  onResetViewer,
  onToggleDetailView,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
}: IndoorWorkViewerPanelProps) {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col">
      <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="72%" minSize="260px">
          <div
            ref={viewerFrameRef}
            className={cn(
              'relative h-full min-h-0 overflow-hidden',
              isViewerFullscreen &&
                'bg-[var(--outdoor-page-viewer-fullscreen-bg)]',
            )}
          >
            <ViewerControls
              isDetailView={isDetailView}
              isViewerFullscreen={isViewerFullscreen}
              onResetViewer={onResetViewer}
              onToggleDetailView={onToggleDetailView}
              onToggleFullscreen={onToggleFullscreen}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
            />
            <div className="absolute right-3 bottom-3 z-2 font-mono text-[12px] font-bold text-amber-400">
              {zoomPercent}%
            </div>
            <ViewerCanvas
              isDetailView={isDetailView}
              viewerScale={viewerScale}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  );
}

function ViewerCanvas({
  isDetailView,
  viewerScale,
}: {
  isDetailView: boolean;
  viewerScale: number;
}) {
  return (
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
  );
}

function LowerPanel({ activeMenu }: { activeMenu: IndoorMenuKey }) {
  return (
    <>
      <div className="sticky top-0 z-[1] border-b border-b-[var(--outdoor-page-panel-border-soft)] bg-[var(--outdoor-page-lower-panel-sticky-bg)] px-3 py-2 text-[11px] font-bold tracking-[0.08em] text-[var(--outdoor-page-lower-panel-sticky-text)] uppercase">
        {INDOOR_WORK_LOWER_PANEL_TITLE_MAP[activeMenu]}
      </div>
      <IndoorWorkBottomPanel activeMenu={activeMenu} />
    </>
  );
}
