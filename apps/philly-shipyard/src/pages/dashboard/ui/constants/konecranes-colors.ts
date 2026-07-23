import { TONE_FILL, TONE_UNDERLINE, type Tone } from '../../../../shared/ui/tone';

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
  safety: TONE_UNDERLINE.critical,
  production: TONE_UNDERLINE.warning,
  critical: TONE_UNDERLINE.critical,
  low: TONE_UNDERLINE.warning,
  success: TONE_UNDERLINE.positive,
  info: TONE_UNDERLINE.info,
  neutral: TONE_UNDERLINE.neutral,
};
