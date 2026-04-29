export type KccAccent =
  | 'safety'
  | 'production'
  | 'critical'
  | 'low'
  | 'success'
  | 'info'
  | 'neutral';

export const KCC_FILL: Record<KccAccent, string> = {
  safety: 'var(--chart-5)',
  production: 'var(--chart-16)',
  critical: 'var(--chart-5)',
  low: 'var(--chart-1)',
  success: 'var(--chart-2)',
  info: 'var(--chart-9)',
  neutral: 'var(--chart-8)',
};

export const KCC_UNDERLINE: Record<KccAccent, string> = {
  safety: 'after:bg-red-500 dark:after:bg-red-400',
  production: 'after:bg-orange-500 dark:after:bg-orange-400',
  critical: 'after:bg-red-500 dark:after:bg-red-400',
  low: 'after:bg-amber-500 dark:after:bg-amber-400',
  success: 'after:bg-emerald-500 dark:after:bg-emerald-400',
  info: 'after:bg-cyan-500 dark:after:bg-cyan-400',
  neutral: 'after:bg-slate-400 dark:after:bg-slate-500',
};

export const KCC_TEXT: Record<KccAccent, string> = {
  safety: 'text-red-600 dark:text-red-400',
  production: 'text-orange-600 dark:text-orange-400',
  critical: 'text-red-600 dark:text-red-400',
  low: 'text-amber-600 dark:text-amber-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  info: 'text-cyan-600 dark:text-cyan-400',
  neutral: 'text-foreground',
};
