export type KeyinProc = '가공' | '조립' | '의장' | '도장';

/** 입력 방식 — pct: 완성도(%), count: 설치 건수, event: 완료 확인 */
export type KeyinKind = 'pct' | 'count' | 'event';

export type KeyinStatus = 'none' | 'typed' | 'draft' | 'fixed';

/** Key-In 대상 카드 1건 — 자동수집 실패 이벤트 (블록 × 공정) */
export interface KeyinItem {
  id: string;
  proc: KeyinProc;
  kind: KeyinKind;
  ev: string;
  fail: string;
  src: string;
  /** 직전 자동값 — pct는 %, count는 건수. 없으면 null */
  auto: number | null;
  autoAt: string | null;
  /** count 전용 — 전체 건수 */
  total: number | null;
  /** pct 입력값 */
  val: number | null;
  /** count 입력값 */
  cnt: number | null;
  /** event 완료 여부 */
  done: boolean | null;
  doneAt: string | null;
  memo: string;
  status: KeyinStatus;
}

/** 블록 No → 카드 목록 */
export type KeyinData = Record<string, KeyinItem[]>;
