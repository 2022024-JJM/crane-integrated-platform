/**
 * MRO 공용 페이지 레이아웃 토큰 — 컨테이너 리듬·제목 스케일의 단일 소스.
 *
 * 예외:
 * - service-calendar: 전체 높이 캘린더 특성상 `flex h-full flex-col gap-4 p-4 md:p-6` 유지
 * - dashboard PageHeaderBar: 컴팩트 툴바형 헤더(text-base font-semibold)로 별도 유지
 *
 * 마이크로 타이포 티어(공인): text-[11px] = 밀집 라벨/테이블 헤더, text-[10px] = 칩·힌트.
 * 10px 미만(text-[9px] 등)은 사용하지 않는다.
 */
export const PAGE_CONTAINER = 'flex flex-col gap-6 p-4 md:p-6';
export const PAGE_TITLE = 'text-xl font-bold tracking-tight';
export const PAGE_SUBTITLE = 'text-sm text-muted-foreground';

/** 그리드 테이블 공용 빈 상태 */
export const TABLE_EMPTY = 'py-12 text-center text-sm text-muted-foreground';
