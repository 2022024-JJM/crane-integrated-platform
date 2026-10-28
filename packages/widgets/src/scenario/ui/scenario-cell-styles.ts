/**
 * 시나리오 패널의 셀 입력 모양 — 행·머리줄이 같은 클래스를 쓴다. 좁은
 * 패널이라 셀은 행 안에서 줄어든다.
 */
export const CELL_INPUT =
  'border-border bg-muted text-foreground placeholder:text-muted-foreground h-7 w-full min-w-0 rounded-sm px-2 text-xs';
export const CELL_NUMBER_WRAPPER =
  'border-border bg-muted h-7 w-full min-w-0 rounded-sm';
export const CELL_NUMBER_INPUT = 'px-2 text-xs';

/** 목록 행의 ON/OFF 알약 — 보기만 하는 것(파형)과 누르는 것(수동)이 같은 모양이다. */
export const ROW_PILL =
  'inline-flex h-5 min-w-10 items-center justify-center rounded-full border px-2 text-[10px] font-semibold tracking-wide';
export const ROW_PILL_ON = 'bg-muted text-foreground border-transparent';
export const ROW_PILL_OFF = 'border-border text-muted-foreground';
