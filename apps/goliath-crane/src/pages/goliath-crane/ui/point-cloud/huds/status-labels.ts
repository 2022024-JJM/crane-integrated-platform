import type { PointCloudConnectionStatus } from '../../../model/point-cloud-stream-store';

export const STATUS_LABEL: Record<PointCloudConnectionStatus, string> = {
  idle: 'IDLE',
  connecting: 'CONNECTING',
  connected: 'LIVE',
  error: 'ERROR',
  closed: 'DISCONNECTED',
};

export const STATUS_COLOR: Record<PointCloudConnectionStatus, string> = {
  idle: 'text-white/40',
  connecting: 'text-yellow-400/70',
  connected: 'text-green-400',
  error: 'text-red-400/70',
  closed: 'text-red-400/70',
};

export const CONNECTION_PILL_CLASS: Record<PointCloudConnectionStatus, string> =
  {
    idle: 'border-white/20 text-white/50',
    connecting: 'border-amber-400/40 text-amber-300',
    connected: 'border-emerald-400/40 text-emerald-300',
    error: 'border-rose-400/40 text-rose-300',
    closed: 'border-rose-400/40 text-rose-300',
  };
