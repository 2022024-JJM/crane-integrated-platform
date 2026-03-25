import { ArrowUpRight, Grip, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitoring3dView } from '@/features/3d';
import { useProgressNavigate } from '@/shared/lib/use-progress-navigate';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/atoms/button';

const PREVIEW_MARGIN = 24;
const PREVIEW_MAX_WIDTH = 460;
const PREVIEW_MIN_WIDTH = 320;
const PREVIEW_ASPECT_RATIO = 16 / 9;
const PREVIEW_HEADER_HEIGHT = 58;

export interface DashboardPreviewPosition {
  x: number;
  y: number;
}

export interface DashboardPreviewSize {
  width: number;
}

interface DashboardRegionPreviewModalProps {
  open: boolean;
  regionId: string;
  title: string;
  navigateTo: string;
  position: DashboardPreviewPosition;
  size: DashboardPreviewSize;
  onPositionChange: (position: DashboardPreviewPosition) => void;
  onSizeChange: (size: DashboardPreviewSize) => void;
  onClose: () => void;
}

function getDefaultPreviewWidth(viewportWidth: number) {
  return Math.min(
    PREVIEW_MAX_WIDTH,
    Math.max(PREVIEW_MIN_WIDTH, Math.floor(viewportWidth * 0.4)),
  );
}

function getPreviewBodyHeight(width: number) {
  return Math.round(width / PREVIEW_ASPECT_RATIO);
}

function getPreviewHeight(width: number) {
  return getPreviewBodyHeight(width) + PREVIEW_HEADER_HEIGHT;
}

function clampPreviewWidth(width: number, viewportWidth: number) {
  const maxWidth = Math.max(
    PREVIEW_MIN_WIDTH,
    viewportWidth - PREVIEW_MARGIN * 2,
  );

  return Math.min(Math.max(width, PREVIEW_MIN_WIDTH), maxWidth);
}

function getClampedPreviewWidth(width: number) {
  if (typeof window === 'undefined') {
    return width;
  }

  return clampPreviewWidth(width, window.innerWidth);
}

function getPreviewFrameHeight(width: number) {
  return Math.round(width / PREVIEW_ASPECT_RATIO) + PREVIEW_HEADER_HEIGHT;
}

function clampPreviewPosition(
  position: DashboardPreviewPosition,
  width: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const previewWidth = clampPreviewWidth(width, viewportWidth);
  const previewHeight = getPreviewFrameHeight(previewWidth);
  const maxX = Math.max(
    PREVIEW_MARGIN,
    viewportWidth - previewWidth - PREVIEW_MARGIN,
  );
  const maxY = Math.max(
    PREVIEW_MARGIN,
    viewportHeight - previewHeight - PREVIEW_MARGIN,
  );

  return {
    x: Math.min(Math.max(position.x, PREVIEW_MARGIN), maxX),
    y: Math.min(Math.max(position.y, PREVIEW_MARGIN), maxY),
  };
}

function isSamePosition(
  current: DashboardPreviewPosition,
  next: DashboardPreviewPosition,
) {
  return current.x === next.x && current.y === next.y;
}

export function getDashboardPreviewDefaultPosition(): DashboardPreviewPosition {
  if (typeof window === 'undefined') {
    return { x: PREVIEW_MARGIN, y: PREVIEW_MARGIN };
  }

  const previewWidth = getDefaultPreviewWidth(window.innerWidth);
  const previewHeight = getPreviewHeight(previewWidth);

  return {
    x: Math.max(
      PREVIEW_MARGIN,
      window.innerWidth - previewWidth - PREVIEW_MARGIN,
    ),
    y: Math.max(
      PREVIEW_MARGIN,
      window.innerHeight - previewHeight - PREVIEW_MARGIN,
    ),
  };
}

export function getDashboardPreviewDefaultSize(): DashboardPreviewSize {
  if (typeof window === 'undefined') {
    return { width: PREVIEW_MAX_WIDTH };
  }

  return {
    width: getDefaultPreviewWidth(window.innerWidth),
  };
}

