import {
  Camera,
  Radio,
  Wifi,
  WifiOff,
  Maximize2,
  ScanLine,
  Crosshair,
  Activity,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';

// 카메라 채널 목록
const CAMERA_CHANNELS = [
  {
    id: 'cam-1',
    label: 'CAM 1',
    description: '호이스트 상부',
    connected: true,
  },
  { id: 'cam-2', label: 'CAM 2', description: '트롤리 전방', connected: true },
  { id: 'cam-3', label: 'CAM 3', description: '레일 좌측', connected: false },
  { id: 'cam-4', label: 'CAM 4', description: '지상 조감', connected: true },
] as const;

// LiDAR 상태 패널
function LidarStatusPanel() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
      <div className="flex items-center gap-2">
        <ScanLine className="size-3.5 text-cyan-500" />
        <span className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
          LiDAR
        </span>
        <Badge
          variant="outline"
          className="ml-auto border-cyan-500/30 bg-cyan-500/10 text-[9px] text-cyan-600 dark:text-cyan-400"
        >
          준비중
        </Badge>
      </div>
      <div className="space-y-1.5">
        {[
          { label: '스캔 속도', value: '—' },
          { label: '포인트 클라우드', value: '—' },
          { label: '감지 범위', value: '—' },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-muted-foreground text-[10px]">
              {item.label}
            </span>
            <span className="text-foreground/50 text-[10px] font-medium tabular-nums">
              {item.value}
            </span>
          </div>
        ))}
      </div>
      {/* Point cloud preview placeholder */}
      <div className="bg-background/60 relative mt-1 flex h-24 items-center justify-center overflow-hidden rounded-md border border-cyan-500/20">
        <div className="absolute inset-0 flex items-end justify-center">
          {/* Simulated scan lines */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="mx-px w-1 rounded-t-sm bg-cyan-500/20"
              style={{
                height: `${20 + Math.sin(i * 0.7) * 15 + Math.cos(i * 1.2) * 10}%`,
              }}
            />
          ))}
        </div>
        <div className="relative flex flex-col items-center gap-1">
          <Crosshair className="size-4 text-cyan-500/40" />
          <span className="text-[9px] text-cyan-500/50">LiDAR 연결 대기중</span>
        </div>
      </div>
    </div>
  );
}

// 카메라 채널 선택 버튼
function CameraChannelButton({
  channel,
  isSelected,
  onSelect,
}: {
  channel: (typeof CAMERA_CHANNELS)[number];
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex flex-1 flex-col items-center rounded-md border px-1 py-1.5 transition-all',
        isSelected
          ? 'border-orange-500/50 bg-orange-500/10'
          : 'border-border/50 bg-muted/20 hover:bg-muted/40',
        !channel.connected && 'opacity-50',
      )}
    >
      <div className="relative">
        <Camera
          className={cn(
            'size-3',
            isSelected ? 'text-orange-500' : 'text-muted-foreground',
          )}
        />
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 size-1.5 rounded-full',
            channel.connected ? 'bg-emerald-500' : 'bg-red-400',
          )}
        />
      </div>
      <span
        className={cn(
          'mt-0.5 text-[9px] font-semibold',
          isSelected ? 'text-orange-500' : 'text-muted-foreground',
        )}
      >
        {channel.label}
      </span>
    </button>
  );
}

// 메인 카메라 뷰 (placeholder)
function CameraFeedPlaceholder({
  channel,
}: {
  channel: (typeof CAMERA_CHANNELS)[number];
}) {
  return (
    <div className="border-border/50 relative flex h-full w-full flex-col overflow-hidden rounded-lg border bg-zinc-950">
      {/* Scanline overlay effect */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 4px)',
        }}
      />
      {/* Corner brackets */}
      {[
        'top-2 left-2 border-t-2 border-l-2',
        'top-2 right-2 border-t-2 border-r-2',
        'bottom-2 left-2 border-b-2 border-l-2',
        'bottom-2 right-2 border-b-2 border-r-2',
      ].map((cls, i) => (
        <div
          key={i}
          className={cn('absolute size-4 border-orange-500/60', cls)}
        />
      ))}

      {/* Status HUD - top */}
      <div className="absolute top-3 left-4 z-20 flex items-center gap-2">
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
      <div className="absolute top-3 right-4 z-20 flex items-center gap-2">
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

      {/* Center content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        {channel.connected ? (
          <>
            {/* Simulated camera noise / placeholder */}
            <div className="relative flex items-center justify-center">
              <div className="absolute size-20 animate-ping rounded-full border border-orange-500/20 [animation-duration:3s]" />
              <div className="absolute size-12 animate-ping rounded-full border border-orange-500/30 [animation-duration:2s]" />
              <Camera className="relative size-8 text-orange-500/40" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-[11px] font-medium text-white/50">
                {channel.description}
              </p>
              <p className="text-[10px] text-white/30">
                카메라 피드 연결 대기중
              </p>
            </div>
          </>
        ) : (
          <>
            <WifiOff className="size-8 text-red-500/40" />
            <p className="text-[11px] text-white/30">카메라 오프라인</p>
          </>
        )}
      </div>

      {/* Bottom HUD */}
      <div className="absolute right-0 bottom-3 left-0 z-20 flex items-center justify-between px-4">
        <span className="font-mono text-[9px] text-white/30">
          GC-04 · {channel.description}
        </span>
        <div className="flex items-center gap-1">
          <Activity className="size-2.5 text-emerald-400/60" />
          <span className="font-mono text-[9px] text-white/30">— fps</span>
        </div>
      </div>
    </div>
  );
}

export function GoliathVisionViewer() {
  const [selectedCam, setSelectedCam] = useState<string>('cam-1');
  const selectedChannel =
    CAMERA_CHANNELS.find((c) => c.id === selectedCam) ?? CAMERA_CHANNELS[0];

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden p-2">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2">
        <Radio className="size-3.5 text-(--hanwha-orange-100)" />
        <span className="text-xs font-semibold">Vision Viewer</span>
        <Badge
          variant="outline"
          className="ml-auto border-amber-500/30 bg-amber-500/10 text-[9px] text-amber-600 dark:text-amber-400"
        >
          HW 준비중
        </Badge>
        <button className="text-muted-foreground hover:text-foreground ml-1 rounded-md p-0.5">
          <Maximize2 className="size-3" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 gap-2">
        {/* Main camera view */}
        <div className="min-h-0 flex-1">
          <CameraFeedPlaceholder channel={selectedChannel} />
        </div>

        {/* Right sidebar: channel selection + LiDAR */}
        <div className="flex w-28 shrink-0 flex-col gap-2">
          {/* Camera channel selector */}
          <div className="border-border/50 bg-muted/10 flex flex-col gap-1.5 rounded-lg border p-2">
            <span className="text-muted-foreground text-[10px] font-medium">
              카메라 채널
            </span>
            <div className="grid grid-cols-2 gap-1">
              {CAMERA_CHANNELS.map((ch) => (
                <CameraChannelButton
                  key={ch.id}
                  channel={ch}
                  isSelected={selectedCam === ch.id}
                  onSelect={() => setSelectedCam(ch.id)}
                />
              ))}
            </div>
          </div>

          {/* LiDAR panel */}
          <LidarStatusPanel />
        </div>
      </div>
    </div>
  );
}
