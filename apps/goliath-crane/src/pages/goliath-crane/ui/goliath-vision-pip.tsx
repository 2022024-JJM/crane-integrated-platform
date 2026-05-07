import { Camera, Grip, Wifi, WifiOff, Activity, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  type DashboardPreviewPosition,
  type DashboardPreviewSize,
  clampPreviewPosition,
  getClampedPreviewWidth,
  getPreviewBodyHeight,
  getDashboardPreviewDefaultPosition,
  getDashboardPreviewDefaultSize,
  isSamePosition,
} from '@crane/core/lib/preview-helpers';
import type { CameraChannel, ExpandedView } from './vision/types';
import { GoliathLidarPointCloud } from './goliath-lidar-point-cloud';

const PREVIEW_ASPECT_RATIO = 16 / 9;

// ── 실시간 타임스탬프 ─────────────────────────────────────────────────────────
function LiveTimestamp() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="font-mono text-[10px] text-white/50">
      {now.getFullYear()}-{pad(now.getMonth() + 1)}-{pad(now.getDate())}{' '}
      {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
    </span>
  );
}

// ── SVG 노이즈 패턴 (No Signal 배경) ─────────────────────────────────────────
function NoSignalNoise() {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      className="absolute inset-0 h-full w-full opacity-[0.07]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id={`noise-${id}`}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.65"
          numOctaves="3"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#noise-${id})`} />
    </svg>
  );
}