export function DashboardRegionPreviewModal({
  open,
  regionId,
  title,
  navigateTo,
  position,
  size,
  onPositionChange,
  onSizeChange,
  onClose,
}: DashboardRegionPreviewModalProps) {
  const { t } = useTranslation();
  const navigate = useProgressNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localPosition, setLocalPosition] = useState(position);
  const [localSize, setLocalSize] = useState(size);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const resizeStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    width: number;
  } | null>(null);
  const frameRef = useRef<number | null>(null);
  const latestPositionRef = useRef(position);
  const latestSizeRef = useRef(size);
  const previewBodyHeight = useMemo(
    () => getPreviewBodyHeight(localSize.width),
    [localSize.width],
  );

  const clampToViewport = useCallback(
    (nextPosition: DashboardPreviewPosition, width: number) => {
      if (typeof window === 'undefined') {
        return nextPosition;
      }

      return clampPreviewPosition(
        nextPosition,
        width,
        window.innerWidth,
        window.innerHeight,
      );
    },
    [],
  );

  useEffect(() => {
    latestPositionRef.current = position;
    latestSizeRef.current = size;

    if (!isDragging && !isResizing) {
      setLocalPosition(position);
      setLocalSize(size);
    }
  }, [isDragging, isResizing, position, size]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleResize = () => {
      const nextWidth = getClampedPreviewWidth(latestSizeRef.current.width);
      const nextPosition = clampToViewport(
        latestPositionRef.current,
        nextWidth,
      );

      latestSizeRef.current = { width: nextWidth };
      latestPositionRef.current = nextPosition;
      setLocalSize({ width: nextWidth });
      setLocalPosition(nextPosition);

      if (size.width !== nextWidth) {
        onSizeChange({ width: nextWidth });
      }

      if (!isSamePosition(position, nextPosition)) {
        onPositionChange(nextPosition);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [clampToViewport, onPositionChange, open, position]);

  useEffect(() => {
    if (!isDragging && !isResizing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (isDragging) {
        const dragOffset = dragOffsetRef.current;
        if (!dragOffset) {
          return;
        }

        latestPositionRef.current = clampToViewport(
          {
            x: event.clientX - dragOffset.x,
            y: event.clientY - dragOffset.y,
          },
          latestSizeRef.current.width,
        );
      } else if (isResizing) {
        const resizeStart = resizeStartRef.current;
        if (!resizeStart) {
          return;
        }

        const deltaX = event.clientX - resizeStart.pointerX;
        const deltaY = event.clientY - resizeStart.pointerY;
        const nextWidth = getClampedPreviewWidth(
          resizeStart.width +
            Math.max(deltaX, Math.round(deltaY * PREVIEW_ASPECT_RATIO)),
        );

        latestSizeRef.current = { width: nextWidth };
        latestPositionRef.current = clampToViewport(
          latestPositionRef.current,
          nextWidth,
        );
      } else {
        return;
      }

      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        setLocalSize(latestSizeRef.current);
        setLocalPosition(latestPositionRef.current);
      });
    };

    const stopPointerInteraction = () => {
      dragOffsetRef.current = null;
      resizeStartRef.current = null;
      setIsDragging(false);
      setIsResizing(false);

      if (size.width !== latestSizeRef.current.width) {
        onSizeChange(latestSizeRef.current);
      }

      if (!isSamePosition(position, latestPositionRef.current)) {
        onPositionChange(latestPositionRef.current);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopPointerInteraction);
    window.addEventListener('pointercancel', stopPointerInteraction);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopPointerInteraction);
      window.removeEventListener('pointercancel', stopPointerInteraction);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [
    clampToViewport,
    isDragging,
    isResizing,
    onPositionChange,
    onSizeChange,
    position,
    size.width,
  ]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  if (!open) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50"
      aria-label={t('dashboard:preview.label')}
    >
      <div
        className={cn(
          'pointer-events-auto fixed overflow-hidden rounded-2xl border border-white/10 bg-[#0b1019]/94 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-md',
          isDragging || isResizing ? 'select-none' : '',
        )}
        style={{
          width: localSize.width,
          left: localPosition.x,
          top: localPosition.y,
        }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 left-6 h-24 w-24 rounded-full bg-cyan-400/14 blur-2xl" />
          <div className="absolute right-5 -bottom-10 h-28 w-28 rounded-full bg-orange-400/10 blur-2xl" />
        </div>

        <div
          className={cn(
            'border-b border-white/10 bg-gradient-to-r from-[#0f1624] via-[#0d1320] to-[#111a29] px-3 py-2.5',
            isDragging ? 'cursor-grabbing' : 'cursor-grab',
          )}
          onPointerDown={(event) => {
            if (event.button !== 0 || isResizing) {
              return;
            }

            dragOffsetRef.current = {
              x: event.clientX - localPosition.x,
              y: event.clientY - localPosition.y,
            };
            latestPositionRef.current = localPosition;
            setIsDragging(true);
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold tracking-[0.2em] text-white/48 uppercase">
                {t('dashboard:preview.label')}
              </p>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <Grip className="size-3 shrink-0 text-white/30" />
                <h3 className="truncate text-sm font-semibold tracking-tight text-white">
                  {title}
                </h3>
                <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-semibold tracking-[0.16em] text-cyan-100 uppercase">
                  {regionId}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-7 w-7 cursor-pointer rounded-full border-white/10 bg-white/6 text-white/75 hover:bg-white/12 hover:text-white"
                aria-label={t('dashboard:preview.openFull')}
                onClick={() => {
                  onClose();
                  navigate(navigateTo);
                }}
              >
                <ArrowUpRight className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-7 w-7 cursor-pointer rounded-full border-white/10 bg-white/6 text-white/75 hover:bg-white/12 hover:text-white"
                aria-label={t('dashboard:preview.close')}
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="p-2.5">
          <div className="relative overflow-hidden rounded-[1.15rem] border border-white/10 bg-slate-950">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-slate-950/45 to-transparent" />
            <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-2">
              <span className="rounded-full border border-white/12 bg-black/35 px-2 py-1 text-[9px] font-semibold tracking-[0.18em] text-white/80 uppercase backdrop-blur-sm">
                3D Viewer
              </span>
            </div>
            <div
              className="relative"
              style={{
                height: previewBodyHeight,
              }}
            >
              <Monitoring3dView regionId={regionId} />
            </div>
            <button
              type="button"
              aria-label="Resize preview"
              className="absolute right-2 bottom-2 z-20 h-5 w-5 cursor-nwse-resize rounded-sm border border-white/10 bg-black/38 text-white/55 backdrop-blur-sm transition hover:bg-black/52 hover:text-white/85"
              onPointerDown={(event) => {
                if (event.button !== 0 || isDragging) {
                  return;
                }

                event.preventDefault();
                event.stopPropagation();
                resizeStartRef.current = {
                  pointerX: event.clientX,
                  pointerY: event.clientY,
                  width: localSize.width,
                };
                latestSizeRef.current = localSize;
                latestPositionRef.current = localPosition;
                setIsResizing(true);
              }}
            >
              <span className="pointer-events-none absolute right-1 bottom-1 h-2.5 w-2.5 border-r border-b border-current" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
