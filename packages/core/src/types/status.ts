export type AlarmSeverity = 'critical' | 'high' | 'medium' | 'info';

export type CraneStatus =
  | 'operating'
  | 'idle'
  | 'maintenance'
  | 'warning'
  | 'stopped';

export type StatusLevel = 'normal' | 'warning' | 'critical';

/**
 * 3D 관제 화면의 장비 운전 상태 — ACMS 의 Crane ID Box 네 가지(고장·가동·운전
 * 전원 On·운전 전원 Off)와 통신두절·미확인. 라벨·관제 HUD·3D 플레이 리포트·
 * 저널이 전부 이 여섯 가지를 쓴다. 판정은 features/3d
 * lib/model-label-state.ts — 움직임·수신은 태그 값의 변화·수신 시각에서, 나머지는
 * 모델의 상태 태그(`statusTags`)에서 온다.
 * - fault: 고장 비트 on
 * - running: 움직이는 중
 * - standby: 운전 전원 on, 멈춰 있음
 * - off: 운전 전원 off
 * - offline: 한 번은 받았지만 수신이 끊김
 * - unknown: 받은 적이 없거나, 멈춰 있는데 운전 전원을 모른다
 */
export type EquipmentRuntimeStatus =
  | 'fault'
  | 'running'
  | 'standby'
  | 'off'
  | 'offline'
  | 'unknown';

/** 라벨 한 개가 그리는 것 전부 — 상자 색(tone = 운전 상태) 하나와 아이콘 둘. */
export interface EquipmentLabelState {
  tone: EquipmentRuntimeStatus;
  /** Bypass(충돌방지 우회) on. */
  bypass: boolean;
  /** Free Swing(자유선회) on. */
  freeSwing: boolean;
}

/**
 * 3D 관제 화면의 장비 외곽선 — ACMS 의 Crane 외곽선 네 가지. 라벨의 색과는
 * 독립이다(가동 중인 장비도 외곽선이 생긴다). 판정은 features/3d
 * lib/model-outline-state.ts.
 * - none: 외곽선 없음(정상, 또는 받은 적이 없어 모름)
 * - commError: 통신불량(회색) — 통신불량 비트 on, 또는 수신이 끊김
 * - slowdown: 충돌방지 Slowdown 구간(황색)
 * - endstop: 충돌방지 Endstop 구간(적색)
 */
export type EquipmentOutlineState =
  | 'none'
  | 'commError'
  | 'slowdown'
  | 'endstop';

// ─── CMMS 상태 타입 ──────────────────────────────────────────────
export type OnOff = 'ON' | 'OFF';
export type OkNg = 'OK' | 'NG';
export type RunFaultStatus = 'STOP' | 'RUN' | 'FAULT';
export type OpenClose = '열림' | '닫힘';
