// ─── 공통 상태 타입 (packages/core에서 re-export) ────────────────
import type { OnOff, OkNg, RunFaultStatus, OpenClose } from '@crane/core/types/status';
export type { OnOff, OkNg, RunFaultStatus, OpenClose };

// ─── 알람 ────────────────────────────────────────────────────────
export interface CmmsAlarmRecord {
  time: string;
  value: string;
  comment: string;
}

// ─── Overview ────────────────────────────────────────────────────
export interface CmmsOverviewMachineRow {
  name: string;
  runFault: RunFaultStatus;
  joystickStep: string;
  speed: number;
  position: number;
  load: number | null;
}

export interface CmmsOverviewData {
  machines: CmmsOverviewMachineRow[];
  wind: {
    speed: number;
    direction: string;
    highWindWarning: OnOff;
    highWindTrip: OnOff;
  };
  load: {
    totalLoad: number;
    h1h2Diff: number;
    overloadWarning: [OnOff, OnOff, OnOff];
    overloadTrip: [OnOff, OnOff, OnOff];
    totalOverloadWarning: OnOff;
    totalOverloadTrip: OnOff;
  };
  eStop: {
    rightConsole: OkNg;
    hvRoom: OkNg;
    erectionCranePanel: OkNg;
    gantryFix: OkNg;
    gantryPend: OkNg;
    gantryLocalStation: OkNg;
    elecRoom1: OkNg;
    elecRoom2: OkNg;
    hoistRemotePanel1: OkNg;
    hoistRemotePanel2: OkNg;
    hoistRemotePanel3: OkNg;
  };
}

// ─── Hoist ────────────────────────────────────────────────────────
export interface CmmsHoistUnit {
  runFault: RunFaultStatus;
  joystickStep: string;
  speedRef: number;
  actSpeed: number;
  current: number;
  driveFault: string;
  position: number;
  load: number;
  motorTemp: number;
  // 상태 비트
  mechStopRelay: OnOff;
  driveFaultBit: OnOff;
  driveMainCb: OnOff;
  driveFanCb: OnOff;
  fieldCb: OnOff;
  driveMainMc: OnOff;
  driveFanMc: OnOff;
  driveFieldMc: OnOff;
  driveFieldFuseBlown: OnOff;
  motorFanMainCb: OnOff;
  motorFanMc: OnOff;
  lubricationMotorCb: OnOff;
  eStopPb: OkNg;
}

export interface CmmsHoistData {
  hoist1: CmmsHoistUnit;
  hoist2: CmmsHoistUnit;
  hoist3: CmmsHoistUnit;
  load: {
    totalLoad: number;
    h1h2Diff: number;
    overloadWarning: [OnOff, OnOff, OnOff];
    overloadTrip: [OnOff, OnOff, OnOff];
    totalOverloadWarning: OnOff;
    totalOverloadTrip: OnOff;
  };
  overspeed: {
    overspeedFsl: [OnOff, OnOff, OnOff];
    overspeedEsl: [OnOff, OnOff, OnOff];
    overspeedMonitor1: [OnOff, OnOff, OnOff];
    overspeedMonitor2: [OnOff, OnOff, OnOff];
  };
  ropeSheave: {
    ropeSheaveH1Cb: OnOff;
    ropeSheaveH2Cb: OnOff;
    wsMc: OnOff;
    lsMc: OnOff;
    wsEndStop: OnOff;
    lsEndStop: OnOff;
  };
  position: {
    upSafetyStop: [OnOff, OnOff, OnOff];
    upNormalStop: [OnOff, OnOff, OnOff];
    upSlowdown: [OnOff, OnOff, OnOff];
    downSlowdown: [OnOff, OnOff, OnOff];
    downNormalStop: [OnOff, OnOff, OnOff];
    downSafetyStop: [OnOff, OnOff, OnOff];
    positionSynchronize: [OnOff, OnOff, OnOff];
    aeDcmPositionCompareError: [OnOff, OnOff, OnOff];
  };
  brake: {
    brakeCb: [OnOff, OnOff, OnOff];
    brakeMc: [OnOff, OnOff, OnOff];
    brake1Open: [OnOff, OnOff, OnOff];
    brake2Open: [OnOff, OnOff, OnOff];
  };
}

