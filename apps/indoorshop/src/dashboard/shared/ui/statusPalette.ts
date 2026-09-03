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
  /**
   * 유리 위 카드의 **테두리** — 카드 한 장이 통째로 상태를 말해야 하는 자리.
   * (지도 우측 공장 카드처럼 펴 보기 전에도 이상이 보여야 하는 것들)
   */
  glassBorder: string
}

export const STATUS_STYLE: Record<StatusMeaning, StatusStyle> = {
  done: {
    chip: 'bg-status-healthy/10 text-status-healthy',
    ink: 'text-status-healthy',
    fill: 'bg-status-healthy',
    border: 'border-status-healthy/40',
    glassInk: 'text-glass-healthy',
    glassFill: 'bg-glass-healthy',
    glassBorder: 'border-glass-healthy/55',
  },
  inProgress: {
    chip: 'bg-status-progress/10 text-status-progress',
    ink: 'text-status-progress',
    fill: 'bg-status-progress',
    border: 'border-status-progress/40',
    glassInk: 'text-glass-progress',
    glassFill: 'bg-glass-progress',
    glassBorder: 'border-glass-progress/55',
  },
  warning: {
    chip: 'bg-status-degraded/10 text-status-degraded',
    ink: 'text-status-degraded',
    fill: 'bg-status-degraded',
    border: 'border-status-degraded/40',
    glassInk: 'text-glass-degraded',
    glassFill: 'bg-glass-degraded',
    glassBorder: 'border-glass-degraded/60',
  },
  error: {
    chip: 'bg-status-unhealthy/10 text-status-unhealthy',
    ink: 'text-status-unhealthy',
    fill: 'bg-status-unhealthy',
    border: 'border-status-unhealthy/40',
    glassInk: 'text-glass-unhealthy',
    glassFill: 'bg-glass-unhealthy',
    glassBorder: 'border-glass-unhealthy/70',
  },
  idle: {
    /* 중립은 상태색이 아니다 — 뜻이 없다는 뜻이라 본문 잉크를 옅게 쓴다 */
    chip: 'bg-surface-secondary text-foreground/68',
    ink: 'text-foreground/54',
    fill: 'bg-foreground/25',
    border: 'border-border',
    glassInk: 'text-glass-foreground/55',
    glassFill: 'bg-glass-foreground/30',
    glassBorder: 'border-white/10',
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

/* ── 정상은 초록, 다만 조용하게 (R18 · 사용자 확정) ────────────
 *
 * 한때 정상 램프에서 색을 아예 뺐다(무채 점등). 칸이 수백 개인 화면에서 "색은 이상
 * 전용"이라는 ISA-101 의 논리를 그대로 따른 것인데, 현장에서는 그 화면이 **꺼져 있는
 * 것처럼** 읽혔다 — 라이다가 돌고 있는데 회색이면 "정상"이 아니라 "죽었다"로 보인다.
 * 설비 화면에서 초록 점등은 배색이 아니라 **가동 중이라는 신호 그 자체**다.
 *
 * 그래서 정상은 초록으로 되돌리되, 이상을 덮지 않도록 **소리를 낮춘다**:
 *  - 정상 = 차분한 초록 점등. 글로우도 애니메이션도 없다. 색은 있고 강조는 없다.
 *  - 이상 = 밝은 빨강 + 강조(테두리·정렬 우선). 드물기 때문에 여전히 먼저 눈에 든다.
 *  - 대기·미수집 = 무채. 이쪽은 원래 뜻이 없는 상태라 색을 줄 이유가 없다.
 *
 * ⚠️ 낮추는 것은 **정상·대기에만**. 주의·이상에 쓰면 경보를 지우는 것이 된다.
 * ⚠️ 모양 부호(`STATUS_SHAPE`)는 톤과 무관하게 그대로다.
 */

/** 톤을 낮춰도 되는 뜻인가 — 정상·대기만 */
export function isAttenuable(meaning: StatusMeaning): boolean {
  return meaning === 'done' || meaning === 'idle'
}

/** 낮춘 톤 — 램프 채움과 글씨 한 쌍 */
export interface CalmStyle {
  fill: string
  ink: string
  glassFill: string
  glassInk: string
}

/**
 * 칸이 많은 화면에서 쓰는 조용한 톤.
 *
 * 정상은 **초록을 유지한 채 채도를 낮춘다**(알파). 대기는 무채 그대로 — 두 상태가
 * 색으로 갈려야 "돌고 있다"와 "아직 아니다"가 구분된다.
 */
export const STATUS_CALM: Record<'done' | 'idle', CalmStyle> = {
  done: {
    fill: 'bg-status-healthy/70',
    ink: 'text-status-healthy/85',
    glassFill: 'bg-glass-healthy/70',
    glassInk: 'text-glass-healthy/85',
  },
  idle: {
    fill: 'bg-foreground/30',
    ink: 'text-foreground/55',
    glassFill: 'bg-glass-foreground/35',
    glassInk: 'text-glass-foreground/55',
  },
}

/**
 * 그리드 셀이 실제로 쓸 색 — 톤 규칙을 한 곳에서 적용한다.
 *
 * `dense`(칸이 많은 화면)면 정상·대기의 소리를 낮추고, 주의·이상은 그대로 둔다.
 * 낱개 카드처럼 칸이 적은 자리는 `dense: false` 로 제 색을 그대로 쓴다.
 */
export function lampStyle(
  meaning: StatusMeaning,
  options: { dense?: boolean; glass?: boolean } = {}
): { fill: string; ink: string } {
  const { dense = false, glass = false } = options
  if (dense && isAttenuable(meaning)) {
    const calm = STATUS_CALM[meaning as 'done' | 'idle']
    return glass
      ? { fill: calm.glassFill, ink: calm.glassInk }
      : { fill: calm.fill, ink: calm.ink }
  }
  const style = STATUS_STYLE[meaning]
  return glass
    ? { fill: style.glassFill, ink: style.glassInk }
    : { fill: style.fill, ink: style.ink }
}
