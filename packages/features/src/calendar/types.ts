export type CalendarSource = 'inspection' | 'repair';

/** 점검·정비 WO를 캘린더 표시용으로 정규화한 이벤트 */
export interface CalendarEvent {
  /** 소스 간 충돌 방지용 합성 키 (`${sourceType}:${sourceId}`) */
  id: string;
  /** 원본 WO id (상세 경로 구성용) */
  sourceId: string;
  sourceType: CalendarSource;
  /** WO 번호 */
  woNumber: string;
  /** 요약 제목 (점검=유형 라벨, 정비=구성품명) */
  title: string;
  craneId: string;
  craneName: string;
  /** 서비스 상품 필터 키 — 점검=woType, 정비=planned|oncall */
  productKey: string;
  /** 로컬 시각 Date (TZ-safe 수동 파서로 생성) */
  start: Date;
  /** 종일이면 start와 동일, 기간 이벤트면 종료 시각 */
  end: Date;
  /** 점검=true(종일), 정비=false(기간) */
  allDay: boolean;
  /** 원본 상태 enum (색상/뱃지 키) */
  status: string;
  /** 원본 우선순위 enum */
  priority: string;
  /** 색상 매핑 키 (점검=status, 정비=priority) */
  colorKey: string;
  /** 상세 페이지 경로 (`/inspection/:id` | `/maintenance/:id`) */
  detailPath: string;
}
