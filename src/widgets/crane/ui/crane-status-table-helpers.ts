import { tableRowStatusBadgeClassName, tableCategoryClassName } from '@/shared/lib/status-colors';
import { getFormatLocale } from '@/shared/config/i18n';
import type { MonitoringReplayRow } from '@/entities/monitoring';

export const CRANE_COLUMN_WIDTH = 120;
export const TAG_NAME_COLUMN_WIDTH = 320;

export type DateTimeInputElement = HTMLInputElement & {
  showPicker?: () => void;
};

export type SortKey =
  | 'crane'
  | 'tagName'
  | 'value'
  | 'unit'
  | 'category'
  | 'dataType'
  | 'snapshotAt';

export type SortDirection = 'asc' | 'desc';

export interface HeartbeatStatus {
  craneNo: string;
  craneId: string;
  stale: boolean;
}

export function formatValue(value: MonitoringReplayRow['value']) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

export function formatTimestamp(value: string | null, language: string) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString(getFormatLocale(language), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDataType(value: string | null) {
  return value ?? '-';
}

function compareNullableValues(
  left: string | number | null,
  right: string | number | null,
) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function compareDateValues(left: string | null, right: string | null) {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return new Date(left).getTime() - new Date(right).getTime();
}

export function compareRows(
  left: MonitoringReplayRow,
  right: MonitoringReplayRow,
  key: SortKey,
) {
  switch (key) {
    case 'crane':
      return left.craneNo.localeCompare(right.craneNo, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    case 'tagName':
      return left.displayName.localeCompare(right.displayName, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    case 'value':
      return compareNullableValues(left.value, right.value);
    case 'unit':
      return compareNullableValues(left.unit, right.unit);
    case 'category':
      return compareNullableValues(left.category, right.category);
    case 'dataType':
      return compareNullableValues(left.dataType, right.dataType);
    case 'snapshotAt':
      return compareDateValues(left.snapshotAt, right.snapshotAt);
    default:
      return 0;
  }
}

export function getCategoryClassName(category: string) {
  return (
    tableCategoryClassName[category] ??
    'border-slate-400/20 bg-slate-500/10 text-slate-700 dark:text-slate-300'
  );
}

export function buildRowStatuses(row: MonitoringReplayRow) {
  const statuses: Array<{ label: string; tone: keyof typeof tableRowStatusBadgeClassName }> =
    [];

  if (row.alarm) {
    statuses.push({ label: 'Alarm', tone: 'alarm' });
  }

  if (row.stale) {
    statuses.push({ label: 'Stale', tone: 'stale' });
  }

  if (row.changed) {
    statuses.push({ label: 'Changed', tone: 'changed' });
  }

  if (statuses.length === 0) {
    statuses.push({ label: 'Normal', tone: 'normal' });
  }

  return statuses;
}

export function openDateTimePicker(input: DateTimeInputElement | null) {
  if (!input) {
    return;
  }

  input.focus();
  input.showPicker?.();
}

export function buildHeartbeatStatuses(rows: MonitoringReplayRow[]): HeartbeatStatus[] {
  return rows
    .filter((row) => row.tagCode === 'heartbeat')
    .map((row) => ({
      craneNo: row.craneNo,
      craneId: row.craneId,
      stale: row.stale,
    }))
    .sort((a, b) => a.craneNo.localeCompare(b.craneNo, undefined, { numeric: true }));
}
