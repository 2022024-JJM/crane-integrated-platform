import {
  Camera,
  ScanLine,
  Wifi,
  WifiOff,
  Maximize2,
  Activity,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import { GoliathLidarPointCloud } from './goliath-lidar-point-cloud';

export const CAMERA_CHANNELS = [
  {
    id: 'cam-1',
    label: 'CAM 1',
    description: '호이스트 상부',
    connected: true,
  },
  { id: 'cam-2', label: 'CAM 2', description: '트롤리 전방', connected: true },
  { id: 'cam-3', label: 'CAM 3', description: '레일 좌측', connected: false },
] as const;

type ExpandedView = { type: 'camera'; id: string } | { type: 'lidar' } | null;

// 작은 카메라 타일 (하단 스트립용)
function CameraTile({
  channel,
  isActive,
  onExpand,
}: {
  channel: (typeof CAMERA_CHANNELS)[number];
  isActive: boolean;
  onExpand: () => void;
}) {
  return (
    <div
      className={cn(
        'group relative flex flex-1 cursor-pointer flex-col overflow-hidden rounded-lg border transition-all',
        isActive
          ? 'border-orange-500/60 ring-1 ring-orange-500/30'
          : 'border-border/40 hover:border-border/70',
        !channel.connected && 'opacity-60',
      )}
      onClick={onExpand}
    >
      {/* Camera feed area */}
      <div className="relative flex-1 bg-zinc-800">
        {/* 스캔라인 */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,1) 3px,rgba(0,0,0,1) 4px)',
          }}
        />
        {/* Corner brackets */}
        {(
          [
            'top-1 left-1 border-t border-l',
            'top-1 right-1 border-t border-r',
            'bottom-1 left-1 border-b border-l',
            'bottom-1 right-1 border-b border-r',
          ] as const
        ).map((cls, i) => (
          <div
            key={i}
            className={cn('absolute size-2 border-orange-500/50', cls)}
          />
        ))}
        {/* Status dot */}
        <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1">
          {channel.connected ? (
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
            </span>
          ) : (
            <WifiOff className="size-2.5 text-red-400/70" />
          )}
        </div>
        {/* Expand button on hover */}
        <button
          className="absolute top-1 right-1 z-10 hidden rounded p-0.5 text-white/60 group-hover:flex hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
        >
          <Maximize2 className="size-2.5" />
        </button>
        {/* No Signal / No Image 중앙 표시 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          {channel.connected ? (
            <>
              <div className="relative mb-0.5">
                <Camera className="size-4 text-white/80" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-0.5 w-full rotate-45 bg-white/80" />
                </div>
              </div>
              <span className="font-mono text-[8px] font-bold tracking-widest text-white">
                NO IMAGE
              </span>
            </>
          ) : (
            <>
              <WifiOff className="size-4 text-white/80" />
              <span className="font-mono text-[8px] font-bold tracking-widest text-white">
                NO SIGNAL
              </span>
            </>
          )}
        </div>
      </div>
      {/* Label bar */}
      <div className="bg-background/90 flex items-center justify-between px-1.5 py-0.5">
        <span
          className={cn(
            'text-[9px] font-bold tracking-wider',
            isActive ? 'text-orange-500' : 'text-muted-foreground',
          )}
        >
          {channel.label}
        </span>
        <span className="text-muted-foreground/60 text-[8px]">
          {channel.description}
        </span>
      </div>
    </div>
  );
}

// LiDAR 미니 타일
function LidarTile({
  isActive,
  onExpand,
}: {
  isActive: boolean;
  onExpand: () => void;
}) {
  return (
    <div
      className={cn(
        'group relative flex flex-[1.4] cursor-pointer flex-col overflow-hidden rounded-lg border transition-all',
        isActive
          ? 'border-cyan-500/60 ring-1 ring-cyan-500/30'
          : 'border-border/40 hover:border-border/70',
      )}
      onClick={onExpand}
    >
      <div className="relative flex-1 overflow-hidden bg-zinc-950">
        {/* 실제 3D 포인트 클라우드 미리보기 */}
        <div className="pointer-events-none absolute inset-0">
          <GoliathLidarPointCloud />
        </div>
        {/* 클릭 영역 확보용 투명 overlay */}
        <div className="absolute inset-0" />
        <button
          className="absolute top-1 right-1 z-10 hidden rounded p-0.5 text-white/60 group-hover:flex hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
        >
          <Maximize2 className="size-2.5" />
        </button>
      </div>
      <div className="bg-background/90 flex items-center justify-between px-1.5 py-0.5">
        <span
          className={cn(
            'flex items-center gap-1 text-[9px] font-bold tracking-wider',
            isActive ? 'text-cyan-500' : 'text-muted-foreground',
          )}
        >
          <ScanLine className="size-2" />
          LiDAR
        </span>
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-[7px] text-amber-600 dark:text-amber-400"
        >
          준비중
        </Badge>
      </div>
    </div>
  );
}

