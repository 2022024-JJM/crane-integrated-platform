/** 내업 권역 (로그인 사용자의 부서가 결정) */
export type GatherProc = '가공' | '조립' | '의장' | '도장';

/** 확인 필요 이슈 종류 (권역별로 쓰이는 값이 다르다) */
export type IssueKind = '정합성' | '수집실패' | 'Key-In' | '검사중';

/** 지연 티어: 계획 대비 -5%p↓=delay, -1~4%p=warn, 달성=ok */
export type TierKey = 'delay' | 'warn' | 'ok';

/** MES 계정 (프로토타입 로그인) */
export interface DemoUser {
  id: string;
  pw: string;
  name: string;
  type: '직영' | '협력사';
  dept: string;
  ban: string;
  proc: GatherProc;
  ships: string[];
}

/** 권역별 수집 원천·힌트 */
export interface ScopeInfo {
  src: string;
  srcLong: string;
  hint: string;
}

export interface BlockInfo {
  no: string;
  prog: number;
  seed: number;
  woN: number;
  asmN: number;
  /** 계획-실적 차 (%p) — 권역 실적에 적용 */
  planGap: number;
}

/** 가공 5단계 중량률 */
export interface FabResult {
  rates: number[];
  total: number;
}

/** 도장 완료 스텝 수 (0~3: —/S/P/T/UP/FINAL) */
export interface PntResult {
  done: 0 | 1 | 2 | 3;
}

export interface WoItem {
  wo: string;
  name: string;
  asm: string;
  kind: string;
  pct: number;
  warn: boolean;
}

/** 수집 이벤트 로우데이터 1건 */
export interface EvItem {
  blk: string;
  ev: string;
  key: string;
  /** 가공 단계 인덱스 (0~4) */
  stage?: number;
  /** 도장 스텝 */
  step?: 'S/P' | 'T/UP' | 'FINAL';
  /** 의장품 구분 */
  kind?: string;
  /** 가공: 자동(단계) 중량률 */
  autoPct?: number;
  /** 가공: 레거시 실적 중량률 (null=I/F 미수신) */
  legacy?: number | null;
  /** 가공: 정합성 불일치 */
  mism?: boolean;
  /** 가공: I/F 미수신 */
  ifMiss?: boolean;
  start: string;
  end: string;
  note: string;
  warn: boolean;
  issue: IssueKind | '';
  src: string;
}
