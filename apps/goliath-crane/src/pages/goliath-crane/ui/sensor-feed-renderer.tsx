import { Camera, Radar, WifiOff } from 'lucide-react';
import type { SensorFeedContext } from '@crane/features/3d';
import { CAMERA_CHANNELS } from './vision/types';

/**
 * 빌보드 미니 썸네일 / PiP 안에 들어갈 비전 피드를 그린다.
 *
 * 현재는 mock placeholder만 그리지만, 실제 스트림 연결 시 channelId →
 * 스트림 URL 매핑을 만들고 여기서 <video> / hls.js / WebRTC / WebSocket
 * 포인트클라우드 등을 렌더하면 features 레이어 코드는 그대로 둔 채 실시간
 * 영상이 들어온다.
 *
 * size prop으로 빌보드 미니 썸네일과 PiP 풀뷰를 구분할 수 있다.
 */
export function renderSensorFeed(ctx: SensorFeedContext) {
  const { channelId, sensorType, size } = ctx;

  if (sensorType === 'lidar') {
    return <LidarFeedPlaceholder size={size} />;
  }

  const channel = CAMERA_CHANNELS.find((c) => c.id === channelId);
  const connected = channel?.connected ?? false;
  return <CameraFeedPlaceholder connected={connected} size={size} />;
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

function LidarFeedPlaceholder({ size }: { size: 'thumbnail' | 'full' }) {
  const isThumb = size === 'thumbnail';
  const iconSize = isThumb ? 'size-4' : 'size-10';
  const textSize = isThumb ? 'text-[7px]' : 'text-sm';

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-950">
      {/* radar grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, rgba(196,181,253,0.5) 0, rgba(196,181,253,0.5) 1px, transparent 1px), radial-gradient(circle at center, rgba(196,181,253,0.3) 0, rgba(196,181,253,0.3) 1px, transparent 1px)',
          backgroundSize: '20% 20%, 40% 40%',
          backgroundPosition: 'center',
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <Radar className={`${iconSize} text-violet-300/80`} />
        <span
          className={`${textSize} font-mono font-bold tracking-[0.2em] text-violet-200/85`}
        >
          POINT CLOUD
        </span>
      </div>
    </div>
  );
}
