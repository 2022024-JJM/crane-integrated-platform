import type { AlarmSeverity, CraneStatus, StatusLevel } from '../types/status';

export const severityBadgeClassName: Record<AlarmSeverity, string> = {
  critical: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300',
  high: 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300',
};

export const craneStatusBadgeClassName: Record<CraneStatus, string> = {
  operating: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  idle: 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300',
  maintenance: 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  stopped: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300',
};

export const statusLevelDotClassName: Record<StatusLevel, string> = {
  normal: 'bg-green-500',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500',
};

export const tableRowStatusBadgeClassName: Record<string, string> = {
  alarm: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
  stale: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  changed: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  normal: 'border-slate-400/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
};

export const tableCategoryClassName: Record<string, string> = {
  datetime: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  measurement: 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  status: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};
