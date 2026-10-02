// 단일/2번/썸네일 모드용 가벼운 HUD.
//
// 표시 정보는 status + total points 정도이며,
// 두 값 모두 zustand subscribe 로 reactive 하게 갱신된다 — 별도 setInterval 불필요 (A7).

import { Activity, ScanLine } from 'lucide-react';
import {
  usePointCloudStreamStore,
  type PointCloudConnectionStatus,
  type PointCloudSensorMode,
} from '../../../model/point-cloud-stream-store';
import { LIDAR_BY_MODE } from '../../vision/types';
import { STATUS_COLOR, STATUS_LABEL } from './status-labels';

interface CompactHudProps {
  mode: PointCloudSensorMode;
  status: PointCloudConnectionStatus;
}

export function CompactHud({ mode, status }: CompactHudProps) {
  // globalFrameCounter 가 매 bundle 마다 +1 되므로 이 subscribe 가 React 측의
  // 자동 갱신 트리거를 제공한다. setInterval tick 은 불필요.
  const frameCounter = usePointCloudStreamStore((s) => s.globalFrameCounter);
  // eslint exhaustive-deps 우회: 값 자체는 안 쓰고 변경 감지 용도.
  void frameCounter;

  const sensors = usePointCloudStreamStore.getState().sensors;
  const s1 = sensors.get(LIDAR_BY_MODE.lidar1.sensorStoreKey);
  const s2 = sensors.get(LIDAR_BY_MODE.lidar2.sensorStoreKey);
  const totalPoints =
    (mode !== 'lidar2' && s1?.parsed?.ok ? s1.parsed.sampledPointCount : 0) +
    (mode !== 'lidar1' && s2?.parsed?.ok ? s2.parsed.sampledPointCount : 0);

  const label =
    mode === 'lidar1'
      ? 'LiDAR 1'
      : mode === 'lidar2'
        ? 'LiDAR 2'
        : 'FUSION';

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute top-3 left-4 flex items-center gap-2">
        <span className="relative flex size-2">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
              status === 'connected' ? 'bg-green-400' : 'bg-cyan-400'
            }`}
          />
          <span
            className={`relative inline-flex size-2 rounded-full ${
              status === 'connected' ? 'bg-green-500' : 'bg-cyan-500'
            }`}
          />
        </span>
        <ScanLine className="size-3 text-cyan-400" />
        <span className="font-mono text-[10px] font-bold tracking-wider text-cyan-400">
          {label} · POINT CLOUD
        </span>
      </div>
      <div className="absolute top-3 right-4 flex items-center gap-2 font-mono text-[10px] text-white/40">
        <Activity className="size-2.5 text-cyan-500/60" />
        <span>{totalPoints.toLocaleString()} pts</span>
      </div>
      <div className="absolute right-4 bottom-3 flex items-center gap-2 font-mono">
        <span className="text-[8px] text-white/25">STATUS</span>
        <span className={`text-[9px] font-bold ${STATUS_COLOR[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>
    </div>
  );
}
