import type { WebSocketConnectionState } from '@crane/core/ws';
import {
  formatReplayTimestamp,
  type MonitoringLiveCell,
  type MonitoringLiveTableDisplayColumn,
  type MonitoringLiveTableStatusBehavior,
} from '@crane/domain/monitoring';

export const CRANE_INFO_COLUMN_WIDTH = 84;
export const GROUP_HEADER_HEIGHT = 28;
export const DETAIL_HEADER_HEIGHT = 38;

export type StatusDotTone = 'positive' | 'negative' | 'warning' | 'neutral';

export function getColumnWidth(column: MonitoringLiveTableDisplayColumn) {
  switch (column.cellKind) {
    case 'statusDot':
      return 54;
    case 'numeric':
      return 74;
    case 'text':
    default:
      return 96;
  }
}

export function getAlignmentClassName(
  align: MonitoringLiveTableDisplayColumn['align'],
) {
  switch (align) {
    case 'left':
      return 'text-left';
    case 'right':
      return 'text-right';
    case 'center':
    default:
      return 'text-center';
  }
}

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
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'connecting':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'closing':
      return 'border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300';
    case 'closed':
      return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300';
    case 'idle':
    default:
      return 'border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300';
  }
}

function parseBooleanLike(value: MonitoringLiveCell['value'] | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'on', 'yes', 'y', 'ok', 'normal'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'off', 'no', 'n'].includes(normalized)) {
    return false;
  }

  return null;
}

export function getStatusDotTone(
  value: MonitoringLiveCell['value'] | undefined,
  statusBehavior: MonitoringLiveTableStatusBehavior = 'positiveWhenTrue',
): StatusDotTone {
  const isActive = parseBooleanLike(value);

  if (isActive === null) {
    return 'neutral';
  }

  if (isActive) {
    switch (statusBehavior) {
      case 'negativeWhenTrue':
        return 'negative';
      case 'warningWhenTrue':
        return 'warning';
      case 'positiveWhenTrue':
      default:
        return 'positive';
    }
  }

  if (statusBehavior === 'positiveWhenTrue') {
    return 'negative';
  }

  return 'positive';
}

export function getStatusDotClassName(tone: StatusDotTone) {
  switch (tone) {
    case 'positive':
      return 'bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.4)]';
    case 'negative':
      return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.38)]';
    case 'warning':
      return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.38)]';
    case 'neutral':
    default:
      return 'bg-slate-500/60 shadow-none';
  }
}
