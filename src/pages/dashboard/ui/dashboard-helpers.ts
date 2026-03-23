import type { DashboardMetricCard } from '../model';

export type DashboardTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

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

  if (metric.format === 'percent') {
    return `${metric.value}%`;
  }

  if (typeof metric.value === 'number') {
    return new Intl.NumberFormat(locale).format(metric.value);
  }

  return String(metric.value);
}

export function formatTooltipValue(
  value: number | undefined,
  dataKey: string | undefined,
  locale: string,
) {
  if (typeof value !== 'number') {
    return '-';
  }

  if (dataKey === 'operationalRate') {
    return `${value}%`;
  }

  return new Intl.NumberFormat(locale).format(value);
}

export function getRiskColor(score: number) {
  if (score >= 95) {
    return 'var(--destructive)';
  }

  if (score >= 80) {
    return 'var(--chart-5)';
  }

  return 'var(--chart-4)';
}

export function formatMonth(
  value: string | null | undefined,
  formatter: Intl.DateTimeFormat,
) {
  if (!value) {
    return '-';
  }

  return formatter.format(new Date(value));
}

export function formatYearMonth(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');

  return `${year}.${month}`;
}

export function formatMonthLabel(value: string, formatter: Intl.DateTimeFormat) {
  return formatter.format(new Date(value));
}

export function formatWeekday(
  value: string | null | undefined,
  formatter: Intl.DateTimeFormat,
) {
  if (!value) {
    return '-';
  }

  return formatter.format(new Date(value));
}

export function formatWeekdayLabel(
  value: string,
  formatter: Intl.DateTimeFormat,
) {
  return formatter.format(new Date(value));
}