// ── Camera feed content — CCTV No Signal 스타일 ───────────────────────────────
function CameraFeedContent({ channel }: { channel: CameraChannel }) {
  const { t } = useTranslation('goliath-crane');
  return (
    <div className="relative flex h-full w-full overflow-hidden bg-zinc-800">
      {/* TV 노이즈 배경 */}
      <NoSignalNoise />

      {/* 스캔라인 오버레이 */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,1) 3px,rgba(0,0,0,1) 4px)',
        }}
      />

      {/* 상단 HUD 바 */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-linear-to-b from-black/70 to-transparent px-3 py-2">
        <div className="flex items-center gap-2">
          {/* 채널 뱃지 */}
          <span className="rounded bg-white/10 px-1.5 py-px font-mono text-[10px] font-bold text-white/80">
            CH {channel.label.replace('CAM ', '')}
          </span>
          <span className="text-[10px] text-white/50">
            {t(channel.descriptionKey)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {channel.connected ? (
            <>
              <Wifi className="size-3 text-emerald-400/70" />
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-red-500" />
              </span>
              <span className="font-mono text-[10px] font-bold tracking-widest text-red-400">
                REC
              </span>
            </>
          ) : (
            <>
              <WifiOff className="size-3 text-red-400/70" />
              <span className="font-mono text-[10px] font-bold text-red-400/80">
                OFFLINE
              </span>
            </>
          )}
        </div>
      </div>

      {/* 중앙 No Signal 표시 */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
        {channel.connected ? (
          /* 연결은 됐지만 피드 없음 — NO IMAGE */
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Camera className="size-10 text-white/90" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-0.5 w-full rotate-45 bg-white" />
              </div>
            </div>
            <span className="font-mono text-sm font-bold tracking-[0.25em] text-white">
              NO IMAGE
            </span>
            <span className="text-[10px] text-white/60">신호 대기중</span>
          </div>
        ) : (
          /* 오프라인 */
          <div className="flex flex-col items-center gap-2">
            <WifiOff className="size-10 text-white/90" />
            <span className="font-mono text-sm font-bold tracking-[0.25em] text-white">
              NO SIGNAL
            </span>
            <span className="text-[10px] text-white/60">카메라 오프라인</span>
          </div>
        )}
      </div>

      {/* 하단 HUD 바 */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between bg-linear-to-t from-black/70 to-transparent px-3 py-2">
        <span className="font-mono text-[9px] text-white/40">
          GC-04 · {channel.label}
        </span>
        <div className="flex items-center gap-2">
          <LiveTimestamp />
          <div className="flex items-center gap-1">
            <Activity className="size-2.5 text-white/20" />
            <span className="font-mono text-[9px] text-white/25">0 fps</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LiDAR feed content — 실제 3D 포인트 클라우드 (목업) ────────────────────────
function LidarFeedContent() {
  return <GoliathLidarPointCloud />;
}

// ── PiP shell (드래그·리사이즈) ───────────────────────────────────────────────
interface GoliathVisionPipProps {
  expanded: ExpandedView;
  channels: readonly CameraChannel[];
  onClose: () => void;
}

export function GoliathVisionPip({
  expanded,
  channels,
  onClose,
}: GoliathVisionPipProps) {
  const { t } = useTranslation('goliath-crane');
  const [position, setPosition] = useState<DashboardPreviewPosition>(() =>
    getDashboardPreviewDefaultPosition(),
  );
  const [size, setSize] = useState<DashboardPreviewSize>(() =>
    getDashboardPreviewDefaultSize(),
  );
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
      if (typeof window === 'undefined') return nextPosition;
      return clampPreviewPosition(
        nextPosition,
        width,
        window.innerWidth,
        window.innerHeight,
      );
    },
    [],
  );

  // Reset position when a new item is expanded
  useEffect(() => {
    if (!expanded) return;
    const next = getDashboardPreviewDefaultPosition();
    const nextSize = getDashboardPreviewDefaultSize();
    setPosition(next);
    setSize(nextSize);
    setLocalPosition(next);
    setLocalSize(nextSize);
    latestPositionRef.current = next;
    latestSizeRef.current = nextSize;
  }, [
    expanded?.type,
    expanded?.type === 'camera' ? (expanded as { id: string }).id : '',
  ]);

  useEffect(() => {
    latestPositionRef.current = position;
    latestSizeRef.current = size;
    if (!isDragging && !isResizing) {
      setLocalPosition(position);
      setLocalSize(size);
    }
  }, [isDragging, isResizing, position, size]);

  useEffect(() => {
    if (!expanded) return;
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
      if (size.width !== nextWidth) setSize({ width: nextWidth });
      if (!isSamePosition(position, nextPosition)) setPosition(nextPosition);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampToViewport, expanded, position, size.width]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;
    const handlePointerMove = (event: PointerEvent) => {
      if (isDragging) {
        const dragOffset = dragOffsetRef.current;
        if (!dragOffset) return;
        latestPositionRef.current = clampToViewport(
          { x: event.clientX - dragOffset.x, y: event.clientY - dragOffset.y },
          latestSizeRef.current.width,
        );
      } else if (isResizing) {
        const resizeStart = resizeStartRef.current;
        if (!resizeStart) return;
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
      if (frameRef.current !== null) return;
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
      if (size.width !== latestSizeRef.current.width)
        setSize(latestSizeRef.current);
      if (!isSamePosition(position, latestPositionRef.current))
        setPosition(latestPositionRef.current);
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
  }, [clampToViewport, isDragging, isResizing, position, size.width]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null)
        window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  if (!expanded) return null;

  const channel =
    expanded.type === 'camera'
      ? channels.find((c) => c.id === expanded.id)
      : undefined;
  const isCamera = expanded.type === 'camera' && channel !== undefined;
  const isLidar = expanded.type === 'lidar';
  const pipTitle = isCamera ? channel.label : 'LiDAR';
  const pipSub = isCamera ? t(channel.descriptionKey) : 'Point Cloud';
  const accentColor = isCamera ? 'border-orange-500/30' : 'border-cyan-500/30';
  const badgeColor = isCamera
    ? 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400'
    : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400';

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div
        className={cn(
          'bg-card/94 pointer-events-auto fixed overflow-hidden rounded-2xl border shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-md',
          accentColor,
          isDragging || isResizing ? 'select-none' : '',
        )}
        style={{
          width: localSize.width,
          left: localPosition.x,
          top: localPosition.y,
        }}
      >
        {/* Glow blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className={cn(
              'absolute -top-12 left-6 h-24 w-24 rounded-full blur-2xl',
              isCamera ? 'bg-orange-400/10' : 'bg-cyan-400/12',
            )}
          />
          <div
            className={cn(
              'absolute right-5 -bottom-10 h-28 w-28 rounded-full blur-2xl',
              isCamera ? 'bg-orange-400/8' : 'bg-cyan-400/10',
            )}
          />
        </div>

        {/* Drag handle / header */}
        <div
          className={cn(
            'border-border bg-muted/80 border-b px-3 py-2.5',
            isDragging ? 'cursor-grabbing' : 'cursor-grab',
          )}
          onPointerDown={(event) => {
            if (event.button !== 0 || isResizing) return;
            dragOffsetRef.current = {
              x: event.clientX - localPosition.x,
              y: event.clientY - localPosition.y,
            };
            latestPositionRef.current = localPosition;
            setIsDragging(true);
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Grip className="text-muted-foreground/50 size-3 shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground text-[9px] font-semibold tracking-[0.2em] uppercase">
                  Vision Viewer
                </p>
                <div className="mt-0.5 flex min-w-0 items-center gap-2">
                  <h3 className="text-foreground truncate text-sm font-semibold tracking-tight">
                    {pipTitle}
                  </h3>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.16em] uppercase',
                      badgeColor,
                    )}
                  >
                    {pipSub}
                  </span>
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="border-border bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground h-7 w-7 cursor-pointer rounded-full"
              aria-label="닫기"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-2.5">
          <div className="border-border bg-background relative overflow-hidden rounded-[1.15rem] border">
            <div className="from-background/40 pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-linear-to-b to-transparent" />
            <div className="relative" style={{ height: previewBodyHeight }}>
              {isCamera && channel && <CameraFeedContent channel={channel} />}
              {isLidar && <LidarFeedContent />}
            </div>
            {/* Resize handle */}
            <button
              type="button"
              aria-label="크기 조절"
              className="border-border bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground absolute right-2 bottom-2 z-20 h-5 w-5 cursor-nwse-resize rounded-sm border backdrop-blur-sm transition"
              onPointerDown={(event) => {
                if (event.button !== 0 || isDragging) return;
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
