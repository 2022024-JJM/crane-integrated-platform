/**
 * MRO 공용 인터랙션 토큰 — 수제 버튼/인풋의 포커스·검색 스타일 단일 소스.
 *
 * 버튼형 요소를 새로 만들 땐 우선 @crane/ui의 Button(buttonVariants)을 검토하고,
 * pill·캘린더 셀·행처럼 정당한 커스텀만 여기 FOCUS_RING을 붙인다.
 */

/** 키보드 포커스 링 — packages/ui Button의 focus-visible 스펙과 동일 */
export const FOCUS_RING =
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/** 리스트 페이지 검색 인풋 공통 (아이콘은 호출부에서 absolute 배치, pl-8 유지) */
export const searchInputClass =
  'h-9 rounded-lg border border-border bg-background text-sm transition-all outline-none placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-ring focus:ring-2 focus:ring-ring/25';
