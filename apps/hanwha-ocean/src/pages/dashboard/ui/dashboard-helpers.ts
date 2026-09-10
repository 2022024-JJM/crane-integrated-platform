import type { DashboardMetricCard, DashboardSummary } from '../model';

export type DashboardTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export interface DashboardSectionSharedProps {
  summary: DashboardSummary;
  translate: DashboardTranslate;
}

export interface DashboardStatItem {
  label: string;
  value: string;
  tone?: string;
}

export interface DashboardTooltipPayloadEntry {
  color?: string;
  dataKey?: string;
  name?: string;
  value?: number;
  payload?: Record<string, number | string>;
}

export function formatMetric(
  metric: DashboardMetricCard,
  translate: DashboardTranslate,
  locale: string,
) {
  if (metric.format === 'translation') {
    return translate(String(metric.value));
  }

  if (typeof metric.value === 'number') {
    return new Intl.NumberFormat(locale).format(metric.value);
  }

  return String(metric.value);
}

export function formatTooltipValue(value: number | undefined, locale: string) {
  if (typeof value !== 'number') {
    return '-';
  }

  return new Intl.NumberFormat(locale).format(value);
}

/** 'YYYY-MM-DD' 날짜 키 → 로컬 자정 Date. `new Date(문자열)` 은 UTC 해석이라 금지. */
export function dateKeyToDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function formatDateKey(
  value: string | null | undefined,
  formatter: Intl.DateTimeFormat,
) {
  if (!value) {
    return '-';
  }

  return formatter.format(dateKeyToDate(value));
}