// 확장 카메라 뷰
export function ExpandedCameraView({
  channel,
  onClose,
}: {
  channel: (typeof CAMERA_CHANNELS)[number];
  onClose: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-orange-500/40 bg-zinc-950 shadow-xl">
      {/* Scanline */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,1) 2px,rgba(255,255,255,1) 4px)',
        }}
      />
      {/* Corner brackets */}
      {(
        [
          'top-3 left-3 border-t-2 border-l-2',
          'top-3 right-3 border-t-2 border-r-2',
          'bottom-3 left-3 border-b-2 border-l-2',
          'bottom-3 right-3 border-b-2 border-r-2',
        ] as const
      ).map((cls, i) => (
        <div
          key={i}
          className={cn('absolute size-5 border-orange-500/60', cls)}
        />
      ))}
      {/* HUD top */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-2">
          {channel.connected ? (
            <>
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-red-500" />
              </span>
              <span className="text-[10px] font-bold tracking-widest text-red-400">
                REC
              </span>
            </>
          ) : (
            <>
              <WifiOff className="size-3 text-red-400" />
              <span className="text-[10px] font-bold tracking-widest text-red-400">
                NO SIGNAL
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Wifi
              className={cn(
                'size-3',
                channel.connected ? 'text-emerald-400' : 'text-red-400',
              )}
            />
            <span className="font-mono text-[10px] text-white/60">
              {channel.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] text-white/50 hover:bg-white/10 hover:text-white"
          >
            ✕ 닫기
          </button>
        </div>
      </div>
      {/* Main area */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-3">
        {channel.connected ? (
          <>
            <div className="relative flex items-center justify-center">
              <div className="animation-duration-[3s] absolute size-24 animate-ping rounded-full border border-orange-500/15" />
              <div className="animation-duration-[2s] absolute size-14 animate-ping rounded-full border border-orange-500/25" />
              <Camera className="relative size-10 text-orange-500/30" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs font-medium text-white/50">
                {channel.description}
              </p>
              <p className="text-[10px] text-white/30">
                카메라 피드 연결 대기중
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <WifiOff className="size-10 text-red-500/30" />
            <p className="text-xs text-white/30">카메라 오프라인</p>
          </div>
        )}
      </div>
      {/* HUD bottom */}
      <div className="relative z-10 flex items-center justify-between px-4 pb-3">
        <span className="font-mono text-[9px] text-white/30">
          GC-04 · {channel.description}
        </span>
        <div className="flex items-center gap-1.5">
          <Activity className="size-2.5 text-emerald-400/50" />
          <span className="font-mono text-[9px] text-white/30">— fps</span>
        </div>
      </div>
    </div>
  );
}

// 확장 LiDAR 뷰
export function ExpandedLidarView({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-cyan-500/40 bg-zinc-950 shadow-xl">
      {/* Sweep line */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-0.5 animate-[lidar-sweep_3s_ease-in-out_infinite] bg-linear-to-b from-cyan-400/50 to-transparent"
          style={{ boxShadow: '0 0 12px 2px oklch(70% 0.2 200 / 0.3)' }}
        />
      </div>
      {/* HUD top */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-2">
          <ScanLine className="size-3.5 text-cyan-500" />
          <span className="text-[10px] font-bold tracking-wider text-cyan-400">
            LiDAR POINT CLOUD
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] text-white/50 hover:bg-white/10 hover:text-white"
        >
          ✕ 닫기
        </button>
      </div>
      {/* Point cloud visualization */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-4">
        <div className="relative flex items-center justify-center">
          <div className="absolute size-32 rounded-full border border-cyan-500/10" />
          <div className="absolute size-20 rounded-full border border-cyan-500/15" />
          <div className="absolute size-10 rounded-full border border-cyan-500/20" />
          <Crosshair className="relative size-8 text-cyan-500/30" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-500"
          >
            <TriangleAlert className="mr-1 size-3" />
            하드웨어 연결 대기중
          </Badge>
          <p className="text-[10px] text-white/30">
            LiDAR 센서 연결 시 포인트 클라우드 표시
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '스캔 속도', value: '— Hz' },
            { label: '포인트/프레임', value: '—' },
            { label: '감지 범위', value: '— m' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-white/30">{s.label}</span>
              <span className="font-mono text-xs font-bold text-cyan-400/40">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>
      {/* Point cloud bars bottom */}
      <div className="relative z-10 flex items-end gap-px px-6 pb-4">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-cyan-500/20"
            style={{
              height: `${8 + Math.sin(i * 0.5) * 12 + Math.cos(i * 0.9) * 8}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// 타일만 렌더링하는 스트립 (expanded state는 부모에서 관리)
export function GoliathVisionStrip({
  expanded,
  onExpand,
}: {
  expanded: ExpandedView;
  onExpand: (v: ExpandedView) => void;
}) {
  return (
    <div className="flex h-full gap-2">
      {CAMERA_CHANNELS.map((ch) => (
        <CameraTile
          key={ch.id}
          channel={ch}
          isActive={expanded?.type === 'camera' && expanded.id === ch.id}
          onExpand={() =>
            onExpand(
              expanded?.type === 'camera' && expanded.id === ch.id
                ? null
                : { type: 'camera', id: ch.id },
            )
          }
        />
      ))}
      <LidarTile
        isActive={expanded?.type === 'lidar'}
        onExpand={() =>
          onExpand(expanded?.type === 'lidar' ? null : { type: 'lidar' })
        }
      />
    </div>
  );
}

export type { ExpandedView };
