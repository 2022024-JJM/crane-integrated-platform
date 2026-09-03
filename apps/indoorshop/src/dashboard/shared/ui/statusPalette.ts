/*
 * ── 상태 의미 팔레트 — 앱 전체에서 색이 뜻하는 바의 단일 소스 ──
 *
 * 감사에서 가장 크게 걸린 것이 색이었다. 같은 초록이 야드에서는 "작업중", 통합실적
 * 에서는 "완료"였고, 같은 빨강·주황이 한쪽에서는 "진행중" 다른 쪽에서는 "오류"였다.
 * 화면마다 색을 새로 고르면 이런 전도는 반드시 다시 생긴다 — 그래서 **의미**를 먼저
 * 정하고, 색은 그 의미에만 매인다. 컴포넌트는 색이 아니라 의미를 고른다.
 *
 *   done        완료 · 정상 · 통과        초록
 *   inProgress  진행중 · 작업중 · 재실     파랑   ← 신설(예전에는 강조색 주황을 썼다)
 *   warning     주의 · 미확인 · 확인 필요  앰버
 *   error       이상 · 실패 · 불일치       빨강
 *   idle        미도래 · 대기 · 공석 · 미수집  중립 회색
 *
 * **빨강은 이상 전용이다.** 정상적으로 돌고 있는 것에 빨강이 붙으면 화면 전체가
 * 상시 경보가 되고, 진짜 이상이 묻힌다. 진행중을 파랑으로 옮긴 이유가 그것이다.
 *
 * ── 공정색과의 충돌 ──
 * 조립 공정색도 파랑(#2a78d6)이다. 두 파랑이 한 화면에 서므로 **자리로 가른다**:
 * 공정색은 지도 네온·카드 좌측 세로 바처럼 "어느 공정인가"를 말하는 자리에만,
 * 상태색은 칩·점·진척 바처럼 "지금 어떤가"를 말하는 자리에만 쓴다. 그리고 상태는
 * 색 단독으로 나르지 않는다 — 칩은 아이콘+라벨, 점은 모양(STATUS_SHAPE)을 함께 낸다.
 *
 * ── 두 벌인 이유 ──
 * DOM 은 클래스(테마 토큰)로, 캔버스·인라인 스타일은 hex 로 색을 받는다. 그래서
 * 클래스표와 hex 표가 함께 있고, hex 가 `globals.css` 의 `--status-*` 와 어긋나면
 * 같은 상태가 지도와 목록에서 다른 색이 된다 — 계약 테스트가 그 일치를 지킨다.
 */

/** 색이 나르는 뜻. 화면은 이 다섯 중 하나를 고르고, 색은 고르지 않는다. */
export type StatusMeaning = 'done' | 'inProgress' | 'warning' | 'error' | 'idle'

export const STATUS_MEANINGS: readonly StatusMeaning[] = [
  'done',
  'inProgress',
  'warning',
  'error',
  'idle',
] as const

/**
 * 색 단독 금지를 위한 **모양** — 색각 이상·흑백 출력에서도 상태가 갈린다.
 * 점 하나로 상태를 말하는 자리(SCADA 램프·정반 칩·점검 불릿)가 이 모양을 쓴다.
 */
export type StatusShape = 'circle' | 'triangle' | 'square' | 'diamond' | 'dash'

export const STATUS_SHAPE: Record<StatusMeaning, StatusShape> = {
  done: 'circle',
  inProgress: 'diamond',
  warning: 'triangle',
  error: 'square',
  idle: 'dash',
}

export interface StatusStyle {
  /** 칩 — 10% 틴트 배경 + 상태색 글씨 (상태색 위 흰 글씨는 대비를 못 넘긴다) */
  chip: string
  /** 글씨만 */
  ink: string
  /** 점·진척 바 채움 */
  fill: string
  /** 테두리 (카드 강조 등) */
  border: string
  /** 지도 오버레이(어두운 유리) 위 글씨 — 테마를 따라가면 라이트에서 묻힌다 */
  glassInk: string
  /** 같은 자리의 채움 */
  glassFill: string
}

export const STATUS_STYLE: Record<StatusMeaning, StatusStyle> = {
  done: {
    chip: 'bg-status-healthy/10 text-status-healthy',
    ink: 'text-status-healthy',
    fill: 'bg-status-healthy',
    border: 'border-status-healthy/40',
    glassInk: 'text-glass-healthy',
    glassFill: 'bg-glass-healthy',
  },
  inProgress: {
    chip: 'bg-status-progress/10 text-status-progress',
    ink: 'text-status-progress',
    fill: 'bg-status-progress',
    border: 'border-status-progress/40',
    glassInk: 'text-glass-progress',
    glassFill: 'bg-glass-progress',
  },
  warning: {
    chip: 'bg-status-degraded/10 text-status-degraded',
    ink: 'text-status-degraded',
    fill: 'bg-status-degraded',
    border: 'border-status-degraded/40',
    glassInk: 'text-glass-degraded',
    glassFill: 'bg-glass-degraded',
  },
  error: {
    chip: 'bg-status-unhealthy/10 text-status-unhealthy',
    ink: 'text-status-unhealthy',
    fill: 'bg-status-unhealthy',
    border: 'border-status-unhealthy/40',
    glassInk: 'text-glass-unhealthy',
    glassFill: 'bg-glass-unhealthy',
  },
  idle: {
    /* 중립은 상태색이 아니다 — 뜻이 없다는 뜻이라 본문 잉크를 옅게 쓴다 */
    chip: 'bg-surface-secondary text-foreground/68',
    ink: 'text-foreground/54',
    fill: 'bg-foreground/25',
    border: 'border-border',
    glassInk: 'text-glass-foreground/55',
    glassFill: 'bg-glass-foreground/30',
  },
}

