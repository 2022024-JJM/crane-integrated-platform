export type GatherProc = '가공' | '조립' | '의장' | '도장';

/** 확인 필요 이슈 구분 — 수집 이벤트 필터 키 */
export type IssueKind = '정합성' | 'Key-In' | '수집실패';

/** 블록 상태 티어 — 지연 = 계획 대비 -5%p 이상 · 주의 = -1~4%p · 정상 = 계획 달성 */
export type TierKey = 'delay' | 'warn' | 'ok';

/** 내업 재공 블록 1건 (시드 파생) */
export interface BlockInfo {
  no: string;
  /** 0~1 종합 진척 — 파생값 산출의 기준 */
  prog: number;
  /** 블록 전용 시드 */
  seed: number;
  /** 조립 공장 1~4 */
  fac: number;
  /** 하위 워크오더 수 */
  woN: number;
  /** 어셈블리 수 */
  asmN: number;
  /** 종합 실적 % */
  act: number;
  /** 계획 % */
  plan: number;
  /** 지연 %p (계획-실적, 0 이상) */
  delay: number;
}

/** 가공 5단계 중량가중 진척 (강재반입→불출→절단→사상→팔레트편성) */
export interface FabResult {
  rates: number[];
  total: number;
}

/** 도장 스텝 진행 — done: 완료된 스텝 수 (0~3) */
export interface PntResult {
  txt: string;
  done: number;
}

/** 블록 하위 워크오더 실적 */
export interface BlockWo {
  wo: string;
  proc: GatherProc;
  name: string;
  asm: string;
  pct: number;
  /** 수집 실패 여부 */
  warn: boolean;
  src: string;
  recv: string;
}

/** 하위 상세 key-value 행의 값 톤 */
export type KvTone = 'key' | 'g' | 'r' | 'o' | 'k' | '';

/** [라벨, 값, 톤?] */
export type KvRow = [string, string, KvTone?];

/** 수집 이벤트 로우데이터 1건 */
export interface GatherEvent {
  blk: string;
  proc: GatherProc;
  ev: string;
  key: string;
  start: string;
  /** 완료(수신) 일시 — 미완료면 '' */
  end: string;
  note: string;
  warn: boolean;
  issue: IssueKind | '';
  src: string;
  kv: KvRow[];
}
