/**
 * 인스펙터 리깅·태그 매핑 섹션이 공유하는 필드 클래스. 컴포넌트 파일에서
 * 상수를 export 하면 react-refresh 규칙에 걸리므로 별도 .ts 에 둔다.
 */
export const FIELD_INPUT =
  'border-border bg-muted text-foreground placeholder:text-muted-foreground h-6 w-full rounded-sm px-2 text-[11px]';
export const FIELD_SELECT =
  'border-border bg-muted text-foreground h-6 w-full min-w-0 rounded-sm border px-1 text-[11px]';
export const FIELD_LABEL = 'text-muted-foreground w-14 shrink-0 text-[10px]';
export const NUMBER_WRAPPER = 'border-border bg-muted h-6 w-full min-w-0 rounded-sm';
export const NUMBER_INPUT = 'px-2 text-[11px]';
