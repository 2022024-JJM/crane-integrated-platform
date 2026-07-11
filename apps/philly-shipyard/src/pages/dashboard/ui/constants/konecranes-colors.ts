import { TONE_FILL, type Tone } from '../../../../shared/ui/tone';

export type KccAccent =
  | 'safety'
  | 'production'
  | 'critical'
  | 'low'
  | 'success'
  | 'info'
  | 'neutral';

/** 대시보드 accent → 공용 톤 매핑 (safety/critical=red, production/low=amber) */
export const ACCENT_TONE: Record<KccAccent, Tone> = {
  safety: 'critical',
  production: 'warning',
  critical: 'critical',
  low: 'warning',
  success: 'positive',
  info: 'info',
  neutral: 'neutral',
};

export const KCC_FILL: Record<KccAccent, string> = {
  safety: TONE_FILL.critical,
  production: TONE_FILL.warning,
  critical: TONE_FILL.critical,
  low: TONE_FILL.warning,
  success: TONE_FILL.positive,
  info: TONE_FILL.info,
  neutral: TONE_FILL.neutral,
};

export const KCC_UNDERLINE: Record<KccAccent, string> = {
  safety: 'after:bg-red-500',
  production: 'after:bg-amber-500',
  critical: 'after:bg-red-500',
  low: 'after:bg-amber-500',
  success: 'after:bg-emerald-500',
  info: 'after:bg-blue-500',
  neutral: 'after:bg-border',
};
