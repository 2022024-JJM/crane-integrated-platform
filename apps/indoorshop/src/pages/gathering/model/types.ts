/** 셀 강조 톤 — 디자인 시안의 tone 맵과 1:1 대응 */
export type CellTone = 'r' | 'g' | 'o' | 'k' | 'b' | 'key';

export type CellAlign = 'left' | 'center' | 'right';

export interface DetailCol {
  label: string;
  align: CellAlign;
}

export interface DetailCell {
  text: string;
  align: CellAlign;
  tone?: CellTone;
}

/** 드릴다운(하위 데이터) 그리드 — 원천 화면의 네이티브 컬럼 구성 그대로 */
export interface DrillDetail {
  title: string;
  axis: string;
  cols: DetailCol[];
  rows: DetailCell[][];
}

export type ProcessKind = '가공' | '조립' | '의장' | '도장';

/** FACT_공정이벤트 통합 그리드 1행 */
export interface GatherRow {
  ship: string;
  blk: string;
  proc: ProcessKind;
  stage: string;
  sub: string;
  key: string;
  start: string;
  end: string;
  note: string;
  warn: boolean;
  detail: DrillDetail;
}

export interface GatherQuery {
  ship: string;
  block: string;
  step: string;
}