/**
 * 캔버스·인라인 스타일이 쓰는 같은 색.
 *
 * 값은 `globals.css` 의 `--status-*`(라이트/다크)와 **같아야 한다** — 지도가 그리는
 * 색과 목록이 그리는 색이 어긋나면 팔레트를 둔 뜻이 없다. 계약 테스트가 지킨다.
 * `idle` 만 예외로 중립 회색이며, 지도 위에서는 뜻 없는 색으로 읽혀야 한다.
 */
export const STATUS_HEX: Record<'light' | 'dark', Record<StatusMeaning, string>> = {
  light: {
    done: '#047857',
    inProgress: '#1a5fb4',
    warning: '#7a5b00',
    error: '#bb3030',
    idle: '#5b6672',
  },
  dark: {
    done: '#20c997',
    inProgress: '#7ab8ff',
    warning: '#f0c24a',
    error: '#f87171',
    idle: '#9aa7b4',
  },
}

/** 지도 위 유리·강제 다크 오버레이가 쓰는 색 — 두 테마 모두 어두운 바탕이라 다크 램프 고정 */
export const GLASS_STATUS_HEX: Record<StatusMeaning, string> = STATUS_HEX.dark

/* ── 정상 감쇄 (HPI · ISA-101) ─────────────────────────────────
 *
 * 칸이 많아질수록 **정상에 색을 쓰지 않는 것**이 결정적이 된다. 337칸이 초록이면
 * 초록은 배경이 되고, 그 안의 붉은 칸 하나를 눈으로 찾을 수 없다. ISA-101 이
 * "색은 이상 전용" 이라 말하는 이유가 이것이다(설비관제 레퍼런스 §3.3).
 *
 * 그래서 설비 그리드처럼 **한 화면에 수십~수백 칸**이 서는 자리는 이 감쇄 톤을 쓴다:
 *  - 정상 = 무채색 점등(연회색). "켜져 있다"는 사실만 말하고 눈을 끌지 않는다.
 *  - 이상 = 상태색 그대로. 드물기 때문에 눈에 띈다.
 *
 * ⚠️ 감쇄는 **정상·대기에만** 적용한다. 주의·이상에 쓰면 경보를 지우는 것이 된다.
 * ⚠️ 모양 부호(`STATUS_SHAPE`)는 감쇄해도 그대로다 — 색을 뺀 자리를 모양이 받친다.
 */

/** 감쇄가 정당한 뜻인가 — 정상·대기만 */
export function isAttenuable(meaning: StatusMeaning): boolean {
  return meaning === 'done' || meaning === 'idle'
}

/** 감쇄 톤 — 색 대신 밝기만 남긴 램프·글씨 */
export interface AttenuatedStyle {
  /** 램프 채움 (무채) */
  fill: string
  /** 글씨 (무채) */
  ink: string
  /** 어두운 유리 위 */
  glassFill: string
  glassInk: string
}

export const STATUS_ATTENUATED: AttenuatedStyle = {
  fill: 'bg-foreground/30',
  ink: 'text-foreground/55',
  glassFill: 'bg-glass-foreground/35',
  glassInk: 'text-glass-foreground/55',
}

/**
 * 그리드 셀이 실제로 쓸 색 — 감쇄 규칙을 한 곳에서 적용한다.
 *
 * `dense`(칸이 많은 화면)면 정상·대기를 무채로 낮추고, 주의·이상은 그대로 둔다.
 * 낱개 카드처럼 칸이 적은 자리는 `dense: false` 로 기존 색을 그대로 쓴다.
 */
export function lampStyle(
  meaning: StatusMeaning,
  options: { dense?: boolean; glass?: boolean } = {}
): { fill: string; ink: string } {
  const { dense = false, glass = false } = options
  if (dense && isAttenuable(meaning)) {
    return glass
      ? { fill: STATUS_ATTENUATED.glassFill, ink: STATUS_ATTENUATED.glassInk }
      : { fill: STATUS_ATTENUATED.fill, ink: STATUS_ATTENUATED.ink }
  }
  const style = STATUS_STYLE[meaning]
  return glass
    ? { fill: style.glassFill, ink: style.glassInk }
    : { fill: style.fill, ink: style.ink }
}
