export type KeyinProc = '가공' | '조립' | '의장' | '도장';

/** MES 계정 — 로그인하면 담당 공정·호선·블록 범위가 정해진다 */
export interface KeyinUser {
  id: string;
  pw: string;
  name: string;
  type: '직영' | '협력사';
  dept: string;
  ban: string;
  proc: KeyinProc;
  ships: string[];
  /** 블록 번호 오프셋 — 담당자마다 다른 블록 셋을 갖게 하는 시드 성분 */
  blkOff: number;
}

/** 공정별 액티비티 정의 (시드 입력) */
export interface ActDef {
  name: string;
  /** LiDAR 등 자동수집 대상인지 */
  auto: boolean;
  /** 하위 워크오더 이름 풀 */
  wos: string[];
  /** 자동수집 없음 배너에 표시할 실패 사유 */
  fail?: string;
  /** 대량 WO 생성 개수 상한 — 있으면 wos 를 순환하며 부재 단위로 생성 */
  many?: number;
}

export interface WorkOrder {
  name: string;
  wo: string;
  done: boolean;
  /** 자동수신 시점의 완료 상태 — 수정 여부 판정 기준 */
  autoDone: boolean;
}

/** 제출 스냅샷 — 제출 시점의 완료 여부와 입력 상태 키 */
export interface SubmitSnapshot {
  done: boolean;
  /** JSON.stringify([confirmed, edited, wos done 배열]) */
  key: string;
}

/** 액티비티 1건 — 관리 단위. 입력은 WO 완료 토글·실적률·값 확인 */
export interface Activity {
  id: string;
  proc: KeyinProc;
  name: string;
  actNo: string;
  /** 자동 인식 완성도(%) — 없으면 null */
  auto: number | null;
  autoAt: string;
  fail: string;
  /** 자동값을 사용자가 확인했는가 */
  confirmed: boolean;
  /** 사용자가 직접 입력한 실적률 — 없으면 null */
  edited: number | null;
  wos: WorkOrder[];
  /** 마지막 제출 스냅샷 — 제출 전엔 null */
  sub: SubmitSnapshot | null;
}

/** 블록 No → 액티비티 목록 */
export type BlockData = Record<string, Activity[]>;

export type MsgTone = 'ok' | 'info';
export type BlkTab = 'wait' | 'done';
export type WoFilter = '미완료' | '완료' | '전체';

/** 카드 상태 칩 */
export type CardStatus = 'none' | 'auto' | 'typed' | 'fixed' | 'fixedPart';
