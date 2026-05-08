import { Camera, WifiOff } from 'lucide-react';
import type { SensorFeedContext } from '@crane/features/3d';
import { CAMERA_CHANNELS } from './vision/types';
import { GoliathLidarPointCloud } from './goliath-lidar-point-cloud';

/**
 * 빌보드 미니 썸네일 / PiP 안에 들어갈 비전 피드를 그린다.
 *
 * LiDAR는 미니/풀 모두 실제 GoliathLidarPointCloud를 직접 렌더한다 — 호버로
 * 미니카드가 마운트되는 시점에 WebSocket이 열리고, 호버가 풀려 카드가
 * unmount되면 끊긴다 (use-lidar-websocket cleanup이 처리).
 *
 * 카메라는 아직 mock placeholder. 실제 스트림 연결 시 channelId → 스트림 URL
 * 매핑을 만들고 여기서 <video> / hls.js / WebRTC 등을 렌더하면 features
 * 레이어 코드는 그대로 둔 채 실시간 영상이 들어온다.
 */
export function renderSensorFeed(ctx: SensorFeedContext) {
  const { channelId, sensorType } = ctx;

  if (sensorType === 'lidar') {
    return <GoliathLidarPointCloud compact={ctx.size === 'thumbnail'} />;
  }

  const channel = CAMERA_CHANNELS.find((c) => c.id === channelId);
  const connected = channel?.connected ?? false;
  return <CameraFeedPlaceholder connected={connected} size={ctx.size} />;
}

function CameraFeedPlaceholder({
  connected,
  size,
}: {
  connected: boolean;
  size: 'thumbnail' | 'full';
}) {
  const isThumb = size === 'thumbnail';
  const iconSize = isThumb ? 'size-4' : 'size-10';
  const textSize = isThumb ? 'text-[7px]' : 'text-sm';

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-900">
      {/* 노이즈 결 */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '3px 3px',
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        {connected ? (
          <>
            <div className="relative">
              <Camera className={`${iconSize} text-white/80`} />
              <div
                aria-hidden
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="h-px w-full rotate-45 bg-white/70" />
              </div>
            </div>
            <span
              className={`${textSize} font-mono font-bold tracking-[0.2em] text-white/85`}
            >
              NO IMAGE
            </span>
          </>
        ) : (
          <>
            <WifiOff className={`${iconSize} text-red-300/80`} />
            <span
              className={`${textSize} font-mono font-bold tracking-[0.2em] text-red-300/85`}
            >
              OFFLINE
            </span>
          </>
        )}
      </div>
    </div>
  );
}
