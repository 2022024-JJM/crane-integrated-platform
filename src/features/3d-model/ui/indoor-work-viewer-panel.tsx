import {
  Gauge,
  Maximize2,
  Minimize2,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { RefObject } from 'react';

import {
  INDOOR_WORK_LOWER_PANEL_TITLE_MAP,
  INDOOR_WORK_TEXT,
  INDOOR_WORK_VIEWER_SUBTITLE_MAP,
  IndoorWorkBottomPanel,
  type IndoorMenuKey,
  viewerControlClass,
} from '@/entities/indoor-work';
import { cn } from '@/shared/lib/utils';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/shared/ui/organisms/resizable';

interface IndoorWorkViewerPanelProps {
  activeMenu: IndoorMenuKey;
  isCompactLayout: boolean;
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
  activeMenu,
  isCompactLayout,
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
    <section className="outdoor-work-page-viewer-panel flex h-full min-h-0 min-w-0 flex-col border-r border-r-[var(--outdoor-page-panel-border)]">
      <div className="flex items-center justify-between gap-3 border-b border-b-[var(--outdoor-page-panel-border)] px-3.5">
        <div className="flex min-w-0 items-center gap-2.5 max-[720px]:flex-wrap">
          <div className="h-[22px] w-[3px] rounded-full bg-[linear-gradient(180deg,var(--outdoor-page-accent-line-start),var(--outdoor-page-accent-line-end))]" />
          <h1 className="m-0 text-[18px] font-bold tracking-[0.04em] text-[var(--outdoor-page-viewer-title)] max-[1280px]:text-[20px] max-[720px]:text-[18px]">
            {INDOOR_WORK_TEXT.viewerTitle}
          </h1>
          <div className="text-[14px] text-[var(--outdoor-page-viewer-subtitle)] max-[720px]:w-full max-[720px]:text-[12px]">
            {INDOOR_WORK_VIEWER_SUBTITLE_MAP[activeMenu]}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--outdoor-page-zoom-chip-border)] bg-[var(--outdoor-page-zoom-chip-bg)] px-2.5 py-[5px] font-mono text-[12px] font-bold text-[var(--outdoor-page-zoom-chip-text)]">
          {zoomPercent}%
        </div>
      </div>

      {isCompactLayout ? (
        <>
          <div
            ref={viewerFrameRef}
            className={cn(
              'relative min-h-[260px] flex-1 overflow-hidden',
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
            <ViewerCanvas
              isDetailView={isDetailView}
              viewerScale={viewerScale}
            />
          </div>

          <div className="min-h-0 flex-col overflow-auto border-t border-t-[var(--outdoor-page-panel-border)] bg-[var(--outdoor-page-lower-panel-bg)]">
            <LowerPanel activeMenu={activeMenu} />
          </div>
        </>
      ) : (
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
              <ViewerCanvas
                isDetailView={isDetailView}
                viewerScale={viewerScale}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel
            defaultSize="28%"
            minSize="160px"
            className="min-h-0 overflow-auto border-t border-t-[var(--outdoor-page-panel-border)] bg-[var(--outdoor-page-lower-panel-bg)]"
          >
            <LowerPanel activeMenu={activeMenu} />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </section>
  );
}

interface ViewerControlsProps {
  isDetailView: boolean;
  isViewerFullscreen: boolean;
  onResetViewer: () => void;
  onToggleDetailView: () => void;
  onToggleFullscreen: () => void | Promise<void>;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

function ViewerControls({
  isDetailView,
  isViewerFullscreen,
  onResetViewer,
  onToggleDetailView,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
}: ViewerControlsProps) {
  return (
    <div className="absolute top-3 left-3 z-[2] flex gap-2">
      <button
        type="button"
        className={viewerControlClass}
        aria-label="기본 시점으로 이동"
        onClick={onResetViewer}
      >
        <Search size={15} />
      </button>
      <button
        type="button"
        className={viewerControlClass}
        aria-label="확대"
        onClick={onZoomIn}
      >
        <ZoomIn size={15} />
      </button>
      <button
        type="button"
        className={viewerControlClass}
        aria-label="축소"
        onClick={onZoomOut}
      >
        <ZoomOut size={15} />
      </button>
      <button
        type="button"
        className={viewerControlClass}
        aria-label={isDetailView ? '기본 보기' : '상세 보기'}
        onClick={onToggleDetailView}
      >
        <Gauge size={15} />
      </button>
      <button
        type="button"
        className={viewerControlClass}
        aria-label={isViewerFullscreen ? '전체화면 종료' : '전체화면'}
        onClick={() => {
          void onToggleFullscreen();
        }}
      >
        {isViewerFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </button>
    </div>
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
