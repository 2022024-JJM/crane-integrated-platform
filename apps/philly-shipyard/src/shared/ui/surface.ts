/**
 * MRO 공용 표면(카드) 토큰 — radius·보더·배경·그림자의 단일 소스.
 *
 * 2단계 radius 체계:
 * - SURFACE_CARD (rounded-xl): 폼 섹션·디테일 헤더·피처 카드 등 독립 표면
 * - SURFACE_PANEL (rounded-lg): 테이블 래퍼·리스트/큐/메트릭 카드 등 밀도 높은 데이터 표면
 * - SURFACE_MODAL (rounded-xl + shadow-xl): 다이얼로그 공통
 */
export const SURFACE_CARD = 'rounded-xl border border-border bg-card shadow-sm';
export const SURFACE_PANEL = 'rounded-lg border border-border/80 bg-card/50';
export const SURFACE_MODAL = 'rounded-xl border border-border bg-card shadow-xl';
