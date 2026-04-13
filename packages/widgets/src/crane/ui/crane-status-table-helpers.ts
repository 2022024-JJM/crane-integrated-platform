import type { WebSocketConnectionState } from '@crane/core/ws';
import {
  formatReplayTimestamp,
  type MonitoringLiveCell,
} from '@crane/domain/monitoring';

export const CRANE_INFO_COLUMN_WIDTH = 220;
export const CRANE_ID_COLUMN_WIDTH = 140;
export const UPDATED_AT_COLUMN_WIDTH = 120;
export const TAG_COLUMN_WIDTH = 180;

export function formatCellValue(value: MonitoringLiveCell['value'] | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}

export function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  return formatReplayTimestamp(value, 'time') ?? '-';
}

export function getConnectionLabel(
  state: WebSocketConnectionState,
  labels: Record<WebSocketConnectionState, string>,
) {
  return labels[state];
}

export function getConnectionClassName(state: WebSocketConnectionState) {
  switch (state) {
    case 'open':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'connecting':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'closing':
      return 'border-slate-400/20 bg-slate-500/10 text-slate-700 dark:text-slate-300';
    case 'closed':
      return 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300';
    case 'idle':
    default:
      return 'border-slate-400/20 bg-slate-500/10 text-slate-700 dark:text-slate-300';
  }
}
