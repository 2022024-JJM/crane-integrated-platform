import { FileQuestion, Maximize, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { AssetPreviewMode } from '@crane/domain/asset-library';
import { Button } from '@crane/ui/atoms/button';
import {
  actualSizeDrawingView,
  fitDrawingView,
  zoomDrawingAt,
  type DrawingView,
  type Size,
} from '../lib/drawing-view';

const ZOOM_STEP = 1.25;
const WHEEL_ZOOM_STEP = 1.12;

interface AssetDrawingViewerProps {
  url: string;
  mode: Exclude<AssetPreviewMode, 'model' | 'environment'>;
  fileName: string;
  titleBlock?: ReactNode;
}

/**
 * 도면 뷰어. 그림(png·jpg·webp·svg)은 확대·이동하며 보고, PDF 는 브라우저
 * 내장 뷰어에 맡긴다. dxf·dwg 는 미리보기가 없어 내려받아 연다.
 */
export function AssetDrawingViewer({
  url,
  mode,
  fileName,
  titleBlock,
}: AssetDrawingViewerProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="bg-muted/40 relative min-h-0 flex-1">
        {mode === 'image' ? (
          <ImageCanvas key={url} url={url} alt={fileName} />
        ) : mode === 'pdf' ? (
          <iframe
            title={fileName}
            src={url}
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <FileQuestion className="text-muted-foreground size-7" />
            <p className="text-foreground text-sm font-medium">
              {t('asset-library:drawing.noPreview')}
            </p>
            <p className="text-muted-foreground max-w-sm text-xs">
              {t('asset-library:drawing.noPreviewHint')}
            </p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={url} download={fileName} />}
            >
              {t('asset-library:action.download')}
            </Button>
          </div>
        )}
      </div>
      {titleBlock}
    </div>
  );
}

function ImageCanvas({ url, alt }: { url: string; alt: string }) {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [content, setContent] = useState<Size | null>(null);
  const [view, setView] = useState<DrawingView>({ x: 0, y: 0, scale: 1 });
  const [failed, setFailed] = useState(false);
  const dragRef = useRef<{ x: number; y: number; pointerId: number } | null>(
    null,
  );

  const viewportSize = (): Size => ({
    width: viewportRef.current?.clientWidth ?? 0,
    height: viewportRef.current?.clientHeight ?? 0,
  });

  // 휠 확대는 페이지 스크롤을 막아야 해서 passive 가 아닌 리스너로 건다
  // (React 의 onWheel 은 passive 라 preventDefault 가 듣지 않는다).
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      setView((current) =>
        zoomDrawingAt(
          current,
          event.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP,
          point,
        ),
      );
    };
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, []);

  const zoomBy = (factor: number) => {
    const size = viewportSize();
    setView((current) =>
      zoomDrawingAt(current, factor, {
        x: size.width / 2,
        y: size.height / 2,
      }),
    );
  };

  return (
    <>
      <div
        ref={viewportRef}
        className="absolute inset-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            x: event.clientX,
            y: event.clientY,
            pointerId: event.pointerId,
          };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const dx = event.clientX - drag.x;
          const dy = event.clientY - drag.y;
          dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
          setView((current) => ({
            ...current,
            x: current.x + dx,
            y: current.y + dy,
          }));
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        {failed ? (
          <p className="text-muted-foreground absolute inset-0 flex items-center justify-center text-xs">
            {t('asset-library:drawing.loadFailed')}
          </p>
        ) : (
          <img
            src={url}
            alt={alt}
            draggable={false}
            className="absolute top-0 left-0 max-w-none origin-top-left bg-white select-none"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              visibility: content ? 'visible' : 'hidden',
            }}
            onLoad={(event) => {
              const size = {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              };
              setContent(size);
              setView(fitDrawingView(viewportSize(), size));
            }}
            onError={() => setFailed(true)}
          />
        )}
      </div>

      <div className="border-border bg-background/90 absolute right-3 bottom-3 flex items-center gap-0.5 rounded-md border p-0.5 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t('asset-library:drawing.zoomOut')}
          onClick={() => zoomBy(1 / ZOOM_STEP)}
        >
          <Minus />
        </Button>
        <button
          type="button"
          aria-label={t('asset-library:drawing.actualSize')}
          title={t('asset-library:drawing.actualSize')}
          onClick={() => {
            if (content) setView(actualSizeDrawingView(viewportSize(), content));
          }}
          className="text-foreground hover:bg-muted focus-visible:ring-ring/50 h-6 w-12 cursor-pointer rounded text-[11px] tabular-nums outline-none focus-visible:ring-2"
        >
          {Math.round(view.scale * 100)}%
        </button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t('asset-library:drawing.zoomIn')}
          onClick={() => zoomBy(ZOOM_STEP)}
        >
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t('asset-library:drawing.fit')}
          onClick={() => {
            if (content) setView(fitDrawingView(viewportSize(), content));
          }}
        >
          <Maximize />
        </Button>
      </div>
    </>
  );
}
