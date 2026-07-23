export type AlarmZone = 'none' | 'near' | 'slow' | 'stop';

/** 마스터 크레인 계열 — TC는 TTC, CC는 OC와 화면 구성이 동일 (매뉴얼 2.2) */
export type MasterKind = 'TTC' | 'GC' | 'OC';

export type AxisKey = 'traverse' | 'slew' | 'travel' | 'ut' | 'lt' | 'luff';

export type ArrowDir = 'up' | 'down' | 'left' | 'right';

/** 마스터 종류별 동작상태/충돌정보 행 구성 (매뉴얼 2.2) */
export interface AxisMeta {
  key: AxisKey;
  label: string;
  unit: 'm' | '°';
  /** 동작상태 화살표 쌍 (표시 순서) */
  arrows: [ArrowDir, ArrowDir];
}

export const MASTER_AXES: Record<
  MasterKind,
  readonly [AxisMeta, AxisMeta, AxisMeta]
> = {
  TTC: [
    { key: 'traverse', label: '횡행', unit: 'm', arrows: ['up', 'down'] },
    { key: 'slew', label: '선회', unit: '°', arrows: ['left', 'right'] },
    { key: 'travel', label: '주행', unit: 'm', arrows: ['up', 'down'] },
  ],
  GC: [
    { key: 'ut', label: 'UT', unit: 'm', arrows: ['left', 'right'] },
    { key: 'lt', label: 'LT', unit: 'm', arrows: ['left', 'right'] },
    { key: 'travel', label: '주행', unit: 'm', arrows: ['up', 'down'] },
  ],
  OC: [
    { key: 'luff', label: '인입', unit: '°', arrows: ['up', 'down'] },
    { key: 'slew', label: '선회', unit: '°', arrows: ['left', 'right'] },
    { key: 'travel', label: '주행', unit: 'm', arrows: ['up', 'down'] },
  ],
};

/** 동작상태 한 행 — MASTER_AXES[kind] 순서와 1:1 */
export interface AxisStatus {
  value: number;
  moving: boolean;
  dir: ArrowDir;
}

export interface CollisionAxisInfo {
  zone: AlarmZone;
  /** 최근접 대상 — 무알람이어도 표시 범위 내면 채워짐 (매뉴얼 2.6 화면) */
  targetId: string | null;
  /** meters, rounded to 0.1 */
  distance: number | null;
  direction: ArrowDir | null;
}

/** 맵 좌표(m, 250x250 필드) 기준 마스터 도형 */
export type MasterGeometry =
  | {
      shape: 'circular';
      x: number;
      y: number;
      circleR: number;
      boomLen: number;
      slewDeg: number;
      /** 붐 위 트롤리 위치(m) — OC 계열은 null */
      trolley: number | null;
    }
  | {
      shape: 'gantry';
      railY: number;
      x1: number;
      x2: number;
      trolleys: [number, number];
    };

export interface MasterCraneState {
  id: string;
  kind: MasterKind;
  load: number;
  /** MASTER_AXES[kind] 순서와 1:1 */
  status: [AxisStatus, AxisStatus, AxisStatus];
  geometry: MasterGeometry;
}

export interface SlaveGc {
  kind: 'GC';
  id: string;
  railY: number;
  x1: number;
  x2: number;
  trolleys: number[];
  commError: boolean;
}

export interface SlaveCircular {
  kind: 'TTC' | 'OC';
  id: string;
  x: number;
  y: number;
  r: number;
  boomLen: number;
  boomDeg: number;
  commError: boolean;
}

export type SlaveCrane = SlaveGc | SlaveCircular;

export interface HmiSnapshot {
  master: MasterCraneState;
  slaves: SlaveCrane[];
  /** MASTER_AXES[kind] 순서와 1:1 */
  axes: [CollisionAxisInfo, CollisionAxisInfo, CollisionAxisInfo];
  zone: AlarmZone;
  /** 마지막 알람 영역 상향 진입 시각(ms) — 화면 점멸 트리거 */
  alarmAt: number;
}

export const ZONE_SEVERITY: Record<AlarmZone, number> = {
  none: 0,
  near: 1,
  slow: 2,
  stop: 3,
};
