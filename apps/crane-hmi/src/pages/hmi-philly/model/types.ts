/** 축 이동 방향 (+1: 증가, -1: 감소, 0: 정지) */
export type AxisDir = -1 | 0 | 1;

export interface AxisState {
  value: number;
  dir: AxisDir;
}

/** LLC(레벨러핑 크레인) 상태 */
export interface LlcState {
  /** 기복각 (°) */
  luffing: AxisState;
  /** 선회각 (°) */
  slewing: AxisState;
  /** 주행 위치 (m) */
  travel: AxisState;
}

/** GC(골리앗 크레인) 상태 */
export interface GcState {
  /** 주행 위치 (m) — 도크 길이 방향 */
  travel: AxisState;
  /** 트롤리 횡행 위치 (m) — 거더 방향 */
  trolley: AxisState;
}

/** Philly Anti-Collision HMI 1프레임 스냅샷 */
export interface PhillySnapshot {
  /** MY CRANE(LLC-01) 하중 (t) */
  load: number;
  /** MY CRANE — LLC-01 */
  myCrane: LlcState;
  /** 인접 LLC — LLC-02 */
  llc2: LlcState;
  /** 골리앗 크레인 — GC-01 */
  gc: GcState;
}
