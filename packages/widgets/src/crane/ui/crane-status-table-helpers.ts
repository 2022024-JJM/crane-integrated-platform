import {
  type MonitoringLiveCell,
  type MonitoringLiveTableDisplayColumn,
  type MonitoringLiveTableStatusBehavior,
} from '@crane/domain/monitoring';
import { getFormatLocale } from '@crane/core/config/i18n';

export const CRANE_INFO_COLUMN_WIDTH = 84;
export const GROUP_HEADER_HEIGHT = 28;
export const DETAIL_HEADER_HEIGHT = 38;

export type StatusDotTone = 'positive' | 'negative' | 'warning' | 'neutral';
export type ConnectionBadgeState = 'connected' | 'connecting' | 'closed';

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

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

const KOREA_TIME_ZONE = 'Asia/Seoul';
const ISO_TIMESTAMP_WITH_OFFSET_PATTERN =
  /(?:Z|[+-]\d{2}:\d{2})$/i;
const ISO_TIMESTAMP_WITHOUT_OFFSET_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;

function formatTimeInKoreaTimeZone(value: string, language: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(getFormatLocale(language), {
    timeZone: KOREA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(parsedDate);
}

function formatTimeWithoutOffset(value: string) {
  const match = value.match(ISO_TIMESTAMP_WITHOUT_OFFSET_PATTERN);

  if (!match) {
    return null;
  }

  const [, , , , hour, minute, second = '00'] = match;

  return `${hour}:${minute}:${second}`;
}

export function formatTimestamp(
  value: string | null | undefined,
  language: string,
) {
  if (!value) {
    return '-';
  }

  if (ISO_TIMESTAMP_WITH_OFFSET_PATTERN.test(value)) {
    return formatTimeInKoreaTimeZone(value, language) ?? '-';
  }

  return formatTimeWithoutOffset(value) ?? '-';
}

export function getConnectionLabel(
  state: ConnectionBadgeState,
  labels: Record<ConnectionBadgeState, string>,
) {
  return labels[state];
}

export function getConnectionClassName(state: ConnectionBadgeState) {
  switch (state) {
    case 'connected':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'connecting':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'closed':
    default:
      return 'border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300';
  }
}

function parseBooleanLike(value: MonitoringLiveCell['value'] | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
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