// ─── Trolley ─────────────────────────────────────────────────────
export interface CmmsTrolleyUnit {
  runFault: RunFaultStatus;
  joystickStep: string;
  speedRef: number;
  actSpeed: number;
  current: number;
  driveFault: string;
  position: number;
  // 상태 비트
  mechStopRelay: OnOff;
  driveFaultBit: OnOff;
  driveMainCb: OnOff;
  driveFanCb: OnOff;
  fieldCb: OnOff;
  driveMainMc: OnOff;
  driveFanMc: OnOff;
  driveFieldMc: OnOff;
  driveMainFuseBlown: OnOff;
  driveFieldFuseBlown: OnOff;
  driveOutputFuseBlown: OnOff;
  motor12FieldMonitor: OnOff;
  motor34FieldMonitor: OnOff;
  motor1Overtemp: OnOff;
  motor2Overtemp: OnOff;
  motor3Overtemp: OnOff;
  motor4Overtemp: OnOff;
  eStopPb: OkNg;
}

export interface CmmsTrolleyData {
  upperTrolley: CmmsTrolleyUnit;
  lowerTrolley: CmmsTrolleyUnit;
  position: {
    fpSafetyStopRelay: [OnOff, OnOff];
    fpEndStopMgsw: [OnOff, OnOff];
    fpSlowdownMgsw: [OnOff, OnOff];
    parkingPosition: [OnOff, OnOff];
    ppSlowdownMgsw: [OnOff, OnOff];
    ppEndStopMgsw: [OnOff, OnOff];
    ppSafetyStopRelay: [OnOff, OnOff];
    aeDcmPositionCompareError: [OnOff, OnOff];
  };
  brake: {
    brakeMc: [OnOff, OnOff];
    brake12Cb: [OnOff, OnOff];
    brake34Cb: OnOff;
    brake12Open: [OnOff, OnOff];
    brake34Open: OnOff;
  };
  upperLsHoistingCap: {
    mgsw550660fp: OnOff;
    mgsw550660pp: OnOff;
    mgsw660750fp: OnOff;
    mgsw660750pp: OnOff;
  };
  pin: {
    upperTrolleyLockedH1: OnOff;
    upperTrolleyLockedH2: OnOff;
    lowerTrolleyLockedWs: OnOff;
    lowerTrolleyLockedLs: OnOff;
  };
}

// ─── Fault Info (가동/고장 정보) ─────────────────────────────────
export interface CmmsFaultInfoData {
  activeEvents: CmmsAlarmRecord[];
  activeFaults: CmmsAlarmRecord[];
}

// ─── Fault History (가동/고장 이력) ─────────────────────────────
export interface CmmsFaultHistoryData {
  events: CmmsAlarmRecord[];
  faults: CmmsAlarmRecord[];
}

// ─── Trend ───────────────────────────────────────────────────────
export interface CmmsTrendPen {
  index: number;
  color: string;
  label: string;
  value1: number;
  value2: number;
}

export interface CmmsTrendDataPoint {
  time: string;
  [key: string]: number | string;
}

export interface CmmsTrendGroup {
  id: string;
  label: string;
}

export interface CmmsTrendData {
  groups: CmmsTrendGroup[];
  pens: CmmsTrendPen[];
  chartData: CmmsTrendDataPoint[];
}

// ─── Configuration ───────────────────────────────────────────────
export type DeviceStatus = 'normal' | 'fault';

export interface CmmsConfigDevice {
  id: string;
  label: string;
  status: DeviceStatus;
  x: number;
  y: number;
}

export interface CmmsConfigConnection {
  from: string;
  to: string;
  status: DeviceStatus;
}

export interface CmmsConfigurationData {
  devices: CmmsConfigDevice[];
  connections: CmmsConfigConnection[];
}

// ─── 통합 Mock 데이터 ─────────────────────────────────────────────
export interface CmmsMockData {
  overview: CmmsOverviewData;
  hoist: CmmsHoistData;
  trolley: CmmsTrolleyData;
  faultInfo: CmmsFaultInfoData;
  faultHistory: CmmsFaultHistoryData;
  trend: CmmsTrendData;
  configuration: CmmsConfigurationData;
}
