/**
 * MRO 공용 상태 톤 팔레트 — philly-shipyard 전 화면의 단일 컬러 소스.
 *
 * 원칙
 * - 크롬(카드 테두리·배경·아이콘·헤더)은 뉴트럴 토큰만 사용하고, 색은 상태 의미에만 쓴다.
 * - 허용 hue는 4개: red(critical) · amber(warning) · emerald(positive) · blue(info).
 * - 셰이드 규칙: 텍스트 600(dark 400) / 도트·바 500 / 배경 틴트 500/10 / 테두리 500/25.
 */
export type Tone = 'critical' | 'warning' | 'positive' | 'info' | 'neutral';

/** 본문 텍스트에 상태를 실을 때 (숫자·D-day 등 작은 데이터 텍스트 한정) */
export const TONE_TEXT: Record<Tone, string> = {
  critical: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  positive: 'text-emerald-600 dark:text-emerald-400',
  info: 'text-blue-600 dark:text-blue-400',
  neutral: 'text-muted-foreground',
};

/** 상태 도트 · progress bar 채움 */
export const TONE_DOT: Record<Tone, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  positive: 'bg-emerald-500',
  info: 'bg-blue-500',
  neutral: 'bg-muted-foreground/40',
};

/** 알림 배너 표면 (테두리 + 옅은 틴트) */
export const TONE_SURFACE: Record<Tone, string> = {
  critical: 'border-red-500/25 bg-red-500/5',
  warning: 'border-amber-500/25 bg-amber-500/5',
  positive: 'border-emerald-500/25 bg-emerald-500/5',
  info: 'border-blue-500/25 bg-blue-500/5',
  neutral: 'border-border bg-muted/30',
};

/** 작은 칩(라벨) — 틴트 배경 + 톤 텍스트 */
export const TONE_CHIP: Record<Tone, string> = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  positive: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  neutral: 'bg-muted text-muted-foreground',
};

/** 필터 pill 활성 상태 — 틴트 + 인셋 링. 비활성은 PILL_INACTIVE 공통. */
export const TONE_PILL_ACTIVE: Record<Tone, string> = {
  critical:
    'bg-red-500/15 text-red-600 ring-1 ring-inset ring-red-500/30 dark:text-red-400',
  warning:
    'bg-amber-500/15 text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-400',
  positive:
    'bg-emerald-500/15 text-emerald-600 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400',
  info: 'bg-blue-500/15 text-blue-600 ring-1 ring-inset ring-blue-500/30 dark:text-blue-400',
  neutral: 'bg-muted text-foreground ring-1 ring-inset ring-border',
};

/** 필터 pill 비활성 공통 — 색은 도트(TONE_DOT)로만 표시 */
export const PILL_INACTIVE =
  'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground';

/**
 * SVG/차트 fill용 고정 hex — Tailwind red/amber/emerald/blue 500 스텝.
 * (도넛 세그먼트는 항상 라벨+수치와 함께 표시되므로 색 단독 의미 전달 없음)
 */
export const TONE_FILL: Record<Tone, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  positive: '#10b981',
  info: '#3b82f6',
  neutral: 'var(--muted)',
};
