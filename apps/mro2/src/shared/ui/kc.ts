/**
 * MRO2 디자인 토큰 — 벤치마크 포털의 "문법"(2-레이어 색상, 색 바, 언더라인 스탯)은
 * 유지하되, 브랜드는 자체 아이덴티티로 분화한 단일 소스.
 *
 * 모든 색은 kc-theme.css의 CSS 변수를 참조한다 → 공용 ThemeProvider의 `.dark` 클래스로
 * 다크/라이트가 자동 전환된다. (SVG에 쓸 때는 attribute가 아닌 style로 지정할 것 —
 * presentation attribute는 var()를 해석하지 못한다.)
 *
 * 분화 포인트:
 *  - 브랜드 액센트: 페트롤 틸(accent). 레드는 Safety 의미색으로만 쓴다.
 *  - 서체: IBM Plex Sans(본문) + Plex Sans Condensed(헤딩·수치) + Plex Mono(WO 번호)
 *  - 형태: 4px 라운드
 *
 * 2-레이어 색상 전략:
 *  - 의미(semantic) 레이어: 심각도/상태 전달 전용 (red/orange/yellow/blue/green/grey)
 *  - 데이터 계열(series) 레이어: 차트 전용 teal/navy/cyan — 의미색과 절대 겹치지 않는다
 */
export const KC = {
  /* 브랜드 */
  accent: 'var(--kc-accent)',
  red: 'var(--kc-accent)', // 브랜드 액센트 별칭 (구 레드 자리)
  bar: 'var(--kc-bar)',
  ink: 'var(--kc-ink)',
  text: 'var(--kc-text)',
  muted: 'var(--kc-muted)',
  faint: 'var(--kc-faint)',
  border: 'var(--kc-border)',
  borderStrong: 'var(--kc-border-strong)',
  hairline: 'var(--kc-hairline)',
  bg: 'var(--kc-bg)',
  bgSubtle: 'var(--kc-bg-subtle)',
  bgRow: 'var(--kc-bg-row)',
  track: 'var(--kc-track)',
  hover: 'var(--kc-hover)',

  /* 반전 표면 (선택 칩·액티브 토글) */
  inverseBg: 'var(--kc-inverse-bg)',
  inverseText: 'var(--kc-inverse-text)',
  inverseMuted: 'var(--kc-inverse-muted)',

  /* CTA — Generate Report / New Service Request */
  teal: 'var(--kc-teal)',
  tealDark: 'var(--kc-teal-dark)',
  link: 'var(--kc-link)',

  /* 의미 레이어 (findings 심각도 / 서비스 상태) */
  safety: 'var(--kc-safety)',
  production: 'var(--kc-production)',
  undetermined: 'var(--kc-undetermined)',
  improvement: 'var(--kc-improvement)',
  ok: 'var(--kc-ok)',
  planned: 'var(--kc-planned)',

  /* 데이터 계열 레이어 (차트 전용 — 의미색과 분리) */
  s1: 'var(--kc-s1)',
  s2: 'var(--kc-s2)',
  s3: 'var(--kc-s3)',
  s4: 'var(--kc-s4)',
  s5: 'var(--kc-s5)',

  /* 형태 */
  radius: 4,
} as const;

/** 본문 서체 — IBM Plex Sans (엔지니어링 톤) */
export const KC_FONT =
  '"IBM Plex Sans", "Apple SD Gothic Neo", "Helvetica Neue", sans-serif';

/** 헤딩·대형 수치 서체 — Plex Sans Condensed */
export const KC_FONT_DISPLAY =
  '"IBM Plex Sans Condensed", "IBM Plex Sans", "Helvetica Neue", sans-serif';

/** WO 번호·코드·수치 테이블 — Plex Mono */
export const KC_FONT_MONO =
  '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace';

export type ServiceTone =
  | 'completed'
  | 'inProgress'
  | 'open'
  | 'delayed';

/** 서비스 상태색 규칙: green=완료·승인·종결 / yellow=진행중 / grey=미래 계획 / red=지연 */
export const SERVICE_TONE_COLOR: Record<ServiceTone, string> = {
  completed: KC.ok,
  inProgress: KC.undetermined,
  open: KC.planned,
  delayed: KC.safety,
};

export type FindingTone =
  | 'safety'
  | 'production'
  | 'undetermined'
  | 'improvement'
  | 'ok';

export const FINDING_TONE_COLOR: Record<FindingTone, string> = {
  safety: KC.safety,
  production: KC.production,
  undetermined: KC.undetermined,
  improvement: KC.improvement,
  ok: KC.ok,
};

export function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
