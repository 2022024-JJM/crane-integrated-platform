import { Camera, WifiOff } from 'lucide-react';
import type { SensorFeedContext } from '@crane/features/3d';
import { CAMERA_CHANNELS, type LidarSensorKey } from './vision/types';
import { PointCloudViewer } from './point-cloud-viewer';

/**
 * 빌보드 미니 썸네일 / PiP 안에 들어갈 비전 피드를 그린다.
 *
 * LiDAR는 LiDAR Edge Node Bridge Server 의 ProcessedPointCloudBundle 스트림을
 * PointCloudViewer 로 렌더한다. 서버 vendor (SOSLAB/OUSTER/SICK 등) 와 무관하게
 * 동일한 포맷이며, WebSocket 은 point-cloud-stream-store 가 단일하게 관리하므로
 * 같은 페이지에 미니 썸네일/PiP/타일이 동시에 마운트돼도 연결은 1개.
 *
 * 카메라는 아직 mock placeholder. 실제 스트림 연결 시 channelId → 스트림 URL
 * 매핑을 만들고 여기서 <video> / hls.js / WebRTC 등을 렌더하면 features
 * 레이어 코드는 그대로 둔 채 실시간 영상이 들어온다.
 */

const CHANNEL_TO_SENSOR: Record<string, LidarSensorKey> = {
  'soslab-1': 'soslab1',
  'soslab-2': 'soslab2',
  'soslab-fusion': 'fusion',
};

export function renderSensorFeed(ctx: SensorFeedContext) {
  const { channelId, sensorType } = ctx;

  if (sensorType === 'lidar') {
    const mode: LidarSensorKey = CHANNEL_TO_SENSOR[channelId] ?? 'fusion';
    return <PointCloudViewer mode={mode} compact={ctx.size === 'thumbnail'} />;
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
