import { ArrowUpRight, Grip, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitoring3dView } from '@crane/features/3d';
import { useRegionActiveAlarmsByCraneId } from '@crane/features/alarm';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  type DashboardPreviewPosition,
  type DashboardPreviewSize,
  clampPreviewPosition,
  getClampedPreviewWidth,
  getPreviewBodyHeight,
  isSamePosition,
} from './dashboard-preview-helpers';

const PREVIEW_ASPECT_RATIO = 16 / 9;

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
  const alarmsByCraneId = useRegionActiveAlarmsByCraneId(regionId);
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
          'pointer-events-auto fixed overflow-hidden rounded-2xl border border-border bg-card/94 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-md',
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
            'border-b border-border bg-muted/80 px-3 py-2.5',
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
              <p className="text-[9px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                {t('dashboard:preview.label')}
              </p>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <Grip className="size-3 shrink-0 text-muted-foreground/50" />
                <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {title}
                </h3>
                <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-semibold tracking-[0.16em] text-cyan-700 dark:text-cyan-100 uppercase">
                  {regionId}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-7 w-7 cursor-pointer rounded-full border-border bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
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
                className="h-7 w-7 cursor-pointer rounded-full border-border bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                aria-label={t('dashboard:preview.close')}
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="p-2.5">
          <div className="relative overflow-hidden rounded-[1.15rem] border border-border bg-background">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-background/45 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
              <span className="rounded-full border border-border bg-muted/80 px-2 py-1 text-[9px] font-semibold tracking-[0.18em] text-muted-foreground uppercase backdrop-blur-sm">
                {t('common:viewer3d.badge')}
              </span>
            </div>
            <div
              className="relative"
              style={{
                height: previewBodyHeight,
              }}
            >
              <Monitoring3dView regionId={regionId} alarmsByCraneId={alarmsByCraneId} alarmHighlightMesh={regionId === 'dock-in'} />
            </div>
            <button
              type="button"
              aria-label={t('common:viewer3d.resizePreview')}
              className="absolute right-2 bottom-2 z-20 h-5 w-5 cursor-nwse-resize rounded-sm border border-border bg-muted/80 text-muted-foreground backdrop-blur-sm transition hover:bg-muted hover:text-foreground"
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
